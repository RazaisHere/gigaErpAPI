export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  timezone: process.env.TZ ?? 'Asia/Karachi',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME ?? 'giga_workspace',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  },
  auth: {
    provider: (process.env.AUTH_PROVIDER ?? 'nest') as 'nest' | 'cognito',
  },
  cognito: {
    region: process.env.COGNITO_REGION ?? process.env.AWS_REGION ?? 'ap-southeast-1',
    userPoolId: process.env.COGNITO_USER_POOL_ID ?? '',
    clientId: process.env.COGNITO_CLIENT_ID ?? '',
    clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
  },
});
