// src/database/drizzle/schema/tracking-events.schema.ts

import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const trackingEvents = pgTable(
  'tracking_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id').notNull(),
    visitorId: text('visitor_id').notNull(),
    sessionId: text('session_id').notNull(),

    type: text('type').notNull(),

    componentId: text('component_id'),
    elementId: text('element_id'),

    path: text('path'),

    metadata: jsonb('metadata'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_tracking_project_time').on(t.projectId, t.occurredAt),

    index('idx_tracking_visitor').on(t.visitorId, t.occurredAt),

    index('idx_tracking_visitor_project').on(
      t.projectId,
      t.visitorId,
      t.occurredAt
    ),

    index('idx_tracking_session').on(t.sessionId, t.occurredAt),

    index('idx_tracking_session_project').on(
      t.projectId,
      t.sessionId,
      t.occurredAt
    ),

    index('idx_tracking_type').on(t.projectId, t.type, t.occurredAt),

    index('idx_tracking_rage_click')
      .on(t.projectId, t.type, t.occurredAt)
      .where(sql`${t.type} = 'rage_click'`),

    index('idx_tracking_exit_intent')
      .on(t.projectId, t.type, t.occurredAt)
      .where(sql`${t.type} = 'exit_intent'`),

    index('idx_tracking_form_events')
      .on(t.projectId, t.type, t.occurredAt)
      .where(
        sql`${t.type} IN ('form_start', 'form_abandon', 'form_submit', 'form_error')`
      ),

    index('idx_tracking_component_id').on(
      t.projectId,
      t.componentId,
      t.occurredAt
    ),

    index('idx_tracking_element_id').on(
      t.projectId,
      t.elementId,
      t.occurredAt
    ),

    index('idx_tracking_component_element').on(
      t.projectId,
      t.componentId,
      t.elementId,
      t.occurredAt
    ),

    index('idx_tracking_path').on(t.projectId, t.path, t.occurredAt),

    index('idx_tracking_metadata').on(t.metadata),

    index('idx_tracking_occurred_at').on(t.occurredAt),

    index('idx_tracking_received_at').on(t.receivedAt),

    index('idx_tracking_component_clicks')
      .on(t.projectId, t.componentId, t.type, t.occurredAt)
      .where(sql`${t.type} = 'click'`),

    index('idx_tracking_component_visibility')
      .on(t.projectId, t.componentId, t.type, t.occurredAt)
      .where(sql`${t.type} = 'visibility'`),

    index('idx_tracking_element_forms')
      .on(t.projectId, t.elementId, t.type, t.occurredAt)
      .where(
        sql`${t.type} IN ('form_start', 'form_abandon', 'form_submit', 'form_error')`
      ),
  ]
);

export type TrackingEventRow = typeof trackingEvents.$inferSelect;
export type NewTrackingEventRow = typeof trackingEvents.$inferInsert;