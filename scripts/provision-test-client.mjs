/**
 * Create an approved client portal user for a real ERP client.
 * Usage: node --env-file=.env scripts/provision-test-client.mjs
 */
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  MessageActionType,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import bcrypt from 'bcrypt';
import pg from 'pg';

const PASSWORD = process.env.COGNITO_SEED_PASSWORD ?? 'Workspace@123';
const SOURCE_CLIENT_ID = Number(process.env.TEST_SOURCE_CLIENT_ID ?? 2028);
const EMAIL = (process.env.TEST_CLIENT_EMAIL ?? 'shahidmaz40@gmail.com')
  .trim()
  .toLowerCase();
const NAME = process.env.TEST_CLIENT_NAME ?? 'shahid mazhar';
const PHONE = process.env.TEST_CLIENT_PHONE ?? '0336-0577665';

const region =
  process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'us-east-1';
const userPoolId = process.env.COGNITO_USER_POOL_ID;
if (!userPoolId) {
  console.error('COGNITO_USER_POOL_ID required');
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

try {
  const existingLink = await db.query(
    `SELECT cl.id, cl.verification_status, u.id AS user_id, u.email
     FROM client_links cl
     JOIN users u ON u.id = cl.user_id
     WHERE cl.source_client_id = $1`,
    [SOURCE_CLIENT_ID],
  );
  if (existingLink.rows[0]) {
    console.log('Link already exists:', existingLink.rows[0]);
  }

  const existingUser = await db.query(
    `SELECT id, email, cognito_sub FROM users WHERE lower(email) = $1`,
    [EMAIL],
  );

  const role = await db.query(`SELECT id FROM roles WHERE code = 'client'`);
  if (!role.rows[0]) throw new Error('client role missing');
  const roleId = role.rows[0].id;

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  let userId = existingUser.rows[0]?.id ?? null;
  let cognitoSub = existingUser.rows[0]?.cognito_sub ?? null;

  if (!userId) {
    const inserted = await db.query(
      `INSERT INTO users (name, email, password, phone, status, must_change_password)
       VALUES ($1, $2, $3, $4, 'active', false)
       RETURNING id`,
      [NAME, EMAIL, passwordHash, PHONE],
    );
    userId = inserted.rows[0].id;
    console.log('Created user id', userId);
  } else {
    await db.query(
      `UPDATE users
       SET name = $1, password = $2, phone = $3, status = 'active', must_change_password = false
       WHERE id = $4`,
      [NAME, passwordHash, PHONE, userId],
    );
    console.log('Updated existing user id', userId);
  }

  await db.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [userId, roleId],
  );

  const linkBySource = await db.query(
    `SELECT id, user_id FROM client_links WHERE source_client_id = $1`,
    [SOURCE_CLIENT_ID],
  );
  const linkByUser = await db.query(
    `SELECT id, source_client_id FROM client_links WHERE user_id = $1`,
    [userId],
  );

  if (linkBySource.rows[0] && String(linkBySource.rows[0].user_id) !== String(userId)) {
    throw new Error(
      `source_client_id ${SOURCE_CLIENT_ID} already linked to user ${linkBySource.rows[0].user_id}`,
    );
  }
  if (
    linkByUser.rows[0] &&
    Number(linkByUser.rows[0].source_client_id) !== SOURCE_CLIENT_ID
  ) {
    throw new Error(
      `user ${userId} already linked to source_client_id ${linkByUser.rows[0].source_client_id}`,
    );
  }

  if (!linkBySource.rows[0] && !linkByUser.rows[0]) {
    await db.query(
      `INSERT INTO client_links (user_id, source_client_id, verification_status)
       VALUES ($1, $2, 'approved')`,
      [userId, SOURCE_CLIENT_ID],
    );
    console.log('Created approved client_link');
  } else {
    const linkId = linkBySource.rows[0]?.id ?? linkByUser.rows[0].id;
    await db.query(
      `UPDATE client_links
       SET user_id = $1, source_client_id = $2, verification_status = 'approved'
       WHERE id = $3`,
      [userId, SOURCE_CLIENT_ID, linkId],
    );
    console.log('Updated client_link', linkId, 'to approved');
  }

  // Cognito provision
  try {
    const created = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: EMAIL,
        MessageAction: MessageActionType.SUPPRESS,
        TemporaryPassword: PASSWORD,
        UserAttributes: [
          { Name: 'email', Value: EMAIL },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: NAME },
        ],
      }),
    );
    cognitoSub = created.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    console.log('Cognito user created');
  } catch (err) {
    if (!(err instanceof UsernameExistsException)) throw err;
    console.log('Cognito user already exists');
    const got = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: userPoolId, Username: EMAIL }),
    );
    cognitoSub = got.UserAttributes?.find((a) => a.Name === 'sub')?.Value;
  }

  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: EMAIL,
      Password: PASSWORD,
      Permanent: true,
    }),
  );
  console.log('Cognito password set permanent');

  if (cognitoSub) {
    await db.query(`UPDATE users SET cognito_sub = $1 WHERE id = $2`, [
      cognitoSub,
      userId,
    ]);
  }

  console.log('\n=== TEST CLIENT LOGIN ===');
  console.log(`email:    ${EMAIL}`);
  console.log(`password: ${PASSWORD}`);
  console.log(`ERP id:   ${SOURCE_CLIENT_ID}`);
  console.log(`name:     ${NAME}`);
  console.log('Try: POST /auth/login then GET /me/portfolio');
} finally {
  await db.end();
}
