// src/database/drizzle/schema/daily-element-metrics.schema.ts

import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const dailyElementMetrics = pgTable(
  'daily_element_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    elementId: text('element_id').notNull(),
    componentId: text('component_id'),

    totalClicks: integer('total_clicks').notNull().default(0),
    impressions: integer('impressions').notNull().default(0),
    ctr: doublePrecision('ctr').notNull(),

    avgClickX: doublePrecision('avg_click_x'),
    avgClickY: doublePrecision('avg_click_y'),

    prevDayClicks: integer('prev_day_clicks').default(0),
    trendPercent: doublePrecision('trend_percent'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_element_metrics').on(t.projectId, t.date, t.elementId),
    index('idx_element_metrics_project_date').on(t.projectId, t.date),
    index('idx_element_metrics_element').on(t.projectId, t.elementId, t.date),
    index('idx_element_metrics_ctr').on(t.projectId, t.ctr.desc()),
  ],
);

export type DailyElementMetricsRow = typeof dailyElementMetrics.$inferSelect;
export type NewDailyElementMetricsRow = typeof dailyElementMetrics.$inferInsert;