-- Cognito identity link on workspace users.
-- Safe to re-run: adds column only when missing.

USE giga_workspace;

SET @col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'giga_workspace'
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'cognito_sub'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE users ADD COLUMN cognito_sub VARCHAR(36) NULL UNIQUE AFTER email',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
