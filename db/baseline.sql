-- Giga Group Client Services Workspace
-- Own database. Does not alter gigagroup.
-- src_* views are live reads of the ERP. Do not insert, update, or delete through them.
-- Workspace rows point at ERP ids (source_client_id, source_unitsale_id, ...) with no
-- foreign key, so this database cannot block or change ERP rows.

CREATE DATABASE IF NOT EXISTS giga_workspace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE giga_workspace;

-- ---------------------------------------------------------------------------
-- Live reads. ALGORITHM=TEMPTABLE keeps these views from writing back.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_projects AS
SELECT id, shortname, projectname, developer_id, area, city_id, country_id, active, created_at, updated_at
FROM gigagroup.projects;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_buildings AS
SELECT id, shortname, buildingname, project_id, active, created_at, updated_at
FROM gigagroup.buildings;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_floors AS
SELECT id, floorname, floorlevel, active, created_at, updated_at
FROM gigagroup.floors;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_unittypes AS
SELECT id, unittype, price, area, active
FROM gigagroup.unittypes;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_units AS
SELECT id, unitname, unittype_id, building_id, floor_id, unittypedetail, area, gross_area, price, active
FROM gigagroup.units;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_clients AS
SELECT id, person, email, mobile_number, work_phone, cnic, billing_address, sowodo, city_id, created_at, updated_at
FROM gigagroup.clients;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_unitsales AS
SELECT id, number, booking_date, unit_id, price, discount, net_price, status_id,
       current_outstanding, net_receipts, active, unitname, buildingname, created_at, updated_at
FROM gigagroup.unitsale;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_unitsale_contacts AS
SELECT id, unitsale_id, client_id, default_client, active
FROM gigagroup.unitsale_contact;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_receipts AS
SELECT id, unitsale_id, client_id, number, payment_date, amount_received,
       paymentmode_id, paymenttype_id, status_id, chq_no, created_at
FROM gigagroup.receipts;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_installments AS
SELECT id, unitsale_id, paymenttype_id, due_date, percentage
FROM gigagroup.installments;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_surcharges AS
SELECT id, unitsale_id, outstanding, charges, payable_date, charge_date, days
FROM gigagroup.unitsale_surcharges;

CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_surcharge_receipts AS
SELECT id, unitsale_id, client_id, number, payment_date, amount_received, status_id
FROM gigagroup.receipt_lds;

-- One live row per active buyer on a sale. This is the junction the workspace reads.
CREATE OR REPLACE ALGORITHM=TEMPTABLE SQL SECURITY INVOKER VIEW src_sale_context AS
SELECT
  us.id AS source_unitsale_id,
  uc.client_id AS source_client_id,
  c.person AS client_name,
  c.cnic,
  c.mobile_number,
  c.email,
  us.unit_id AS source_unit_id,
  u.unitname,
  u.floor_id AS source_floor_id,
  f.floorname,
  b.id AS source_building_id,
  b.buildingname,
  p.id AS source_project_id,
  p.projectname,
  us.number AS sale_number,
  us.booking_date,
  us.net_price,
  us.net_receipts,
  us.current_outstanding,
  us.status_id AS sale_status_id
FROM gigagroup.unitsale us
JOIN gigagroup.unitsale_contact uc ON uc.unitsale_id = us.id AND uc.active = 1
JOIN gigagroup.clients c ON c.id = uc.client_id
JOIN gigagroup.units u ON u.id = us.unit_id
JOIN gigagroup.buildings b ON b.id = u.building_id
JOIN gigagroup.projects p ON p.id = b.project_id
LEFT JOIN gigagroup.floors f ON f.id = u.floor_id;

-- ---------------------------------------------------------------------------
-- Workspace-owned tables
-- ---------------------------------------------------------------------------

CREATE TABLE roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY roles_code_unique (code)
) ENGINE=InnoDB;

