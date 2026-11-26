# Giga Group — Client Services Workspace

## Backend briefing (from current frontend mock)

This document describes the **menus, screens, roles, domain objects, and workflows** implemented in the current frontend prototype so a backend can be designed against real product behavior.

> **Status today:** frontend-only mock. Session + editable tables persist in browser `localStorage` (`giga-workspace-session`, `giga-workspace-records`). No real API, auth service, or ERP writes.

---

## 1. Product framing

**App name:** Giga Group — Client Services Workspace  

**Purpose:** Desktop-first admin for:

- Client service **cases**
- **Clients** and verification
- **Properties / sales** (CRM-style, mostly read-only context)
- **Collections** (outstanding, dues, receipts, surcharges)
- **Departments**, admins, staff, handoff rules
- **Configuration** (categories, SLA, notification templates)
- **Reports** + **audit**

**Departments (fixed operating areas):**

| Name | Code |
| --- | --- |
| Finance | FIN |
| Customer Care | CCS |
| Recovery | RCV |
| Sales Support | SAL |
| Legal | LGL |

---

## 2. Roles & routes

| Role | Route | Notes |
| --- | --- | --- |
| Unauthenticated | `/` | Login screen |
| Superadmin | `/admin` | Full workspace |
| Department Admin | `/dept` | Scoped to one (switchable) department |

### Auth behavior (mock → become real APIs)

1. Login with email/password (demo buttons exist).
2. Superadmin → `/admin`.
3. Department Admin → if `mustChangePassword === true`, force **Set new password**, then `/dept`.
4. Logout clears session and returns to `/`.
5. Session shape today:

```ts
{
  role: "Superadmin" | "Department Admin";
  name: string;
  email: string;
  department?: string;        // required for Department Admin
  mustChangePassword?: boolean;
}
```

### Demo accounts (frontend only)

| Email | Role | Department |
| --- | --- | --- |
| `muhammad.ali@gigagroup.pk` | Superadmin | — |
| `hamza.qureshi@gigagroup.pk` | Department Admin | Finance (first login requires password change) |

### Role constraints (must enforce in backend)

1. **Collections** nav for Department Admin is visible only when active department is **Finance** or **Recovery**.
2. **Case handoff destinations** for Department Admin must be limited to allowed **Handoff Rules** (no override). Superadmin can hand off to any other department.
3. **My Team → Add member** is disabled for Department Admin (“Only the Superadmin can add or remove members”).
4. Department Admin case queues are scoped to their department (except Superadmin “All Cases”).

---

## 3. Navigation map

### 3.1 Superadmin (`/admin`)

| Menu group | Submenus / pages |
| --- | --- |
| **OVERVIEW** | Overview, Audit Log |
| **CASES** | All Cases, Unassigned, Overdue, Closed |
| **CLIENTS** | Client Directory, Client Accounts, Pending Verification |
| **PROPERTIES & SALES** | Sales, Inventory, Projects & Buildings |
| **COLLECTIONS** | Outstanding, Upcoming Dues, Receipts, Surcharges |
| **DEPARTMENTS** | Departments, Department Admins, Members, Handoff Rules |
| **WORKFORCE** | Staff |
| **CONFIGURATION** | Case Categories, SLA Rules, Notification Templates |
| **REPORTS** | Case Report, Department Performance, Collections Summary |
| **SYSTEM** | Settings |

### 3.2 Department Admin (`/dept`)

| Menu group | Submenus / pages |
| --- | --- |
| **WORKSPACE** | Dashboard |
| **DEPARTMENT QUEUE** | Unassigned, Assigned, Waiting on Client, Incoming Handoffs, Outgoing Handoffs, Closed |
| **TEAM** | My Team, Client Lookup |
| **COLLECTIONS** *(Finance / Recovery only)* | Outstanding, Upcoming Dues |
| **REPORTS** | Reports *(alias of Case Report)* |
| **ACCOUNT** | Profile |

### 3.3 Page aliases (UI only)

