import { config as loadEnv } from 'dotenv';

// Load .env before AuthModule picks AUTH_PROVIDER for the JWT strategy
loadEnv();

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AwsCognitoExceptionFilter } from './common/filters/aws-cognito-exception.filter';

async function bootstrap() {
  process.env.TZ = process.env.TZ ?? 'Asia/Karachi';

  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const { httpAdapter } = app.get(HttpAdapterHost);

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });
  app.useGlobalFilters(new AwsCognitoExceptionFilter(httpAdapter));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Giga Workspace API')
    .setDescription(
      'Client Services Workspace — Postgres (Supabase) workspace DB; MySQL ERP via src_* views.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Giga Workspace API listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger: http://localhost:${port}/docs`);
  // eslint-disable-next-line no-console
  console.log(`Health:  http://localhost:${port}/api/v1/health`);
}

bootstrap();
