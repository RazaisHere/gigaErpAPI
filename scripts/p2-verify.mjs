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

try {
  const adminLogin = await req('POST', '/auth/login', {
    body: {
      email: 'muhammad.ali@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(adminLogin.status === 200, `superadmin login ${adminLogin.status}`);
  const adminToken = adminLogin.json.accessToken;

  const depts = await req('GET', '/departments', { token: adminToken });
  assert(depts.status === 200, `departments ${depts.status}`);
  assert(Array.isArray(depts.json) && depts.json.length >= 5, 'expect >=5 depts');
  console.log('PASS: GET /departments');

  const admins = await req('GET', '/department-admins', { token: adminToken });
  assert(admins.status === 200, `department-admins ${admins.status}`);
  assert(admins.json.length >= 5, 'expect dept admins');
  console.log('PASS: GET /department-admins');

  const staff = await req('GET', '/staff', { token: adminToken });
  assert(staff.status === 200, `staff ${staff.status}`);
  console.log('PASS: GET /staff');

  const allMembers = await req('GET', '/members', { token: adminToken });
  assert(allMembers.status === 200, `members ${allMembers.status}`);
  assert(allMembers.json.length > 5, 'superadmin sees many members');
  console.log('PASS: GET /members (superadmin)');

  const rules = await req('GET', '/handoff-rules', { token: adminToken });
  assert(rules.status === 200, `handoff-rules ${rules.status}`);
  assert(rules.json.length >= 20, 'expect seeded handoff matrix');
  console.log('PASS: GET /handoff-rules');

  // Dept admin (Ayesha / CCS) — own members only; 403 on add/remove
  const ayeshaLogin = await req('POST', '/auth/login', {
    body: {
      email: 'ayesha.khan@gigagroup.pk',
      password: 'Workspace@123',
    },
  });
  assert(ayeshaLogin.status === 200, `ayesha login ${ayeshaLogin.status}`);
  const ayeshaToken = ayeshaLogin.json.accessToken;
  assert(ayeshaLogin.json.user.department.code === 'CCS', 'CCS dept');

  const ccsMembers = await req('GET', '/members', { token: ayeshaToken });
  assert(ccsMembers.status === 200, `ayesha members ${ccsMembers.status}`);
  assert(
    ccsMembers.json.every((m) => m.department.code === 'CCS'),
    'dept admin only sees own department',
  );
  assert(ccsMembers.json.length === 3, `CCS members expect 3 got ${ccsMembers.json.length}`);
  console.log('PASS: dept admin sees only own members');

  const addForbidden = await req('POST', '/members', {
    token: ayeshaToken,
    body: {
      name: 'Should Fail',
      email: 'should.fail@gigagroup.pk',
      departmentId: '2',
    },
  });
  assert(
    addForbidden.status === 403,
    `dept admin add expected 403 got ${addForbidden.status}`,
  );
  console.log('PASS: dept admin 403 on POST /members');

  const someMembershipId = ccsMembers.json.find((m) => !m.isAdmin)?.membershipId;
  assert(someMembershipId, 'need a non-admin membership to test delete');
  const delForbidden = await req('DELETE', `/members/${someMembershipId}`, {
    token: ayeshaToken,
  });
  assert(
    delForbidden.status === 403,
    `dept admin delete expected 403 got ${delForbidden.status}`,
  );
  console.log('PASS: dept admin 403 on DELETE /members/:id');

  // Superadmin can add then remove a temporary member
  const created = await req('POST', '/members', {
    token: adminToken,
    body: {
      name: 'Temp Phase2 Member',
      email: 'temp.phase2.member@gigagroup.pk',
      departmentId: '1',
      temporaryPassword: 'TempPass@123',
    },
  });
  assert(created.status === 201 || created.status === 200, `create member ${created.status} ${JSON.stringify(created.json)}`);
  const membershipId = created.json.membershipId;
  const removed = await req('DELETE', `/members/${membershipId}`, {
    token: adminToken,
  });
  assert(removed.status === 200, `remove member ${removed.status}`);
  console.log('PASS: superadmin add/remove member');

  // Cleanup user left without membership (optional delete via SQL later)
  console.log('\nPhase 2 checks: ALL PASSED');
} catch (err) {
  console.error('\nPhase 2 checks FAILED:', err.message);
  process.exitCode = 1;
}
