import { loadEnv } from './load-env.mjs';
import mysql from 'mysql2/promise';

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

const db = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'giga_workspace',
});

try {
  const adminLogin = await req('POST', '/auth/login', {
    body: {
      email: 'muhammad.ali@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(adminLogin.status === 200, `admin login ${adminLogin.status}`);
  const adminToken = adminLogin.json.accessToken;

  const listed = await req('GET', '/cases?queue=all', { token: adminToken });
  assert(listed.status === 200, `list ${listed.status}`);
  assert(listed.json.data?.length >= 1, 'expect seeded case');
  console.log('PASS: GET /cases');

  const seedId = String(listed.json.data[0].id);

  // Illegal transition: New → Resolved
  const illegal = await req('PATCH', `/cases/${seedId}`, {
    token: adminToken,
    body: { status: 'Resolved' },
  });
  assert(
    illegal.status === 422,
    `illegal transition expected 422 got ${illegal.status} ${JSON.stringify(illegal.json)}`,
  );
  console.log('PASS: illegal transition → 422');

  // Dept scoping: Ayesha (CCS) cannot read FIN case
  const ayeshaLogin = await req('POST', '/auth/login', {
    body: {
      email: 'ayesha.khan@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(ayeshaLogin.status === 200, `ayesha login ${ayeshaLogin.status}`);
  const ayeshaToken = ayeshaLogin.json.accessToken;
  const scoped = await req('GET', `/cases/${seedId}`, { token: ayeshaToken });
  assert(
    scoped.status === 403,
    `dept scope expected 403 got ${scoped.status}`,
  );
  console.log('PASS: department scoping (CCS cannot read FIN case)');

  // Blocked handoff: disable FIN → CCS rule, Hamza tries handoff
  await db.execute(
    `UPDATE handoff_rules SET is_allowed = 0
     WHERE from_department_id = 1 AND to_department_id = 2`,
  );
  const hamzaLogin = await req('POST', '/auth/login', {
    body: {
      email: 'hamza.qureshi@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(hamzaLogin.status === 200, `hamza login ${hamzaLogin.status}`);
  // Ensure seed case is New in FIN for Hamza access
  await db.execute(
    `UPDATE cases SET status = 'New', department_id = 1, assignee_user_id = NULL, sla_band = 'On track' WHERE id = ?`,
    [seedId],
  );
  const blocked = await req('POST', `/cases/${seedId}/handoff`, {
    token: hamzaLogin.json.accessToken,
    body: { toDepartmentId: '2', note: 'should fail' },
  });
  assert(
    blocked.status === 422,
    `blocked handoff expected 422 got ${blocked.status} ${JSON.stringify(blocked.json)}`,
  );
  console.log('PASS: blocked handoff → 422');
  await db.execute(
    `UPDATE handoff_rules SET is_allowed = 1
     WHERE from_department_id = 1 AND to_department_id = 2`,
  );

  // Create → note → assign → allowed handoff
  const created = await req('POST', '/cases', {
    token: adminToken,
    body: {
      categoryId: '2',
      priority: 'Normal',
      sourceClientId: 5,
      note: 'Phase 3 verify note',
    },
  });
  assert(
    created.status === 201 || created.status === 200,
    `create ${created.status} ${JSON.stringify(created.json)}`,
  );
  const newId = created.json.id;
  assert(created.json.caseNo?.startsWith('BK-'), 'case_no prefix');
  assert(created.json.department?.code === 'FIN', 'dept from category');
  console.log('PASS: POST /cases', created.json.caseNo);

  const noted = await req('POST', `/cases/${newId}/notes`, {
    token: adminToken,
    body: { body: 'Follow-up', clientVisible: false },
  });
  assert(noted.status === 201 || noted.status === 200, `note ${noted.status}`);
  console.log('PASS: POST /cases/:id/notes');

  const assigned = await req('PATCH', `/cases/${newId}`, {
    token: adminToken,
    body: { assigneeUserId: '7', status: 'Assigned' },
  });
  assert(assigned.status === 200, `assign ${assigned.status}`);
  assert(assigned.json.status === 'Assigned', 'status Assigned');
  console.log('PASS: PATCH assign');

  const handed = await req('POST', `/cases/${newId}/handoff`, {
    token: adminToken,
    body: { toDepartmentId: '2', note: 'to CCS' },
  });
  assert(
    handed.status === 200 || handed.status === 201,
    `handoff ${handed.status} ${JSON.stringify(handed.json)}`,
  );
  assert(handed.json.status === 'Handed Off', 'Handed Off');
  assert(handed.json.department?.code === 'CCS', 'now CCS');
  console.log('PASS: allowed handoff');

  const exported = await req('GET', '/cases/export?queue=all', {
    token: adminToken,
  });
  assert(exported.status === 200, `export ${exported.status}`);
  assert(String(exported.json).includes('caseNo') || typeof exported.json === 'string', 'csv');
  console.log('PASS: GET /cases/export');

  // Cleanup created case artifacts
  await db.execute(`DELETE FROM case_notes WHERE case_id = ?`, [newId]);
  await db.execute(`DELETE FROM case_handoffs WHERE case_id = ?`, [newId]);
  await db.execute(`DELETE FROM audit_logs WHERE subject_id = ? AND module = 'cases'`, [
    newId,
  ]);
  await db.execute(`DELETE FROM cases WHERE id = ?`, [newId]);
  await db.execute(
    `UPDATE cases SET status = 'New', department_id = 1, assignee_user_id = NULL, sla_band = 'On track' WHERE id = ?`,
    [seedId],
  );

  console.log('\nPhase 3 checks: ALL PASSED');
} catch (err) {
  console.error('\nPhase 3 checks FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await db
    .execute(
      `UPDATE handoff_rules SET is_allowed = 1 WHERE from_department_id = 1 AND to_department_id = 2`,
    )
    .catch(() => {});
  await db.end();
}