CREATE TABLE departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  code VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY departments_code_unique (code)
) ENGINE=InnoDB;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cognito_sub VARCHAR(36) NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NULL,
  employee_code VARCHAR(20) NULL,
  face_image VARCHAR(255) NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_unique (email),
  UNIQUE KEY users_cognito_sub_unique (cognito_sub),
  UNIQUE KEY users_employee_code_unique (employee_code)
) ENGINE=InnoDB;

CREATE TABLE user_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  role_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY user_roles_pair_unique (user_id, role_id),
  KEY user_roles_role_id (role_id),
  CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT user_roles_role_fk FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE department_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY department_users_pair_unique (user_id, department_id),
  KEY department_users_department_id (department_id),
  CONSTRAINT department_users_user_fk FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT department_users_department_fk FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

-- Links a workspace login to an ERP client. source_client_id is gigagroup.clients.id.
CREATE TABLE client_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  source_client_id INT UNSIGNED NOT NULL,
  verification_status VARCHAR(40) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY client_links_source_unique (source_client_id),
  UNIQUE KEY client_links_user_unique (user_id),
  CONSTRAINT client_links_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE case_categories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  default_department_id BIGINT UNSIGNED NOT NULL,
  default_sla_hours INT UNSIGNED NOT NULL DEFAULT 48,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY case_categories_name_unique (name),
  CONSTRAINT case_categories_department_fk FOREIGN KEY (default_department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

CREATE TABLE sla_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  target_hours INT UNSIGNED NOT NULL,
  escalate_at_percent TINYINT UNSIGNED NOT NULL DEFAULT 80,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY sla_rules_priority_unique (priority)
) ENGINE=InnoDB;

CREATE TABLE handoff_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_department_id BIGINT UNSIGNED NOT NULL,
  to_department_id BIGINT UNSIGNED NOT NULL,
  is_allowed TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY handoff_rules_pair_unique (from_department_id, to_department_id),
  CONSTRAINT handoff_rules_from_fk FOREIGN KEY (from_department_id) REFERENCES departments (id),
  CONSTRAINT handoff_rules_to_fk FOREIGN KEY (to_department_id) REFERENCES departments (id)
) ENGINE=InnoDB;

