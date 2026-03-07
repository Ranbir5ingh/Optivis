// src/database/drizzle/schema/daily-performance-metrics.schema.ts

import {
  pgTable,
  uuid,
  timestamp,
  doublePrecision,
  integer,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const dailyPerformanceMetrics = pgTable(
  'daily_performance_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    avgLcp: doublePrecision('avg_lcp'),
    avgCls: doublePrecision('avg_cls'),
    avgInp: doublePrecision('avg_inp'),
    avgTtfb: doublePrecision('avg_ttfb'),

    lcpP50: doublePrecision('lcp_p50'),
    lcpP90: doublePrecision('lcp_p90'),
    lcpP99: doublePrecision('lcp_p99'),

    clsP50: doublePrecision('cls_p50'),
    clsP90: doublePrecision('cls_p90'),
    clsP99: doublePrecision('cls_p99'),

    inpP50: doublePrecision('inp_p50'),
    inpP90: doublePrecision('inp_p90'),
    inpP99: doublePrecision('inp_p99'),

    ttfbP50: doublePrecision('ttfb_p50'),
    ttfbP90: doublePrecision('ttfb_p90'),
    ttfbP99: doublePrecision('ttfb_p99'),

    lcpSampleSize: integer('lcp_sample_size').notNull().default(0),
    clsSampleSize: integer('cls_sample_size').notNull().default(0),
    inpSampleSize: integer('inp_sample_size').notNull().default(0),
    ttfbSampleSize: integer('ttfb_sample_size').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_performance').on(t.projectId, t.date),
    index('idx_daily_performance_project_date').on(t.projectId, t.date),
  ],
);

export type DailyPerformanceMetricsRow =
  typeof dailyPerformanceMetrics.$inferSelect;
export type NewDailyPerformanceMetricsRow =
  typeof dailyPerformanceMetrics.$inferInsert;
