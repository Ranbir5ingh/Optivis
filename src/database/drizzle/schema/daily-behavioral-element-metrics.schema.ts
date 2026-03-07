// src/database/drizzle/schema/daily-behavioral-element-metrics.schema.ts

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

export const dailyBehavioralElementMetrics = pgTable(
  'daily_behavioral_element_metrics',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    date: timestamp('date', { withTimezone: true }).notNull(),

    elementId: text('element_id').notNull(),
    componentId: text('component_id'),

    rageClickCount: integer('rage_click_count').notNull().default(0),
    rageClickSessions: integer('rage_click_sessions').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('unique_daily_behavioral_element').on(
      t.projectId,
      t.date,
      t.elementId,
    ),
    index('idx_behavioral_element_project_date').on(t.projectId, t.date),
    index('idx_behavioral_element_component').on(
      t.projectId,
      t.componentId,
      t.date,
    ),
  ],
);

export type DailyBehavioralElementMetricsRow =
  typeof dailyBehavioralElementMetrics.$inferSelect;
export type NewDailyBehavioralElementMetricsRow =
  typeof dailyBehavioralElementMetrics.$inferInsert;