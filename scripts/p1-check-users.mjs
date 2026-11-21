import mysql from 'mysql2/promise';
import { loadEnv } from './load-env.mjs';

loadEnv();

const c = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'giga_workspace',
});

const [rows] = await c.query(`
  SELECT u.id, u.email, u.status, u.must_change_password,
         r.code AS role, d.code AS dept, du.is_admin
  FROM users u
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles r ON r.id = ur.role_id
  LEFT JOIN department_users du ON du.user_id = u.id
  LEFT JOIN departments d ON d.id = du.department_id
  WHERE u.id IN (1, 2, 17)
  ORDER BY u.id
`);
console.log(JSON.stringify(rows, null, 2));

const [hash] = await c.query(
  `SELECT LEFT(password, 7) AS hash_prefix FROM users WHERE id = 1`,
);
console.log(hash);

await c.end();
