/**
 * End-to-end smoke against a running API (Cognito or Nest).
 * Usage: node --env-file=.env scripts/smoke-api.mjs
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3001/api/v1';
const email = process.env.SMOKE_EMAIL ?? 'muhammad.ali@gigagroup.pk';
const password = process.env.SMOKE_PASSWORD ?? 'Workspace@123';

const results = [];

async function req(method, path, { body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const health = await req('GET', '/health');
record('GET /health', health.status === 200 && health.json?.status === 'ok', `status=${health.status}`);

const login = await req('POST', '/auth/login', { body: { email, password } });
const token = login.json?.accessToken;
record(
  'POST /auth/login',
  login.status === 200 && Boolean(token),
  login.status !== 200
    ? `status=${login.status} ${JSON.stringify(login.json)}`
    : `role=${login.json?.user?.role?.code}`,
);

if (!token) {
  console.log('\nStopped: login failed.');
  console.log('Common fixes:');
  console.log('  1) Add COGNITO_CLIENT_SECRET to .env (App client → Show client secret)');
  console.log('  2) Enable ALLOW_USER_PASSWORD_AUTH on the Cognito app client');
  console.log('  3) Or attach docs/cognito-iam-policy.json for Admin* APIs');
  process.exit(1);
}

const checks = [
  ['GET /auth/me', () => req('GET', '/auth/me', { token })],
  ['GET /admin/ping', () => req('GET', '/admin/ping', { token })],
  ['GET /departments', () => req('GET', '/departments', { token })],
  ['GET /department-admins', () => req('GET', '/department-admins', { token })],
  ['GET /members', () => req('GET', '/members', { token })],
  ['GET /staff', () => req('GET', '/staff', { token })],
  ['GET /handoff-rules', () => req('GET', '/handoff-rules', { token })],
  ['GET /cases', () => req('GET', '/cases', { token })],
  ['GET /clients', () => req('GET', '/clients', { token })],
  ['GET /clients/verifications', () => req('GET', '/clients/verifications', { token })],
];

for (const [name, fn] of checks) {
  const r = await fn();
  record(name, r.status === 200, `status=${r.status}`);
}

const cases = await req('GET', '/cases?pageSize=1', { token });
const caseId = cases.json?.data?.[0]?.id;
if (caseId) {
  const detail = await req('GET', `/cases/${caseId}`, { token });
  record(`GET /cases/${caseId}`, detail.status === 200, `status=${detail.status}`);
}

const clients = await req('GET', '/clients?pageSize=1', { token });
const clientId = clients.json?.data?.[0]?.id;
if (clientId) {
  const detail = await req('GET', `/clients/${clientId}`, { token });
  record(`GET /clients/${clientId}`, detail.status === 200, `status=${detail.status}`);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\nDone. passed=${results.length - failed} failed=${failed}`);
process.exit(failed ? 1 : 0);
