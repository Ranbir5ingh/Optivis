// src/database/drizzle/schema/hourly-element-metrics.schema.ts

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

export const hourlyElementMetrics = pgTable(
  'hourly_element_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    hour: timestamp('hour', { withTimezone: true }).notNull(),
    elementId: text('element_id').notNull(),
    componentId: text('component_id'),

    impressions: integer('impressions').notNull().default(0),
    clicks: integer('clicks').notNull().default(0),
    ctr: doublePrecision('ctr').notNull().default(0),

    avgClickX: doublePrecision('avg_click_x'),
    avgClickY: doublePrecision('avg_click_y'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_hourly_element').on(t.projectId, t.hour, t.elementId),
    index('idx_hourly_element_project_hour').on(t.projectId, t.hour),
    index('idx_hourly_element_id').on(t.projectId, t.elementId, t.hour),
  ]
);

export type HourlyElementMetricsRow = typeof hourlyElementMetrics.$inferSelect;
export type NewHourlyElementMetricsRow = typeof hourlyElementMetrics.$inferInsert;