import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),
  TZ: Joi.string().default('Asia/Karachi'),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(3306),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().default('giga_workspace'),
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
