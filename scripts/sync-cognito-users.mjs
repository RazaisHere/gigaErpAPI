/**
 * Provision every giga_workspace.users row into Cognito and store cognito_sub.
 *
 * Requires AUTH_PROVIDER-related Cognito env + AWS credentials.
 * Sets permanent password Workspace@123 (seed password) so Postman keeps working.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-cognito-users.mjs
 */
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  MessageActionType,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import mysql from 'mysql2/promise';

const PASSWORD = process.env.COGNITO_SEED_PASSWORD ?? 'Workspace@123';
const region =
  process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

if (!userPoolId || !clientId) {
  console.error(
    'Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID (and AWS credentials) before syncing.',
  );
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region });

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'giga_workspace',
});

const [rows] = await db.query(
  `SELECT id, name, email, phone, cognito_sub AS cognitoSub, status
   FROM users
   ORDER BY id ASC`,
);

console.log(`Syncing ${rows.length} users to Cognito pool ${userPoolId}…`);

let linked = 0;
let skipped = 0;
let failed = 0;

for (const row of rows) {
  const email = String(row.email).toLowerCase();
  try {
    let sub = row.cognitoSub;

    if (!sub) {
      try {
        const created = await cognito.send(
          new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            MessageAction: MessageActionType.SUPPRESS,
            TemporaryPassword: PASSWORD,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'name', Value: row.name },
            ],
          }),
        );
        sub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
      } catch (err) {
        if (!(err instanceof UsernameExistsException)) {
          throw err;
        }
      }

      if (!sub) {
        const existing = await cognito.send(
          new AdminGetUserCommand({
            UserPoolId: userPoolId,
            Username: email,
          }),
        );
        sub = existing.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
      }

      if (!sub) {
        throw new Error('Could not resolve Cognito sub');
      }

      await db.execute(
        'UPDATE users SET cognito_sub = ? WHERE id = ?',
        [sub, row.id],
      );
    }

    await cognito.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: email,
        Password: PASSWORD,
        Permanent: true,
      }),
    );

    if (row.status === 'disabled') {
      // leave disabled users in Cognito as created; enable/disable via API later
    }

    console.log(`✓ ${email} → ${sub}`);
    linked += 1;
  } catch (err) {
    failed += 1;
    console.error(`✗ ${email}: ${err.message ?? err}`);
  }
}

await db.end();
console.log(
  `\nDone. linked/updated=${linked} skipped=${skipped} failed=${failed}`,
);
console.log(
  'Next: set AUTH_PROVIDER=cognito in .env, restart the API, login with Workspace@123',
);