| UI page | Underlying data table |
| --- | --- |
| Overview / Dashboard | Dashboard KPIs + charts (not a table) |
| All Cases / Unassigned / Overdue / Closed / Assigned / Waiting on Client / Incoming Handoffs / Outgoing Handoffs | `Cases` (+ filters) |
| My Team | `Members` (filtered to admin’s department) |
| Client Lookup | `Client Directory` |
| Reports | `Case Report` |
| Staff | same schema as `Members` |

---

## 4. Core domain entities (suggested backend models)

These map to current mock tables. Prefer real relational IDs in backend; mock currently uses display strings as keys.

### 4.1 Case (service request)

**Primary key today:** Case no (e.g. `BK-1003041`) — backend should use UUID + separate `case_no`.

| Field | Example / notes |
| --- | --- |
| case_no | `BK-1003041` |
| client_name / client_id | linked client |
| cnic | `35202-XXXXXXX-X` |
| unit | `GOLDCREST-A-402` |
| category | see Case Categories |
| department | one of 5 departments |
| assignee | staff name or `Unassigned` |
| status | see statuses below |
| priority | Low / Normal / High / Urgent |
| age | derived |
| sla_band | On track / At risk / Breached |
| notes | internal + client-visible |
| handoffs | from/to/department history |

**Statuses**

`New` → `Assigned` → `In Progress` → `Waiting on Client` → `Handed Off` → `Resolved` → `Closed`  
Also: `Reopened`

**Categories**

- Cheque Issue
- Payment Not Reflected
- Outstanding Query
- Surcharge Waiver Request
- Reschedule Request
- Transfer Request
- Possession Request
- Document Request
- Other

**Case queue filters**

| View | Filter rule (current mock) |
| --- | --- |
| All Cases | all (dept-scoped for dept admin) |
| Unassigned | assignee = Unassigned |
| Overdue | SLA = Breached |
| Closed | status in Resolved, Closed |
| Assigned | status = Assigned |
| Waiting on Client | status = Waiting on Client |
| Incoming Handoffs | status = Handed Off + in this department |
| Outgoing Handoffs | status = Handed Off + originated from this department |

### 4.2 Client

| Concept | Key fields |
| --- | --- |
| Client Directory | name, reference `CL-xxxxx`, CNIC, phone `03XX-XXXXXXX`, project, unit, status |
| Client Accounts | account no, unit, project, balance PKR, updated, status |
| Pending Verification | submitted date, verification status (CNIC pending, docs under review, etc.) |

**Client actions:** approve / reject / request information / place under review.

### 4.3 Sale / inventory / project (CRM context, largely read-only)

| Entity | Key fields |
| --- | --- |
| Sale | sale id, client, unit, project, total, received, outstanding, status |
| Inventory unit | unit code, project, type, floor, size, Available/Sold |
| Project | name, building, type, units, city, status |

**Projects used in demo:** GOLDCREST, GOLDCREST Breeze, GOLDCREST VIEWS, GIGA MALL.

**Sale Detail 360** should expose: ownership, installments, receipts, surcharges, related cases, “create case for this property”.

### 4.4 Collections

| Screen | Key fields |
| --- | --- |
| Outstanding | client, reference, unit, account, outstanding PKR, next due, days overdue, status |
| Upcoming Dues | client, unit, due date, amount, Scheduled |
| Receipts | `RP-10xxxxx`, client, unit, amount, received date, mode, Cleared/Pending |
| Surcharges | surcharge id, client, unit, amount, applied date, Applied / Waiver requested / Waived |

**Action:** Create recovery case from outstanding row.

### 4.5 Organization / workforce

| Entity | Key fields |
| --- | --- |
| Department | name, code, department admin, staff count, open/pending cases, status, created |
| Department Admin | name, department, email, phone, status (`Active` / `Pending first login` / `Disabled`), created |
| Member / Staff | name, employee id `GG-xxxx`, designation, department, reporting admin, email, contact, status |
| Handoff Rule | from department, to department, Allowed/Blocked |

### 4.6 Configuration