-- Client service queries. ERP ids are stored, not copied.
CREATE TABLE cases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_no VARCHAR(30) NOT NULL,
  source_client_id INT UNSIGNED NULL,
  source_unitsale_id INT UNSIGNED NULL,
  source_unit_id INT UNSIGNED NULL,
  source_receipt_id INT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NOT NULL,
  assignee_user_id BIGINT UNSIGNED NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'New',
  priority VARCHAR(20) NOT NULL DEFAULT 'Normal',
  sla_band VARCHAR(20) NOT NULL DEFAULT 'On track',
  opened_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY cases_case_no_unique (case_no),
  KEY cases_department_status (department_id, status),
  KEY cases_source_client (source_client_id),
  KEY cases_source_unitsale (source_unitsale_id),
  KEY cases_assignee (assignee_user_id),
  CONSTRAINT cases_category_fk FOREIGN KEY (category_id) REFERENCES case_categories (id),
  CONSTRAINT cases_department_fk FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT cases_assignee_fk FOREIGN KEY (assignee_user_id) REFERENCES users (id),
  CONSTRAINT cases_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE case_notes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  client_visible TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY case_notes_case_id (case_id),
  CONSTRAINT case_notes_case_fk FOREIGN KEY (case_id) REFERENCES cases (id),
  CONSTRAINT case_notes_user_fk FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE case_handoffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  from_department_id BIGINT UNSIGNED NOT NULL,
  to_department_id BIGINT UNSIGNED NOT NULL,
  by_user_id BIGINT UNSIGNED NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY case_handoffs_case_id (case_id),
  CONSTRAINT case_handoffs_case_fk FOREIGN KEY (case_id) REFERENCES cases (id),
  CONSTRAINT case_handoffs_from_fk FOREIGN KEY (from_department_id) REFERENCES departments (id),
  CONSTRAINT case_handoffs_to_fk FOREIGN KEY (to_department_id) REFERENCES departments (id),
  CONSTRAINT case_handoffs_user_fk FOREIGN KEY (by_user_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE notification_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  template_key VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  subject VARCHAR(255) NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY notification_templates_key_unique (template_key)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  role_code VARCHAR(40) NULL,
  department_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  module VARCHAR(80) NOT NULL,
  subject_type VARCHAR(80) NULL,
  subject_id BIGINT UNSIGNED NULL,
  ip VARCHAR(45) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY audit_logs_created_at (created_at),
  KEY audit_logs_module (module)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Seed
-- Password for every seed login is Workspace@123 (bcrypt cost 12).
-- ---------------------------------------------------------------------------

INSERT INTO roles (id, code, name) VALUES
  (1, 'superadmin', 'Superadmin'),
  (2, 'department_admin', 'Department Admin'),
  (3, 'employee', 'Employee'),
  (4, 'client', 'Client');

INSERT INTO departments (id, name, code) VALUES
  (1, 'Finance', 'FIN'),
  (2, 'Customer Care', 'CCS'),
  (3, 'Recovery', 'RCV'),
  (4, 'Sales Support', 'SAL'),
  (5, 'Legal', 'LGL');

INSERT INTO sla_rules (name, priority, target_hours, escalate_at_percent) VALUES
  ('Low', 'Low', 72, 80),
  ('Normal', 'Normal', 48, 80),
  ('High', 'High', 24, 80),
  ('Urgent', 'Urgent', 8, 80);

INSERT INTO case_categories (id, name, default_department_id, default_sla_hours) VALUES
  (1, 'Cheque Issue', 1, 24),
  (2, 'Payment Not Reflected', 1, 24),
  (3, 'Outstanding Query', 3, 48),
  (4, 'Surcharge Waiver Request', 1, 48),
  (5, 'Reschedule Request', 2, 48),
  (6, 'Transfer Request', 4, 72),
  (7, 'Possession Request', 4, 72),
  (8, 'Document Request', 5, 72),
  (9, 'Other', 2, 48);

INSERT INTO handoff_rules (from_department_id, to_department_id, is_allowed)
SELECT a.id, b.id, 1
FROM departments a
JOIN departments b ON a.id <> b.id;

INSERT INTO notification_templates (name, template_key, channel, subject, body) VALUES
  ('Case opened', 'case_opened', 'Email', 'Case {case_no} opened', 'Dear {client_name}, your case {case_no} has been opened.'),
  ('Case waiting', 'case_waiting', 'SMS', NULL, '{client_name}, we need information on case {case_no}.');

-- Shared bcrypt hash of Workspace@123
SET @pwd = '$2y$12$CdckeeO/X0WTXWLohMo7juAhG4g1mj6mzpnPDwu5CBd5nvdzCanYu';

INSERT INTO users (id, name, email, password, phone, employee_code, face_image, must_change_password, status) VALUES
  (1, 'Muhammad Ali', 'muhammad.ali@gigagroup.pk', @pwd, '0300-0000001', NULL, NULL, 0, 'active'),
  (2, 'Hamza Qureshi', 'hamza.qureshi@gigagroup.pk', @pwd, '0300-0000002', 'GG-1001', NULL, 1, 'pending_first_login'),
  (3, 'Ayesha Khan', 'ayesha.khan@gigagroup.pk', @pwd, '0300-0000003', 'GG-1002', NULL, 0, 'active'),
  (4, 'Bilal Ahmed', 'bilal.ahmed@gigagroup.pk', @pwd, '0300-0000004', 'GG-1003', NULL, 0, 'active'),
  (5, 'Sana Malik', 'sana.malik@gigagroup.pk', @pwd, '0300-0000005', 'GG-1004', NULL, 0, 'active'),
  (6, 'Usman Raza', 'usman.raza@gigagroup.pk', @pwd, '0300-0000006', 'GG-1005', NULL, 0, 'active'),
  (7, 'Finance Staff One', 'fin.staff1@gigagroup.pk', @pwd, '0301-0000001', 'GG-1101', NULL, 0, 'active'),
  (8, 'Finance Staff Two', 'fin.staff2@gigagroup.pk', @pwd, '0301-0000002', 'GG-1102', NULL, 0, 'active'),
  (9, 'Care Staff One', 'ccs.staff1@gigagroup.pk', @pwd, '0301-0000003', 'GG-1201', NULL, 0, 'active'),
  (10, 'Care Staff Two', 'ccs.staff2@gigagroup.pk', @pwd, '0301-0000004', 'GG-1202', NULL, 0, 'active'),
  (11, 'Recovery Staff One', 'rcv.staff1@gigagroup.pk', @pwd, '0301-0000005', 'GG-1301', NULL, 0, 'active'),
  (12, 'Recovery Staff Two', 'rcv.staff2@gigagroup.pk', @pwd, '0301-0000006', 'GG-1302', NULL, 0, 'active'),
  (13, 'Sales Staff One', 'sal.staff1@gigagroup.pk', @pwd, '0301-0000007', 'GG-1401', NULL, 0, 'active'),
  (14, 'Sales Staff Two', 'sal.staff2@gigagroup.pk', @pwd, '0301-0000008', 'GG-1402', NULL, 0, 'active'),
  (15, 'Legal Staff One', 'lgl.staff1@gigagroup.pk', @pwd, '0301-0000009', 'GG-1501', NULL, 0, 'active'),
  (16, 'Legal Staff Two', 'lgl.staff2@gigagroup.pk', @pwd, '0301-0000010', 'GG-1502', NULL, 0, 'active'),
  (17, 'MUHAMMAD ASIF MASOOD', 'client.1@workspace.local', @pwd, NULL, NULL, NULL, 0, 'active'),
  (18, 'GULNAZ RAJA', 'client.2@workspace.local', @pwd, NULL, NULL, NULL, 0, 'active'),
  (19, 'AYSHA ASIM', 'client.3@workspace.local', @pwd, NULL, NULL, NULL, 0, 'active'),
  (20, 'ARIF KAREEM KHAN', 'client.4@workspace.local', @pwd, NULL, NULL, NULL, 0, 'active'),
  (21, 'SONIA SAJID', 'client.5@workspace.local', @pwd, NULL, NULL, NULL, 0, 'active');

INSERT INTO user_roles (user_id, role_id) VALUES
  (1, 1),
  (2, 2), (3, 2), (4, 2), (5, 2), (6, 2),
  (7, 3), (8, 3), (9, 3), (10, 3), (11, 3), (12, 3), (13, 3), (14, 3), (15, 3), (16, 3),
  (17, 4), (18, 4), (19, 4), (20, 4), (21, 4);

INSERT INTO department_users (user_id, department_id, is_admin) VALUES
  (2, 1, 1), (7, 1, 0), (8, 1, 0),
  (3, 2, 1), (9, 2, 0), (10, 2, 0),
  (4, 3, 1), (11, 3, 0), (12, 3, 0),
  (5, 4, 1), (13, 4, 0), (14, 4, 0),
  (6, 5, 1), (15, 5, 0), (16, 5, 0);

-- source_client_id matches gigagroup.clients.id for the first five buyers.
INSERT INTO client_links (user_id, source_client_id, verification_status) VALUES
  (17, 1, 'pending'),
  (18, 2, 'pending'),
  (19, 3, 'pending'),
  (20, 4, 'pending'),
  (21, 5, 'approved');

-- One real query tied to a live sale: client 5, sale 5, unit GOLDCREST 3802.
INSERT INTO cases (
  case_no, source_client_id, source_unitsale_id, source_unit_id,
  category_id, department_id, status, priority, sla_band, created_by
)
SELECT 'BK-1003001', 5, 5, us.unit_id, 2, 1, 'New', 'Normal', 'On track', 1
FROM gigagroup.unitsale us
WHERE us.id = 5;
