import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  date,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    clerkId: text("clerk_id").unique().notNull(),
    // Field-level encryption for the user's email address. The plaintext email
    // is NEVER persisted — `emailEncrypted` is the AES-256-GCM ciphertext
    // (key from APP_ENCRYPTION_KEY secret) and `emailLookup` is a
    // deterministic HMAC-SHA-256 used as the unique-search key when callers
    // need to look a user up by email without holding the decryption key.
    emailEncrypted: text("email_encrypted").notNull(),
    emailLookup: text("email_lookup").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull().default("user"),
    tier: text("tier").notNull().default("basic"),
    chronotype: text("chronotype").notNull().default("intermediate"),
    primaryGoal: text("primary_goal").notNull().default("performance"),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletionRequestedAt: timestamp("deletion_requested_at", { withTimezone: true }),
  },
  (t) => ({
    deletedAtIdx: index("users_deleted_at_idx").on(t.deletedAt),
  }),
);

export const biometricReadingsTable = pgTable(
  "biometric_readings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    metric: text("metric").notNull(),
    value: doublePrecision("value").notNull(),
    unit: text("unit").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    userMetricRecordedIdx: index("biometric_user_metric_recorded_idx").on(
      t.userId,
      t.metric,
      t.recordedAt,
    ),
    // Natural-key uniqueness: a single (user, source, metric, instant)
    // tuple may only appear once. Provider sync workers rely on this for
    // idempotent INSERT ... ON CONFLICT DO NOTHING ingestion. See
    // migration 0005 for the actual unique index DDL.
    naturalKeyUq: index("biometric_natural_key_uq").on(
      t.userId,
      t.source,
      t.metric,
      t.recordedAt,
    ),
  }),
);

export const sleepSessionsTable = pgTable(
  "sleep_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    date: date("date").notNull(),
    totalMinutes: integer("total_minutes").notNull(),
    deepMinutes: integer("deep_minutes").notNull(),
    remMinutes: integer("rem_minutes").notNull(),
    lightMinutes: integer("light_minutes").notNull(),
    awakeMinutes: integer("awake_minutes").notNull(),
    efficiencyPct: doublePrecision("efficiency_pct").notNull(),
    onsetAt: timestamp("onset_at", { withTimezone: true }).notNull(),
    wakeAt: timestamp("wake_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    userDateIdx: index("sleep_user_date_idx").on(t.userId, t.date),
  }),
);

export const glucoseReadingsTable = pgTable(
  "glucose_readings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("cgm"),
    valueMgdl: doublePrecision("value_mgdl").notNull(),
    mealContext: text("meal_context").notNull().default("ambient"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    userRecordedIdx: index("glucose_user_recorded_idx").on(t.userId, t.recordedAt),
  }),
);

export const activitySessionsTable = pgTable(
  "activity_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    type: text("type").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    intensity: text("intensity").notNull(),
    strainScore: doublePrecision("strain_score").notNull(),
    avgHeartRate: integer("avg_heart_rate"),
    calories: integer("calories"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    userRecordedIdx: index("activity_user_recorded_idx").on(t.userId, t.recordedAt),
  }),
);

export const biologicalStatesTable = pgTable("biological_states", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  energyState: text("energy_state").notNull(),
  recoveryState: text("recovery_state").notNull(),
  cognitiveState: text("cognitive_state").notNull(),
  stressState: text("stress_state").notNull(),
  metabolicState: text("metabolic_state").notNull(),
  readinessScore: integer("readiness_score").notNull(),
  notes: text("notes"),
});

export const interventionsTable = pgTable("interventions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  action: text("action").notNull(),
  rationale: text("rationale").notNull(),
  status: text("status").notNull().default("pending"),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  payload: jsonb("payload").notNull().default({}),
});

export const mealsTable = pgTable("meals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull(),
  description: text("description").notNull(),
  glycemicImpact: text("glycemic_impact").notNull().default("medium"),
  calories: integer("calories").notNull(),
  carbsG: doublePrecision("carbs_g").notNull(),
  proteinG: doublePrecision("protein_g").notNull(),
  fatG: doublePrecision("fat_g").notNull(),
  source: text("source").notNull().default("manual"),
});

export const supplementsTable = pgTable("supplements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  doseMg: doublePrecision("dose_mg").notNull(),
  timing: text("timing").notNull(),
  active: boolean("active").notNull().default(true),
  recommendedByAi: boolean("recommended_by_ai").notNull().default(false),
  rationale: text("rationale"),
});

export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    contextSnapshot: jsonb("context_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("chat_user_created_idx").on(t.userId, t.createdAt),
  }),
);

