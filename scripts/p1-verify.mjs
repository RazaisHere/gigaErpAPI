import { loadEnv } from './load-env.mjs';

loadEnv();

const BASE = `http://localhost:${process.env.PORT ?? 3001}/api/v1`;

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const mysql = (await import('mysql2/promise')).default;
const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'giga_workspace',
});

const SEED_HASH =
  '$2y$12$CdckeeO/X0WTXWLohMo7juAhG4g1mj6mzpnPDwu5CBd5nvdzCanYu';

try {
  // 1) Superadmin login
  const adminLogin = await req('POST', '/auth/login', {
    body: {
      email: 'muhammad.ali@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(adminLogin.status === 200, `superadmin login ${adminLogin.status}`);
  assert(adminLogin.json.user.role.code === 'superadmin', 'role superadmin');
  const adminToken = adminLogin.json.accessToken;
  const me = await req('GET', '/auth/me', { token: adminToken });
  assert(me.status === 200, `/auth/me ${me.status}`);
  console.log('PASS: superadmin login + /me');

  // 2) Hamza must change password — /me blocked
  const hamzaLogin = await req('POST', '/auth/login', {
    body: {
      email: 'hamza.qureshi@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(hamzaLogin.status === 200, `hamza login ${hamzaLogin.status}`);
  assert(
    hamzaLogin.json.user.mustChangePassword === true,
    'hamza mustChangePassword',
  );
  const hamzaToken = hamzaLogin.json.accessToken;
  const hamzaMeBlocked = await req('GET', '/auth/me', { token: hamzaToken });
  assert(
    hamzaMeBlocked.status === 403,
    `hamza /me expected 403 got ${hamzaMeBlocked.status}`,
  );
  console.log('PASS: Hamza blocked on /me until password change');

  // Change password then /me works
  const changed = await req('POST', '/auth/change-password', {
    token: hamzaToken,
    body: {
      currentPassword: 'Workspace@123',
      newPassword: 'TempPhase1@999',
    },
  });
  assert(changed.status === 200, `change-password ${changed.status}`);
  assert(changed.json.user.mustChangePassword === false, 'flag cleared');
  const hamzaMeOk = await req('GET', '/auth/me', {
    token: changed.json.accessToken,
  });
  assert(hamzaMeOk.status === 200, `hamza /me after change ${hamzaMeOk.status}`);
  console.log('PASS: Hamza change-password unlocks /me');

  // Restore Hamza seed credentials
  await db.execute(
    `UPDATE users SET password = ?, must_change_password = 1, status = 'pending_first_login' WHERE id = 2`,
    [SEED_HASH],
  );
  console.log('INFO: restored Hamza seed password/flags');

  // 3) Disabled user rejected
  await db.execute(`UPDATE users SET status = 'disabled' WHERE id = 8`);
  const disabledLogin = await req('POST', '/auth/login', {
    body: {
      email: 'fin.staff2@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(
    disabledLogin.status === 401,
    `disabled login expected 401 got ${disabledLogin.status}`,
  );
  await db.execute(`UPDATE users SET status = 'active' WHERE id = 8`);
  console.log('PASS: disabled user rejected');

  // 4) Client 403 on admin route
  const clientLogin = await req('POST', '/auth/login', {
    body: {
      email: 'client.1@workspace.local',
      password: 'Workspace@123',
    },
  });
  assert(clientLogin.status === 200, `client login ${clientLogin.status}`);
  assert(clientLogin.json.user.role.code === 'client', 'role client');
  const clientAdmin = await req('GET', '/admin/ping', {
    token: clientLogin.json.accessToken,
  });
  assert(
    clientAdmin.status === 403,
    `client admin ping expected 403 got ${clientAdmin.status}`,
  );
  const adminPing = await req('GET', '/admin/ping', { token: adminToken });
  assert(adminPing.status === 200, `superadmin admin ping ${adminPing.status}`);
  console.log('PASS: client 403 on /admin/ping; superadmin ok');

  console.log('\nPhase 1 checks: ALL PASSED');
} catch (err) {
  console.error('\nPhase 1 checks FAILED:', err.message);
  process.exitCode = 1;
} finally {
  // best-effort restore
  await db
    .execute(
      `UPDATE users SET password = ?, must_change_password = 1, status = 'pending_first_login' WHERE id = 2`,
      [SEED_HASH],
    )
    .catch(() => {});
  await db
    .execute(`UPDATE users SET status = 'active' WHERE id = 8`)
    .catch(() => {});
  await db.end();
}
