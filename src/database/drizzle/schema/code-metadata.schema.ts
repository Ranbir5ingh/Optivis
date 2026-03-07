import { pgTable, uuid, text, jsonb, timestamp, index, unique, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

/**
 * Code metadata manifest storage
 * 
 * Stores the EXACT output of build-time plugin without transformation
 * - One manifest per commit per project
 * - Immutable after creation
 */
export const codeMetadata = pgTable(
  'code_metadata',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // Version control
    commitSha: text('commit_sha').notNull(),
    branch: text('branch').notNull().default('main'),

    // Framework info
    framework: text('framework').notNull().default('nextjs'),

    // Manifest content (deterministic, immutable)
    // This is the EXACT structure from build plugin
    components: jsonb('components')
      .$type<Record<string, {
        name: string;
        file: string;
        exports: string[];
        lineStart?: number;
        lineEnd?: number;
      }>>()
      .notNull(),

    elements: jsonb('elements')
      .$type<Record<string, {
        componentId: string;
        type: string;
        jsxPath: string;
        attributes?: Record<string, string>;
        line?: number;
      }>>()
      .notNull(),

    // Metadata from build plugin
    metadata: jsonb('metadata')
      .$type<{
        totalComponents: number;
        totalElements: number;
        filesProcessed: number;
      }>()
      .notNull(),

    // Timestamps
    uploadedAt: timestamp('uploaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Prevent duplicate manifests for same commit
    unique('unique_manifest_per_commit').on(t.projectId, t.commitSha),

    // Fast lookup by project
    index('idx_metadata_project').on(t.projectId),

    // Fast lookup by commit
    index('idx_metadata_commit').on(t.projectId, t.commitSha),

    // Find latest manifest for project
    index('idx_metadata_latest').on(t.projectId, t.uploadedAt.desc()),
  ]
);

export type CodeMetadataRow = typeof codeMetadata.$inferSelect;
export type NewCodeMetadataRow = typeof codeMetadata.$inferInsert;