/**
 * One row per (user, provider) connection. Tokens are encrypted at the
 * application layer with AES-256-GCM (see api-server/lib/encryption.ts).
 *
 * Status state machine:
 *   disconnected   - never connected, or revoked
 *   connecting     - OAuth started, awaiting callback
 *   connected      - active; tokens valid, syncs running
 *   needs_reauth   - refresh token rejected; user must re-do OAuth
 *   error          - last sync failed for a non-auth reason; will retry
 */
export const integrationsTable = pgTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("disconnected"),
    scopes: text("scopes").array(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    externalUserId: text("external_user_id"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => ({
    userProviderIdx: index("integrations_user_provider_idx").on(t.userId, t.provider),
    nextSyncIdx: index("integrations_next_sync_idx").on(t.nextSyncAt),
  }),
);

/**
 * One row per sync attempt for observability. The Background Jobs system
 * (Task #11) will eventually own this — for now the in-process scheduler
 * writes here directly. Status: 'running' | 'success' | 'failed'.
 */
export const syncRunsTable = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    integrationId: integer("integration_id")
      .notNull()
      .references(() => integrationsTable.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull().default("scheduled"), // 'initial' | 'scheduled' | 'manual' | 'webhook'
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull().default("running"),
    recordsIngested: integer("records_ingested").notNull().default(0),
    error: text("error"),
  },
  (t) => ({
    integrationStartedIdx: index("sync_runs_integration_started_idx").on(
      t.integrationId,
      t.startedAt,
    ),
  }),
);

// --- Compliance / Privacy tables ----------------------------------------------

export const consentRecordsTable = pgTable(
  "consent_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    document: text("document").notNull(), // 'tos' | 'privacy' | 'disclaimer' | 'cookies'
    version: text("version").notNull(),
    accepted: boolean("accepted").notNull().default(true),
    categories: jsonb("categories"), // for cookie consent: { essential, analytics, marketing }
    ip: text("ip"),
    userAgent: text("user_agent"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userDocIdx: index("consent_user_doc_idx").on(t.userId, t.document),
  }),
);

// Append-only audit log. No UPDATE/DELETE routes are exposed for this table.
export const auditLogTable = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    actorId: integer("actor_id").references(() => usersTable.id, { onDelete: "set null" }),
    action: text("action").notNull(), // 'create' | 'update' | 'delete' | 'export' | 'consent.accept' | ...
    entity: text("entity").notNull(), // table-ish name: 'biometric' | 'sleep' | 'chat' | 'user' | ...
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("audit_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export const insertBiometricReadingSchema = createInsertSchema(biometricReadingsTable).omit({ id: true });
export type BiometricReading = typeof biometricReadingsTable.$inferSelect;
export type InsertBiometricReading = z.infer<typeof insertBiometricReadingSchema>;

export const insertSleepSessionSchema = createInsertSchema(sleepSessionsTable).omit({ id: true });
export type SleepSession = typeof sleepSessionsTable.$inferSelect;

export const insertGlucoseReadingSchema = createInsertSchema(glucoseReadingsTable).omit({ id: true });
export type GlucoseReading = typeof glucoseReadingsTable.$inferSelect;

export const insertActivitySessionSchema = createInsertSchema(activitySessionsTable).omit({ id: true });
export type ActivitySession = typeof activitySessionsTable.$inferSelect;

export const insertBiologicalStateSchema = createInsertSchema(biologicalStatesTable).omit({ id: true, computedAt: true });
export type BiologicalState = typeof biologicalStatesTable.$inferSelect;

export const insertInterventionSchema = createInsertSchema(interventionsTable).omit({ id: true, triggeredAt: true });
export type Intervention = typeof interventionsTable.$inferSelect;

export const insertMealSchema = createInsertSchema(mealsTable).omit({ id: true });
export type Meal = typeof mealsTable.$inferSelect;
export type InsertMeal = z.infer<typeof insertMealSchema>;

export const insertSupplementSchema = createInsertSchema(supplementsTable).omit({ id: true });
export type Supplement = typeof supplementsTable.$inferSelect;
export type InsertSupplement = z.infer<typeof insertSupplementSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({ id: true, createdAt: true });
export type ChatMessage = typeof chatMessagesTable.$inferSelect;

export const insertIntegrationSchema = createInsertSchema(integrationsTable).omit({ id: true });
export type Integration = typeof integrationsTable.$inferSelect;

export const insertSyncRunSchema = createInsertSchema(syncRunsTable).omit({ id: true, startedAt: true });
export type SyncRun = typeof syncRunsTable.$inferSelect;

export const insertConsentRecordSchema = createInsertSchema(consentRecordsTable).omit({ id: true, acceptedAt: true });
export type ConsentRecord = typeof consentRecordsTable.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;

export const insertAuditLogSchema = createInsertSchema(auditLogTable).omit({ id: true, createdAt: true });
export type AuditLogEntry = typeof auditLogTable.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;
