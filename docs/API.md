# Giga Workspace API — Module reference

Base URL: `http://localhost:3001/api/v1`  
Interactive Swagger: `http://localhost:3001/docs`  
Auth header: `Authorization: Bearer <accessToken>`

**Databases:** workspace tables on **Supabase PostgreSQL** (`DATABASE_URL`); ERP / `src_*` reads on **MySQL** (`SOURCE_DB_*`). Soft links (`source_client_id`, …) have no cross-DB foreign keys.

| Role | Notes |
|------|--------|
| `superadmin` | Full access |
| `department_admin` | Scoped to own department where noted |
| `employee` | Staff queues / cases / clients (read + work) |
| `client` | Login only for now (admin routes return 403) |

`AUTH_PROVIDER=nest` → Nest JWT. `AUTH_PROVIDER=cognito` → Cognito access token (JWKS). Seed password: `Workspace@123`.

**Cognito login requirements (current BFF):** app client must allow `USER_PASSWORD_AUTH` + `REFRESH_TOKEN_AUTH`. If the client was created **with a secret**, set `COGNITO_CLIENT_SECRET` in `.env`. IAM policy template for Admin* APIs (provisioning/sync): `docs/cognito-iam-policy.json`.

If `mustChangePassword` is true, only `/auth/change-password`, `/auth/logout`, and `/auth/me` are allowed until the password is changed.

---

## 1. Health

Public. No auth.

### `GET /health`

**Response**

```json
{
  "status": "ok",
  "timezone": "Asia/Karachi",
  "currency": "PKR",
  "connections": {
    "workspace": { "ok": true },
    "source": { "ok": true }
  }
}
```

### `GET /health/probe`

**Response**

```json
{
  "view": "src_projects",
  "count": 4,
  "expected": 4,
  "ok": true,
  "note": "Read-only live link to gigagroup via src_* views"
}
```

---

## 2. Auth

### Shared user object (login / me)

```json
{
  "id": "1",
  "name": "Muhammad Ali",
  "email": "muhammad.ali@gigagroup.pk",
  "status": "active",
  "mustChangePassword": false,
  "role": { "code": "superadmin", "name": "Superadmin" },
  "department": {
    "id": "1",
    "code": "FIN",
    "name": "Finance",
    "isAdmin": true
  }
}
```

`department` is `null` for superadmin / clients without a department membership.

---

### `POST /auth/login` — Public

**Request**

```json
{
  "email": "muhammad.ali@gigagroup.pk",
  "password": "Workspace@123"
}
```

**Response (nest)**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": "8h",
  "user": { "...": "see shared user object" }
}
```

**Response (cognito — success)**

```json
{
  "accessToken": "<cognito access jwt>",
  "idToken": "<cognito id jwt>",
  "refreshToken": "<cognito refresh>",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": { "...": "see shared user object" }
}
```

**Response (cognito — NEW_PASSWORD_REQUIRED)**

```json
{
  "challengeName": "NEW_PASSWORD_REQUIRED",
  "session": "<session>",
  "challengeParameters": {},
  "user": { "...": "see shared user object" }
}
```

---

### `POST /auth/complete-new-password` — Public (Cognito)

**Request**

```json
{
  "email": "hamza.qureshi@gigagroup.pk",
  "newPassword": "Workspace@1234",
  "session": "<from login challenge>"
}
```

**Response** — same Cognito token shape as successful login.

---

### `POST /auth/refresh` — Public (Cognito)

**Request**

```json
{
  "email": "muhammad.ali@gigagroup.pk",
  "refreshToken": "<refresh>"
}
```

**Response** — Cognito tokens + `user`.

---

### `POST /auth/forgot-password` — Public (Cognito)

**Request**

```json
{ "email": "muhammad.ali@gigagroup.pk" }
```

**Response**

```json
{
  "ok": true,
  "message": "If the account exists, a reset code has been sent"
}
```

---

### `POST /auth/confirm-forgot-password` — Public (Cognito)

**Request**

```json
{
  "email": "muhammad.ali@gigagroup.pk",
  "code": "123456",
  "newPassword": "Workspace@1234"
}
```

**Response**

```json
{ "ok": true }
```

---

### `POST /auth/client/register` — Public (requires Cognito pool)

Matches `src_clients` by CNIC (phone soft-check). Sends Cognito email verification code.

**Request**

```json
{
  "email": "kifyat.signup@example.com",
  "password": "Workspace@123",
  "cnic": "21104-4733982-1",
  "phone": "0341-5813388"
}
```

- `cnic` format: `#####-#######-#`
- `phone` format: `03XX-XXXXXXX`

