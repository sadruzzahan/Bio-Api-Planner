import { and, eq, gte, sql } from "drizzle-orm";
import { db, interventionsTable, biologicalStatesTable } from "@workspace/db";

interface BiologicalStateRow {
  userId: number;
  energyState: string;
  recoveryState: string;
  cognitiveState: string;
  stressState: string;
  metabolicState: string;
  readinessScore: number;
}

interface InterventionTemplate {
  type: string;
  title: string;
  action: string;
  rationale: string;
  payload: Record<string, unknown>;
}

function getInterventions(state: BiologicalStateRow): InterventionTemplate[] {
  const plans: InterventionTemplate[] = [];

  if (state.recoveryState === "low" || state.recoveryState === "critical") {
    plans.push({
      type: "exercise",
      title: "Light Recovery Session",
      action: "Schedule 20-minute Zone 2 walk or gentle yoga",
      rationale: `HRV-based recovery score is below baseline. High-intensity training would deepen recovery debt. Light movement promotes blood flow without additional stress.`,
      payload: { intensity: "zone2", durationMinutes: 20, type: "walk_or_yoga" },
    });
  }

  if (state.cognitiveState === "low" || state.cognitiveState === "critical") {
    const hour = new Date().getHours();
    if (hour >= 17) {
      plans.push({
        type: "light",
        title: "Blue-Light Blocking Protocol",
        action: "Enable blue-light filtering on all devices and dim overhead lights",
        rationale: `Cognitive load indicators are elevated. Evening blue light suppresses melatonin by up to 50%, worsening sleep onset and next-day cognitive performance.`,
        payload: { deviceFilter: true, targetLux: 50, startHour: 18, endHour: 23 },
      });
    }
  }

  if (state.stressState === "low" || state.stressState === "critical") {
    plans.push({
      type: "supplement",
      title: "Magnesium Glycinate Dose",
      action: "Take 400mg magnesium glycinate with water",
      rationale: `Elevated stress markers detected. Magnesium glycinate supports HPA axis regulation and reduces cortisol response. Evidence level: moderate (RCT-supported).`,
      payload: { supplement: "magnesium_glycinate", doseMg: 400, timing: "evening" },
    });
  }

  if (state.energyState === "low" || state.energyState === "critical") {
    plans.push({
      type: "nutrition",
      title: "Protein-Forward Meal",
      action: "Prioritize high-protein, low-glycemic meal within 2 hours",
      rationale: `Energy state is depressed. Stable blood glucose and adequate amino acid availability supports mitochondrial function and reduces afternoon energy dips.`,
      payload: { macroTarget: { proteinG: 40, carbsG: 30, fatG: 15 }, glycemicTarget: "low" },
    });
  }

  if (state.metabolicState === "low" || state.metabolicState === "critical") {
    plans.push({
      type: "calendar",
      title: "Post-Meal Walk",
      action: "Block 15 minutes for a brisk walk 30 minutes after next meal",
      rationale: `Glucose variability is above optimal range. Post-meal walks reduce glucose spikes by 20-30% via GLUT-4 muscle uptake without insulin. Schedule now before the window closes.`,
      payload: { durationMinutes: 15, delayAfterMealMinutes: 30 },
    });
  }

  return plans;
}

export async function planInterventions(userId: number, state: BiologicalStateRow) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const templates = getInterventions(state);
  const created = [];

  for (const tmpl of templates) {
    const existing = await db
      .select({ id: interventionsTable.id })
      .from(interventionsTable)
      .where(
        and(
          eq(interventionsTable.userId, userId),
          eq(interventionsTable.type, tmpl.type),
          eq(interventionsTable.title, tmpl.title),
          gte(interventionsTable.triggeredAt, startOfDay),
          eq(interventionsTable.status, "pending"),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      const [row] = await db
        .insert(interventionsTable)
        .values({ userId, ...tmpl, status: "pending", payload: tmpl.payload })
        .returning();
      created.push(row);
    }
  }

  return created;
}
