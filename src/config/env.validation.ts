import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  TZ: Joi.string().default('Asia/Karachi'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),

  // Workspace = Postgres (Supabase)
  DATABASE_URL: Joi.string().required(),
  DB_SSL: Joi.string().valid('true', 'false').optional(),

  // Source = MySQL (ERP / src_* views live here)
  SOURCE_DB_HOST: Joi.string().required(),
  SOURCE_DB_PORT: Joi.number().default(3306),
  SOURCE_DB_USER: Joi.string().required(),
  SOURCE_DB_PASSWORD: Joi.string().allow('').required(),
  SOURCE_DB_NAME: Joi.string().default('giga_workspace'),

  // Optional MySQL creds still used by migrate-mysql-to-supabase.mjs
  DB_HOST: Joi.string().optional().allow(''),
  DB_PORT: Joi.number().optional(),
  DB_USER: Joi.string().optional().allow(''),
  DB_PASSWORD: Joi.string().optional().allow(''),
  DB_NAME: Joi.string().optional().allow(''),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  AUTH_PROVIDER: Joi.string().valid('nest', 'cognito').default('nest'),
  COGNITO_REGION: Joi.string().when('AUTH_PROVIDER', {
    is: 'cognito',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  COGNITO_USER_POOL_ID: Joi.string().when('AUTH_PROVIDER', {
    is: 'cognito',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  COGNITO_CLIENT_ID: Joi.string().when('AUTH_PROVIDER', {
    is: 'cognito',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
  COGNITO_CLIENT_SECRET: Joi.string().optional().allow(''),
  AWS_REGION: Joi.string().optional().allow(''),
  AWS_ACCESS_KEY_ID: Joi.string().optional().allow(''),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional().allow(''),
});