**Response**

```json
{
  "ok": true,
  "email": "kifyat.signup@example.com",
  "sourceClientId": 6,
  "clientName": "KIFYATULLAH",
  "message": "Verification code sent to your email. Confirm with POST /auth/client/confirm."
}
```

**Errors:** `404` no ERP match · `409` email or ERP client already registered · `400` Cognito not configured

---

### `POST /auth/client/confirm` — Public (Cognito)

**Request**

```json
{
  "email": "kifyat.signup@example.com",
  "code": "123456"
}
```

**Response**

```json
{
  "ok": true,
  "email": "kifyat.signup@example.com",
  "userId": "99",
  "sourceClientId": 6,
  "verificationStatus": "pending",
  "message": "Email confirmed. Your account is pending staff verification. You can sign in; staff will approve access."
}
```

Creates workspace user (`role=client`) + `client_links` with `verificationStatus: "pending"`.

---

### `POST /auth/client/resend-code` — Public (Cognito)

**Request**

```json
{ "email": "kifyat.signup@example.com" }
```

**Response**

```json
{
  "ok": true,
  "message": "If a pending signup exists, a new code has been sent"
}
```

---

### `POST /auth/logout` — Bearer

**Response**

```json
{ "ok": true }
```

Cognito mode also calls GlobalSignOut when a bearer token is present.

---

### `GET /auth/me` — Bearer

**Response** — shared user object.

---

### `POST /auth/change-password` — Bearer (allowed during must-change)

**Request**

```json
{
  "currentPassword": "Workspace@123",
  "newPassword": "Workspace@1234"
}
```

**Response (nest)** — new Nest JWT + `user` (same shape as login).  
**Response (cognito)**

```json
{
  "ok": true,
  "user": { "...": "see shared user object" }
}
```

---

## 3. Admin (stub)

### `GET /admin/ping` — Bearer · `superadmin` | `department_admin` | `employee`

**Response**

```json
{
  "ok": true,
  "role": "superadmin",
  "message": "Admin route reachable"
}
```

Clients receive `403`.

---

## 4. Departments

### `GET /departments` — Bearer · staff roles

**Response** — array of:

