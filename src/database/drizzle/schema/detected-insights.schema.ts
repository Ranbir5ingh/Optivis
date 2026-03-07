// src/database/drizzle/schema/detected-insights.schema.ts

import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { sql } from 'drizzle-orm';
import { uniqueIndex } from 'drizzle-orm/pg-core';

export const detectedInsights = pgTable(
  'detected_insights',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    componentId: text('component_id'),
    elementId: text('element_id'),

    flag: text('flag').notNull(),
    severity: text('severity').notNull(),

    reason: text('reason').notNull(),

    value: doublePrecision('value'),
    baseline: doublePrecision('baseline'),
    percentageChange: doublePrecision('percentage_change'),

    confidence: doublePrecision('confidence'),
    zScore: doublePrecision('z_score'),
    pValue: doublePrecision('p_value'),

    confidenceMetadata: jsonb('confidence_metadata').$type<{
      model: 'statistical' | 'heuristic';
      pValue?: number;
      zScore?: number;
      effectSize?: number;
      sampleSizeWeight?: number;
    }>(),

    baselineType: text('baseline_type'),
    baselineWindowDays: doublePrecision('baseline_window_days'),

    comparison: jsonb('comparison').$type<{
      mode: 'historical' | 'heuristic' | 'cohort';
      lens: 'distribution' | 'trend' | 'statistical' | 'threshold';
      direction: 'increase' | 'decrease';
      baselinePercentile?: number;
      baselineFallbackReason?: string;
    }>(),

    context: jsonb('context').$type<{
      type: 'component' | 'element' | 'page' | 'funnel';
      path?: string;
      funnelId?: string;
      funnelStep?: number;
    }>(),

    status: text('status').notNull().default('new'),

    firstDetectedAt: timestamp('first_detected_at', {
      withTimezone: true,
    }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),

    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: text('acknowledged_by'),

    actedUponAt: timestamp('acted_upon_at', { withTimezone: true }),
    actedUponBy: text('acted_upon_by'),
    actionTaken: text('action_taken'),

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: text('resolved_by'),

    regressedAt: timestamp('regressed_at', { withTimezone: true }),
    regressedFrom: text('regressed_from'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('unique_active_insight')
      .on(t.projectId, t.flag, t.componentId, t.elementId)
      .where(sql`${t.status} != 'resolved'`),
    index('idx_detected_insights_project').on(
      t.projectId,
      t.firstDetectedAt.desc(),
    ),
    index('idx_detected_insights_component').on(
      t.componentId,
      t.firstDetectedAt.desc(),
    ),
    index('idx_detected_insights_flag').on(
      t.flag,
      t.projectId,
      t.firstDetectedAt.desc(),
    ),
    index('idx_detected_insights_severity').on(
      t.severity,
      t.projectId,
      t.firstDetectedAt.desc(),
    ),
    index('idx_detected_insights_status').on(
      t.projectId,
      t.status,
      t.firstDetectedAt.desc(),
    ),
  ],
);

export type DetectedInsightRow = typeof detectedInsights.$inferSelect;
export type NewDetectedInsightRow = typeof detectedInsights.$inferInsert;