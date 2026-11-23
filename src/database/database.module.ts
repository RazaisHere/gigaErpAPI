import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    /** Workspace writes — Supabase PostgreSQL */
    TypeOrmModule.forRootAsync({
      name: 'workspace',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('database.url');
        const ssl = config.get<boolean>('database.ssl') !== false;

        if (url) {
          // Prefer session/direct port for TypeORM if pooler URL is given
          let connectionUrl = url;
          try {
            const parsed = new URL(url);
            if (parsed.port === '6543') {
              parsed.port = '5432';
              parsed.searchParams.delete('pgbouncer');
              connectionUrl = parsed.toString();
            }
          } catch {
            /* keep original */
          }

          return {
            type: 'postgres' as const,
            url: connectionUrl,
            ssl: ssl ? { rejectUnauthorized: false } : false,
            autoLoadEntities: true,
            synchronize: false,
          };
        }

        return {
          type: 'postgres' as const,
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          ssl: ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
        };
      },
    }),
    /** ERP / src_* live reads — MySQL */
    TypeOrmModule.forRootAsync({
      name: 'source',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('sourceDatabase.host'),
        port: config.get<number>('sourceDatabase.port'),
        username: config.get<string>('sourceDatabase.username'),
        password: config.get<string>('sourceDatabase.password'),
        database: config.get<string>('sourceDatabase.name'),
        autoLoadEntities: false,
        synchronize: false,
        timezone: '+05:00',
      }),
    }),
  ],
})
export class DatabaseModule {}