| Entity | Key fields |
| --- | --- |
| Case Category | name, default department, default SLA, default channels, status |
| SLA Rule | name, priority, category, target hours, escalate-at, status |
| Notification Template | name, key, channel (Email/SMS), subject, body, status |

**Template placeholders:** `{client_name}`, `{case_no}`

### 4.7 Audit log

Append-only events: activity id, user, role, department, action, module, IP, timestamp.

### 4.8 Settings / profile

User preferences + organization demo reset (frontend). Backend should replace “Reset demo data” with real admin ops, not destroy production data.

---

## 5. How the UI works (behavior to mirror in APIs)

### 5.1 Shell

- Collapsible sidebar (grouped menus)
- Topbar: breadcrumbs, global search, notifications stub, profile menu
- Department Admin topbar: **department switcher** (changes scoped views)
- Page heading + filters + paginated table
- Row click → detail panel/dialog
- Toasts for success/error
- Confirm dialogs for destructive actions

### 5.2 Case workflows (highest priority APIs)

| Action | Who | Backend expectation |
| --- | --- | --- |
| Create case | Superadmin / Dept Admin | Validate client + category; auto-route department from category defaults; status `New`; assignee `Unassigned` unless assigned |
| Reassign case | Both | Set assignee; typically status → `Assigned` |
| Change status | Both | Enforce allowed transitions |
| Change priority | Both | Low/Normal/High/Urgent |
| Handoff case | Both | Move department; status `Handed Off`; write handoff history; **dept admin destinations filtered by Handoff Rules** |
| Close case | Both | status `Closed` (confirm) |
| Reopen case | Both | status `Reopened` |
| Add note | Both | Support internal vs client-visible |
| Bulk assign | Superadmin (UI) | Assign many case IDs |
| Export CSV | Both | Server-side export preferred later |

### 5.3 Client workflows

| Action | Backend expectation |
| --- | --- |
| Approve account | Activate account + verification outcome |
| Reject account | Reject with reason |
| Request information | Keep pending + reason |
| Place under review | Under review state |
| Client 360 | Aggregate profile, sales, collections, cases, activity |

### 5.4 Department Admin management (Superadmin)

| Action | Backend expectation |
| --- | --- |
| Create department admin | name, email, phone, department(s); either temp password or invite |
| Edit admin | Update profile/department |
| Resend invite | Re-send invite email |
| Reset password | Force `mustChangePassword` / issue reset token |
| Disable / Enable | Block or restore login |

### 5.5 Departments & handoff rules

| Action | Backend expectation |
| --- | --- |
| Add/Edit department | code, admin, active state |
| Activate/Deactivate department | status flag |
| Add/Edit/Delete handoff rule | from → to Allowed/Blocked |
| Toggle allowed | Update matrix cell |

### 5.6 Configuration CRUD

Create/edit:

- Case Categories
- SLA Rules
- Notification Templates (preview placeholders)

### 5.7 Collections

| Action | Backend expectation |
| --- | --- |
| Create recovery case | Create case linked to client/unit/outstanding; category typically Outstanding Query / Recovery |

### 5.8 Members / My Team

| Action | Who | Backend expectation |
| --- | --- | --- |
| Add/remove member | Superadmin only | Enforce permission |
| View team | Dept Admin | Read-only membership of own department |
| Availability toggle | Optional | Mock had available/away style controls in older UI; current staff table uses Active/On leave |

---

## 6. Suggested API surface (starter)

Not implemented yet — proposed contract for backend design.

### Auth

- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/change-password` (first login / normal change)
- `GET /auth/me`

### Cases

- `GET /cases?queue=&department=&status=&priority=&q=&page=`
- `POST /cases`
- `GET /cases/:id`
- `PATCH /cases/:id` (status, priority, assignee, notes)
- `POST /cases/:id/handoff`
- `POST /cases/bulk-assign`
- `GET /cases/export`

### Clients

- `GET /clients`
- `GET /clients/:id` (360)
- `GET /clients/verifications`
- `POST /clients/:id/verify` (approve/reject/request-info/review)

### Sales / inventory / projects

- `GET /sales`, `GET /sales/:id`
- `GET /inventory`
- `GET /projects`

### Collections

- `GET /collections/outstanding`
- `GET /collections/upcoming-dues`
- `GET /collections/receipts`
- `GET /collections/surcharges`
- `POST /collections/outstanding/:id/recovery-case`

### Organization

- `GET/POST/PATCH /departments`
- `GET/POST/PATCH /department-admins` (+ resend-invite, reset-password, disable/enable)
- `GET/POST/PATCH/DELETE /handoff-rules`
- `GET /staff` / `GET /members?department=`
- `POST/DELETE /members` (superadmin only)

### Configuration

- `CRUD /case-categories`
- `CRUD /sla-rules`
- `CRUD /notification-templates`

### Reporting / audit

- `GET /reports/cases`
- `GET /reports/department-performance`
- `GET /reports/collections`
- `GET /audit-logs`
- `GET /dashboard/overview` (KPI cards + chart series)

---

## 7. Pakistani CRM conventions used in demo data

Use these formats in fixtures/tests:

| Field | Format |
| --- | --- |
| CNIC | `35202-XXXXXXX-X` (5-7-1) |
| Mobile | `03XX-XXXXXXX` |
| Case / booking style nos | `BK-1003xxx` |
| Client reference | `CL-02xxx` |
| Receipt | `RP-10xxxxx` |
| Employee ID | `GG-xxxx` |
| Currency | PKR |
| Timezone | Asia/Karachi |

---

## 8. What is intentionally out of scope for this product

Do **not** rebuild these as primary modules (trimmed from the older Super Admin clone):

- HOD Management as a separate HR product
- Role & Permission matrix UI as a major module
- Task Management board/calendar product
- Projects & Investments admin product (beyond property/sales context)
- ERP Integration Status page
- Security & Access Logs as a major module

Access control should live in the **backend**, not a frontend permission matrix screen.

---

## 9. Frontend source map (for engineers)

| Area | File |
| --- | --- |
| Seed data, nav, enums, storage keys | `src/lib/super-admin-data.ts` |
| Main workspace + workflows | `src/components/super-admin-dashboard.tsx` |
| Sidebar / badges / chrome | `src/components/super-admin-ui.tsx` |
| Detail panels (case/client/sale) | `src/components/super-admin-details.tsx` |
| Create/edit/confirm dialogs | `src/components/super-admin-dialog.tsx` |
| Login + set password | `src/components/giga-login.tsx` |
| Routes | `src/routes/index.tsx`, `admin.tsx`, `dept.tsx` |
| Styles | `src/styles.css`, `src/dashboard.css` |

---

## 10. Backend build order (recommended)

### Done (staff workspace)

1. Auth + roles + department scoping  
2. Cases CRUD + queues + handoff rules enforcement  
3. Clients + verification  
4. Collections + create recovery case  
5. Departments / admins / members  
6. Configuration CRUD  
7. Sales/inventory read APIs (CRM mirror)  
8. Dashboard metrics + reports + audit log  

### Next (client portal & hardening) — see `docs/API.md` §14

9. **Client self portfolio** — `/me/portfolio`, `/me/dues`, `/me/receipts`, `/me/surcharges` (approved client only)  
10. Client cases & client-visible notes  
11. Outbound notifications (template delivery + optional inbox)  
12. Facial / identity verification (photo match → auto-approve or staff queue)  
13. Production hardening (Observe, rate limits, e2e, frontend cutover)

---

## 11. Acceptance checks for a first backend cut

- [ ] Superadmin and Department Admin can log in and land on correct home
- [ ] Department Admin first login requires password change
- [ ] Case queues return correct filtered sets
- [ ] Dept admin cannot hand off to blocked departments
- [ ] Collections endpoints/nav blocked for non-Finance/Recovery dept admins
- [ ] Only Superadmin can add/remove members
- [ ] Audit log records case status/handoff/admin disable actions
- [ ] Pakistani field formats validated on create/update
