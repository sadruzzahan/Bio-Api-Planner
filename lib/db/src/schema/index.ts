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

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  tier: text("tier").notNull().default("optimize"),
  chronotype: text("chronotype").notNull().default("intermediate"),
  primaryGoal: text("primary_goal").notNull().default("performance"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const biometricReadingsTable = pgTable(
  "biometric_readings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
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
  }),
);

export const sleepSessionsTable = pgTable(
  "sleep_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
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
    userId: integer("user_id").notNull().references(() => usersTable.id),
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
    userId: integer("user_id").notNull().references(() => usersTable.id),
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
  userId: integer("user_id").notNull().references(() => usersTable.id),
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
  userId: integer("user_id").notNull().references(() => usersTable.id),
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
  userId: integer("user_id").notNull().references(() => usersTable.id),
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
  userId: integer("user_id").notNull().references(() => usersTable.id),
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
    userId: integer("user_id").notNull().references(() => usersTable.id),
    role: text("role").notNull(),
    content: text("content").notNull(),
    contextSnapshot: jsonb("context_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("chat_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export const integrationsTable = pgTable("integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("disconnected"),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({}),
});

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