```json
{
  "id": "1",
  "name": "Finance",
  "code": "FIN",
  "status": "active",
  "memberCount": 3,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### `GET /departments/:id` — Bearer · staff roles

**Response** — one department object (as above; `memberCount` may be omitted).

### `POST /departments` — Bearer · `superadmin`

**Request**

```json
{ "name": "Compliance", "code": "CMP" }
```

**Response** — created department.

### `PATCH /departments/:id` — Bearer · `superadmin`

**Request**

```json
{ "name": "Finance Ops", "status": "inactive" }
```

`status`: `active` | `inactive`

**Response** — updated department.

---

## 5. Department admins

All routes: Bearer · `superadmin`.

### Admin object

```json
{
  "id": "2",
  "name": "Hamza Qureshi",
  "email": "hamza.qureshi@gigagroup.pk",
  "phone": "0300-0000002",
  "status": "pending_first_login",
  "mustChangePassword": true,
  "role": { "code": "department_admin", "name": "Department Admin" },
  "department": { "id": "1", "code": "FIN", "name": "Finance" }
}
```

### `GET /department-admins`

**Response** — array of admin objects.

### `POST /department-admins`

**Request**

```json
{
  "name": "New Admin",
  "email": "new.admin@gigagroup.pk",
  "phone": "0300-1111111",
  "departmentId": "1",
  "temporaryPassword": "Workspace@123"
}
```

`temporaryPassword` optional (default `Workspace@123`). Cognito mode also provisions Cognito with a temporary password.

**Response** — admin object.

### `PATCH /department-admins/:id`

**Request**

```json
{
  "name": "Hamza Q.",
  "phone": "0300-0000002",
  "departmentId": "2",
  "status": "active"
}
```

`status`: `active` | `disabled`

**Response** — admin object.

### `POST /department-admins/:id/reset-password`

**Response**

```json
{
  "ok": true,
  "userId": "2",
  "mustChangePassword": true,
  "temporaryPasswordHint": "Reset to default seed password; user must change on next login"
}
```

### `POST /department-admins/:id/disable` · `POST .../enable`

**Response** — admin object.

---

## 6. Members / staff

### Membership object

```json
{
  "membershipId": "1",
  "isAdmin": false,
  "user": {
    "id": "7",
    "name": "Finance Staff One",
    "email": "fin.staff1@gigagroup.pk",
    "phone": "0301-0000001",
    "employeeCode": "GG-1101",
    "status": "active",
    "role": { "code": "employee", "name": "Employee" }
  },
  "department": { "id": "1", "code": "FIN", "name": "Finance" }
}
```

### `GET /members?department=` — Bearer · `superadmin` | `department_admin`

- Dept admin: forced to own department (query ignored for scope).
- Superadmin: optional `department` = id or code.

**Response** — array of membership objects.

### `GET /staff` — Bearer · `superadmin`

**Response** — array of:

```json
{
  "id": "7",
  "name": "Finance Staff One",
  "email": "fin.staff1@gigagroup.pk",
  "phone": "0301-0000001",
  "employeeCode": "GG-1101",
  "status": "active",
  "departments": [
    {
      "membershipId": "1",
      "id": "1",
      "code": "FIN",
      "name": "Finance",
      "isAdmin": false
    }
  ]
}
```

### `POST /members` — Bearer · `superadmin`

**Request (new user)**

```json
{
  "name": "New Staff",
  "email": "new.staff@gigagroup.pk",
  "phone": "0301-9999999",
  "employeeCode": "GG-1999",
  "departmentId": "1",
  "temporaryPassword": "Workspace@123"
}
```

**Request (existing user)**

```json
{
  "userId": "7",
  "departmentId": "2"
}
```

**Response** — membership object.

### `DELETE /members/:id` — Bearer · `superadmin` (dept admin → 403)

`:id` is **membershipId**.

**Response**

```json
{ "ok": true, "removedMembershipId": "1" }
```

---

## 7. Handoff rules

### Rule object

```json
{
  "id": "1",
  "isAllowed": true,
  "fromDepartment": { "id": "1", "code": "FIN", "name": "Finance" },
  "toDepartment": { "id": "2", "code": "CCS", "name": "Customer Care" }
}
```

### `GET /handoff-rules` — Bearer · `superadmin` | `department_admin`

**Response** — array of rules.

### `POST /handoff-rules` — Bearer · `superadmin`

**Request**

```json
{
  "fromDepartmentId": "1",
  "toDepartmentId": "3",
  "isAllowed": true
}
```

**Response** — rule object.

### `PATCH /handoff-rules/:id` — Bearer · `superadmin`

**Request**

```json
{ "isAllowed": false }
```

**Response** — rule object.

### `DELETE /handoff-rules/:id` — Bearer · `superadmin`

**Response**

```json
{ "ok": true, "removedId": "1" }
```

---

## 8. Cases

Roles: Bearer · `superadmin` | `department_admin` | `employee` (dept-scoped for non-superadmin).

### Case list item

```json
{
  "id": "1",
  "caseNo": "BK-1003001",
  "status": "New",
  "priority": "Normal",
  "slaBand": "On track",
  "openedAt": "...",
  "closedAt": null,
  "sourceClientId": 5,
  "sourceUnitsaleId": 5,
  "sourceUnitId": 123,
  "sourceReceiptId": null,
  "category": { "id": "2", "name": "..." },
  "department": { "id": "1", "code": "FIN", "name": "Finance" },
  "assignee": { "id": "7", "name": "...", "email": "..." },
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Case detail

Same as list item, plus:

```json
{
  "notes": [
    {
      "id": "1",
      "body": "Called client",
      "clientVisible": false,
      "createdAt": "...",
      "user": { "id": "1", "name": "...", "email": "..." }
    }
  ],
  "handoffs": [
    {
      "id": "1",
      "note": "Needs CCS follow-up",
      "createdAt": "...",
      "fromDepartment": { "id": "1", "code": "FIN", "name": "Finance" },
      "toDepartment": { "id": "2", "code": "CCS", "name": "Customer Care" },
      "byUser": { "id": "1", "name": "...", "email": "..." }
    }
  ]
}
```

### Statuses

`New` · `Assigned` · `In Progress` · `Waiting on Client` · `Handed Off` · `Resolved` · `Closed` · `Reopened`

### Priorities

`Low` · `Normal` · `High` · `Urgent`

### Queues (`?queue=`)

`all` · `unassigned` · `overdue` · `closed` · `assigned` · `waiting_on_client` · `incoming_handoffs` · `outgoing_handoffs`

---

### `GET /cases`

**Query:** `queue`, `department` (id|code), `status`, `priority`, `q`, `page`, `pageSize`

**Response**

```json
{
  "data": [ { "...": "case list item" } ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /cases/export`

Same query as list. **Response:** CSV (`text/csv`).

### `GET /cases/:id`

**Response** — case detail.

### `POST /cases`

**Request**

```json
{
  "categoryId": "2",
  "priority": "Normal",
  "sourceClientId": 5,
  "sourceUnitsaleId": 5,
  "sourceUnitId": 123,
  "sourceReceiptId": null,
  "departmentId": "1",
  "assigneeUserId": "7",
  "note": "Initial note"
}
```

Only `categoryId` is required. Department defaults from category when omitted.

**Response** — case detail.

### `PATCH /cases/:id`

**Request**

```json
{
  "status": "In Progress",
  "priority": "High",
  "assigneeUserId": "7"
}
```

Pass `assigneeUserId: null` or `""` to unassign.

**Response** — case list item (updated).

### `POST /cases/:id/notes`

**Request**

```json
{ "body": "Called client", "clientVisible": false }
```

**Response** — note object.

### `POST /cases/:id/handoff`

**Request**

```json
{ "toDepartmentId": "2", "note": "Needs CCS" }
```

**Response** — case detail (after handoff). Enforced by handoff rules matrix.

### `POST /cases/bulk-assign` — Bearer · `superadmin`

**Request**

```json
{
  "caseIds": ["1", "2"],
  "assigneeUserId": "7"
}
```

**Response**

```json
{ "ok": true, "updated": 2 }
```

---

## 9. Clients

Roles: Bearer · staff (`verify` = `superadmin` | `department_admin` only).

### Directory row

```json
{
  "id": "1",
  "reference": "CL-00001",
  "sourceClientId": 1,
  "verificationStatus": "pending",
  "name": "MUHAMMAD ASIF MASOOD",
  "email": null,
  "mobile": null,
  "cnic": "32302-8837755-1",
  "user": {
    "id": "17",
    "name": "MUHAMMAD ASIF MASOOD",
    "email": "client.1@workspace.local",
    "status": "active"
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

`verificationStatus`: `pending` · `approved` · `rejected` · `request_information` · `under_review`

---

### `GET /clients`

**Query:** `q`, `verificationStatus`, `page`, `pageSize`

**Response**

```json
{
  "data": [ { "...": "directory row" } ],
  "meta": { "page": 1, "pageSize": 20, "total": 5, "totalPages": 1 }
}
```

### `GET /clients/verifications`

Same as list, default `verificationStatus=pending`.

### `GET /clients/:id` — Client 360

`:id` is **client_link id**, not ERP id.

**Response**

```json
{
  "...": "directory row fields",
  "profile": {
    "sourceClientId": 5,
    "name": "SONIA SAJID",
    "email": "soniasajid924@gmail.com",
    "mobile": "0341 5813388",
    "workPhone": null,
    "cnic": "81302-3740240-2",
    "billingAddress": "..."
  },
  "sales": [
    {
      "sourceUnitsaleId": 5,
      "saleNumber": "...",
      "unitName": "GOLDCREST 3802",
      "buildingName": "...",
      "projectName": "...",
      "bookingDate": "...",
      "netPrice": 0,
      "netReceipts": 0,
      "currentOutstanding": 0,
      "saleStatusId": 1
    }
  ],
  "cases": [ { "...": "case list item" } ]
}
```

### `POST /clients/:id/verify` — Bearer · `superadmin` | `department_admin`

**Request**

```json
{
  "action": "approve",
  "reason": "Documents verified",
  "cnic": "81302-3740240-2",
  "mobile": "0341-5813388"
}
```

`action`: `approve` · `reject` · `request_information` · `under_review`  
`cnic` / `mobile` optional; validated when sent (ERP remains read-only).

**Response** — full Client 360 object after update.

---

## 10. Not implemented yet

| Area | Planned later |
|------|----------------|
| Sales / inventory / projects | Phase 5 — `GET /sales`, `/inventory`, `/projects` |
| Collections | Phase 6 |
| Config CRUD (categories, SLA, templates) | Phase 7 |
| Dashboard / reports / audit list API | Phase 8 |
| Facial recognition | Deferred |

---

## Seed logins

| Email | Role |
|-------|------|
| `muhammad.ali@gigagroup.pk` | superadmin |
| `hamza.qureshi@gigagroup.pk` | department_admin (FIN, must change password) |
| `ayesha.khan@gigagroup.pk` | department_admin (CCS) |
| `fin.staff1@gigagroup.pk` | employee |
| `client.1@workspace.local` | client |

Password for all seeds (and after `npm run cognito:sync`): `Workspace@123`.
