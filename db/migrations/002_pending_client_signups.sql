-- Holds Cognito SignUp intent until email confirmation creates the workspace user.
USE giga_workspace;

CREATE TABLE IF NOT EXISTS pending_client_signups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  cnic VARCHAR(20) NOT NULL,
  source_client_id INT UNSIGNED NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY pending_client_signups_email_unique (email),
  KEY pending_client_signups_source (source_client_id)
) ENGINE=InnoDB;
