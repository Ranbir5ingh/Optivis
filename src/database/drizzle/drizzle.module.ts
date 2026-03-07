// src/database/drizzle/drizzle.module.ts

import { Module } from '@nestjs/common';
import { DRIZZLE_DB } from './drizzle.tokens';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import { Pool } from 'pg';

@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<NodePgDatabase<typeof schema>> => {
        const connectionString = configService.get<string>('DATABASE_URL');

        if (!connectionString) {
          throw new Error('DATABASE_URL is not set');
        }

        const nodeEnv = configService.get<string>('NODE_ENV');
        const isProduction = nodeEnv === 'production';

        const pool = new Pool({
          connectionString,
          max: 20,
          min: 5,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
          statement_timeout: 30000,
          query_timeout: 30000,
          ssl: isProduction ? { rejectUnauthorized: false } : undefined,
        });

        pool.on('error', (error) => {
          console.error('[Database Pool Error]', error);
        });

        pool.on('connect', () => {
          console.log('[Database] Connection acquired');
        });

        pool.on('remove', () => {
          console.log('[Database] Connection removed');
        });

        return drizzle(pool, { schema });
      },
    },
  ],

  exports: [DRIZZLE_DB],
})
export class DrizzleModule {}