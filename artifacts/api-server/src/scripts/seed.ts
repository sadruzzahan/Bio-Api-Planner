import { db } from "@workspace/db";
import {
  usersTable,
  biometricReadingsTable,
  sleepSessionsTable,
  glucoseReadingsTable,
  activitySessionsTable,
  biologicalStatesTable,
  interventionsTable,
  mealsTable,
  supplementsTable,
  chatMessagesTable,
  integrationsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

function rng(seed: number) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function gaussian(r: () => number, mean: number, std: number) {
  const u1 = r();
  const u2 = r();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

async function seed() {
  console.log("Seeding database...");

  // Clean existing demo user data
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, "alex@biohack.io"));
  if (existing.length > 0) {
    const uid = existing[0]!.id;
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, uid));
    await db.delete(interventionsTable).where(eq(interventionsTable.userId, uid));
    await db.delete(biologicalStatesTable).where(eq(biologicalStatesTable.userId, uid));
    await db.delete(activitySessionsTable).where(eq(activitySessionsTable.userId, uid));
    await db.delete(glucoseReadingsTable).where(eq(glucoseReadingsTable.userId, uid));
    await db.delete(sleepSessionsTable).where(eq(sleepSessionsTable.userId, uid));
    await db.delete(biometricReadingsTable).where(eq(biometricReadingsTable.userId, uid));
    await db.delete(mealsTable).where(eq(mealsTable.userId, uid));
    await db.delete(supplementsTable).where(eq(supplementsTable.userId, uid));
    await db.delete(integrationsTable).where(eq(integrationsTable.userId, uid));
    await db.delete(usersTable).where(eq(usersTable.id, uid));
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: "alex@biohack.io",
      name: "Alex Chen",
      tier: "optimize",
      chronotype: "intermediate",
      primaryGoal: "performance",
      onboardedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      // Sentinel value so this seed account is never matched by a real Clerk
      // user (Clerk IDs always start with "user_"). Useful for local dev /
      // demos and lets us inspect or reseed without colliding with auth.
      clerkId: "__demo_seed__",
    })
    .returning();
  const userId = user!.id;
  console.log(`Created user id=${userId}`);

  const rand = rng(42);
  const DAYS = 30;
  const now = new Date();
  now.setHours(7, 0, 0, 0);

  // Supplements
  const suppData = [
    { name: "Magnesium Glycinate", doseMg: 400, timing: "evening", active: true, recommendedByAi: false, rationale: "Supports sleep quality and HPA axis regulation" },
    { name: "Vitamin D3+K2", doseMg: 5000, timing: "morning", active: true, recommendedByAi: false, rationale: "Immune function and bone density; deficiency common in knowledge workers" },
    { name: "Omega-3 (EPA/DHA)", doseMg: 2000, timing: "morning", active: true, recommendedByAi: false, rationale: "Cardiovascular health and neuroinflammation reduction" },
    { name: "Creatine Monohydrate", doseMg: 5000, timing: "post_workout", active: true, recommendedByAi: true, rationale: "Cognitive performance and power output; AI-recommended based on activity pattern" },
    { name: "Lion's Mane Extract", doseMg: 1000, timing: "morning", active: true, recommendedByAi: true, rationale: "NGF stimulation for cognitive enhancement; recommended based on cognitive state trend" },
  ];
  for (const s of suppData) {
    await db.insert(supplementsTable).values({ userId, ...s });
  }
  console.log("Seeded supplements");

  // Integrations
  const integrationData = [
    { provider: "whoop", category: "wearable", status: "connected" },
    { provider: "oura", category: "wearable", status: "connected" },
    { provider: "garmin", category: "wearable", status: "connected" },
    { provider: "dexcom", category: "cgm", status: "connected" },
    { provider: "levels", category: "cgm", status: "connected" },
    { provider: "apple_health", category: "platform", status: "connected" },
    { provider: "google_fit", category: "platform", status: "connected" },
    { provider: "cronometer", category: "nutrition", status: "connected" },
    { provider: "myfitnesspal", category: "nutrition", status: "connected" },
    { provider: "philips_hue", category: "smart_home", status: "connected" },
    { provider: "google_calendar", category: "calendar", status: "connected" },
    { provider: "amazon_alexa", category: "smart_home", status: "connected" },
  ];
  for (const i of integrationData) {
    await db.insert(integrationsTable).values({
      userId,
      ...i,
      connectedAt: i.status === "connected" ? new Date(Date.now() - Math.floor(rand() * 30) * 24 * 60 * 60 * 1000) : null,
      metadata: {},
    });
  }
  console.log("Seeded integrations");

  // 30 days of biometrics, sleep, glucose, activity
  const biometricRows = [];
  const sleepRows = [];
  const glucoseRows = [];
  const activityRows = [];

  // HRV baseline with weekly rhythm (higher mid-week, lower weekends due to alcohol/late nights)
  const hrvBaseline = 58;
  const activityTypes = ["strength_training", "zone2_cardio", "hiit", "yoga", "cycling", "run"];
  const mealContexts = ["fasting", "pre_meal", "post_meal", "ambient"];

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
    const dayOfWeek = dayDate.getDay(); // 0=Sun, 6=Sat
    const weeklyFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.88 : dayOfWeek === 5 ? 0.93 : 1.0;
    const longTermTrend = 1 + (DAYS - day) * 0.002; // slight improvement over 30 days

    // HRV (morning reading)
    const hrv = Math.max(30, gaussian(rand, hrvBaseline * weeklyFactor * longTermTrend, 6));
    const hrvTime = new Date(dayDate);
    hrvTime.setHours(6, Math.floor(rand() * 30), 0, 0);
    biometricRows.push({ userId, source: "whoop", metric: "hrv", value: hrv, unit: "ms", recordedAt: hrvTime });

    // Resting HR (inversely correlated with HRV)
    const rhr = Math.max(42, 75 - (hrv - 45) * 0.4 + gaussian(rand, 0, 3));
    const rhrTime = new Date(dayDate);
    rhrTime.setHours(6, Math.floor(rand() * 30) + 5, 0, 0);
    biometricRows.push({ userId, source: "whoop", metric: "resting_hr", value: rhr, unit: "bpm", recordedAt: rhrTime });

    // Steps (distributed through day, lower on rest days)
    const isRestDay = dayOfWeek === 0 || (dayOfWeek === 3 && rand() > 0.5);
    const targetSteps = isRestDay ? 4500 : 8500;
    const stepsPerHour = targetSteps / 14;
    for (let h = 7; h <= 20; h++) {
      const hourSteps = Math.max(0, gaussian(rand, stepsPerHour, stepsPerHour * 0.4));
      const stepTime = new Date(dayDate);
      stepTime.setHours(h, Math.floor(rand() * 59), 0, 0);
      biometricRows.push({ userId, source: "apple_health", metric: "steps", value: Math.round(hourSteps), unit: "steps", recordedAt: stepTime });
    }

    // SpO2
    const spo2 = Math.min(100, Math.max(94, gaussian(rand, 97.5, 0.8)));
    const spo2Time = new Date(dayDate);
    spo2Time.setHours(6, 45, 0, 0);
    biometricRows.push({ userId, source: "oura", metric: "spo2", value: parseFloat(spo2.toFixed(1)), unit: "%", recordedAt: spo2Time });

    // Sleep session
    const sleepBase = isRestDay ? 480 : weeklyFactor < 0.9 ? 400 : 450;
    const totalMin = Math.max(300, Math.round(gaussian(rand, sleepBase, 30)));
    const deepPct = 0.15 + rand() * 0.10;
    const remPct = 0.20 + rand() * 0.10;
    const lightPct = 1 - deepPct - remPct - 0.05;
    const deepMin = Math.round(totalMin * deepPct);
    const remMin = Math.round(totalMin * remPct);
    const lightMin = Math.round(totalMin * lightPct);
    const awakeMin = totalMin - deepMin - remMin - lightMin;
    const eff = parseFloat((82 + rand() * 15 - (weeklyFactor < 0.9 ? 8 : 0)).toFixed(1));

    const sleepDate = new Date(dayDate);
    sleepDate.setDate(sleepDate.getDate() - 1);
    const onsetHour = 22 + Math.floor(rand() * 2);
    const onsetMin = Math.floor(rand() * 59);
    const onsetAt = new Date(sleepDate);
    onsetAt.setHours(onsetHour, onsetMin, 0, 0);
    const wakeAt = new Date(onsetAt.getTime() + totalMin * 60 * 1000);

    sleepRows.push({
      userId,
      source: "oura",
      date: dayDate.toISOString().slice(0, 10),
      totalMinutes: totalMin,
      deepMinutes: deepMin,
      remMinutes: remMin,
      lightMinutes: lightMin,
      awakeMinutes: Math.max(0, awakeMin),
      efficiencyPct: Math.min(99, Math.max(60, eff)),
      onsetAt,
      wakeAt,
    });

    // Glucose readings (CGM: every 15-30 min, simulated as hourly with meal context)
    const mealHours = [7, 12, 18]; // breakfast, lunch, dinner
    for (let h = 6; h <= 23; h += 1) {
      const nearMeal = mealHours.some((mh) => Math.abs(h - mh) <= 1);
      const postMeal = mealHours.some((mh) => h === mh + 1);
      const baseline = 88 + rand() * 10;
      const mealSpike = postMeal ? 25 + rand() * 20 : 0;
      const glucoseVal = Math.max(70, Math.min(180, baseline + mealSpike + gaussian(rand, 0, 4)));
      const mealCtx = postMeal ? "post_meal" : nearMeal ? "pre_meal" : h < 8 ? "fasting" : "ambient";

      for (let m = 0; m < 60; m += (postMeal ? 15 : 30)) {
        const gTime = new Date(dayDate);
        gTime.setHours(h, m, 0, 0);
        glucoseRows.push({
          userId,
          source: "dexcom",
          valueMgdl: parseFloat(Math.max(70, Math.min(180, glucoseVal + gaussian(rand, 0, 2))).toFixed(1)),
          mealContext: mealCtx,
          recordedAt: gTime,
        });
      }
    }

    // Activity (not every day)
    if (!isRestDay || rand() > 0.7) {
      const actType = activityTypes[Math.floor(rand() * activityTypes.length)]!;
      const duration = actType.includes("yoga") ? 45 : actType.includes("hiit") ? 30 : 50 + Math.floor(rand() * 30);
      const intensity = actType.includes("zone2") ? "low" : actType.includes("hiit") ? "high" : actType.includes("yoga") ? "low" : "moderate";
      const strain = intensity === "high" ? 14 + rand() * 7 : intensity === "moderate" ? 8 + rand() * 6 : 3 + rand() * 5;
      const avgHR = intensity === "high" ? 155 + Math.floor(rand() * 20) : intensity === "moderate" ? 130 + Math.floor(rand() * 20) : 100 + Math.floor(rand() * 20);
      const calories = Math.round(duration * (intensity === "high" ? 12 : intensity === "moderate" ? 8 : 5));

      const actTime = new Date(dayDate);
      actTime.setHours(7 + Math.floor(rand() * 4), 0, 0, 0);
      activityRows.push({
        userId,
        source: "whoop",
        type: actType,
        durationMinutes: duration,
        intensity,
        strainScore: parseFloat(strain.toFixed(1)),
        avgHeartRate: avgHR,
        calories,
        recordedAt: actTime,
      });
    }
  }

  // Insert in batches
  for (let i = 0; i < biometricRows.length; i += 500) {
    await db.insert(biometricReadingsTable).values(biometricRows.slice(i, i + 500));
  }
  console.log(`Seeded ${biometricRows.length} biometric readings`);

  await db.insert(sleepSessionsTable).values(sleepRows);
  console.log(`Seeded ${sleepRows.length} sleep sessions`);

  for (let i = 0; i < glucoseRows.length; i += 500) {
    await db.insert(glucoseReadingsTable).values(glucoseRows.slice(i, i + 500));
  }
  console.log(`Seeded ${glucoseRows.length} glucose readings`);

  await db.insert(activitySessionsTable).values(activityRows);
  console.log(`Seeded ${activityRows.length} activity sessions`);

  // 5 recent meals
  const mealData = [
    { description: "Scrambled eggs with spinach and avocado", glycemicImpact: "low", calories: 520, carbsG: 12, proteinG: 38, fatG: 34, source: "cronometer" },
    { description: "Greek yogurt with blueberries and walnuts", glycemicImpact: "low", calories: 380, carbsG: 28, proteinG: 22, fatG: 18, source: "cronometer" },
    { description: "Grilled salmon with roasted vegetables and quinoa", glycemicImpact: "medium", calories: 650, carbsG: 45, proteinG: 52, fatG: 22, source: "manual" },
    { description: "Chicken breast with sweet potato and broccoli", glycemicImpact: "medium", calories: 580, carbsG: 48, proteinG: 55, fatG: 12, source: "cronometer" },
    { description: "Protein shake with banana and almond butter", glycemicImpact: "medium", calories: 440, carbsG: 42, proteinG: 35, fatG: 14, source: "myfitnesspal" },
  ];
  for (let i = 0; i < mealData.length; i++) {
    const loggedAt = new Date(Date.now() - (mealData.length - i) * 4 * 60 * 60 * 1000);
    await db.insert(mealsTable).values({ userId, ...mealData[i]!, loggedAt });
  }
  console.log("Seeded meals");

  // 5 recent interventions
  const interventionData = [
    {
      type: "exercise",
      title: "Light Recovery Session",
      action: "Schedule 20-minute Zone 2 walk",
      rationale: "HRV dropped 18% below 30-day baseline. Active recovery promotes adaptation.",
      status: "executed",
      payload: { intensity: "zone2", durationMinutes: 20 },
    },
    {
      type: "supplement",
      title: "Magnesium Glycinate Dose",
      action: "Take 400mg magnesium glycinate with water",
      rationale: "Elevated cortisol indicators. Magnesium supports HPA axis regulation.",
      status: "executed",
      payload: { supplement: "magnesium_glycinate", doseMg: 400 },
    },
    {
      type: "light",
      title: "Blue-Light Blocking Protocol",
      action: "Enable blue-light filtering on all devices",
      rationale: "Evening screen exposure detected. Preserving melatonin for sleep onset.",
      status: "pending",
      payload: { deviceFilter: true, targetLux: 50 },
    },
    {
      type: "nutrition",
      title: "Protein-Forward Meal",
      action: "Prioritize high-protein, low-glycemic meal within 2 hours",
      rationale: "Post-workout anabolic window identified. Protein synthesis window optimal.",
      status: "dismissed",
      payload: { macroTarget: { proteinG: 40, carbsG: 25 } },
    },
    {
      type: "calendar",
      title: "Post-Meal Walk",
      action: "Block 15 minutes for a brisk walk after lunch",
      rationale: "Glucose spike detected at 138 mg/dL post-meal. Walking reduces spike 25%.",
      status: "pending",
      payload: { durationMinutes: 15, delayAfterMealMinutes: 30 },
    },
  ];
  for (let i = 0; i < interventionData.length; i++) {
    const triggeredAt = new Date(Date.now() - (interventionData.length - i) * 6 * 60 * 60 * 1000);
    const executedAt = interventionData[i]!.status === "executed" ? new Date(triggeredAt.getTime() + 30 * 60 * 1000) : null;
    await db.insert(interventionsTable).values({
      userId,
      ...interventionData[i]!,
      triggeredAt,
      executedAt,
    });
  }
  console.log("Seeded interventions");

  // 10 chat messages
  const chatData = [
    { role: "user", content: "What does my HRV trend tell me about my recovery this week?" },
    { role: "assistant", content: "Your HRV has averaged 58ms this week, which is 4% above your 30-day baseline of 55.8ms — a solid recovery signal. The Tuesday spike to 67ms after your rest day confirms your recovery protocol is working. The slight dip Friday (52ms) correlates with your late sleep onset that night. Overall trajectory: trending positive." },
    { role: "user", content: "Should I do a hard workout today?" },
    { role: "assistant", content: "Based on your current readiness score of 74/100 and HRV sitting at 61ms (11% above baseline), you have a green light for moderate-to-high intensity. Your sleep efficiency was 87% last night with 95 minutes of deep sleep — excellent recovery substrate. I'd recommend Zone 3-4 work for 45-60 minutes. Avoid maximal effort; your glucose variability is slightly elevated at 14% CV today." },
    { role: "user", content: "My glucose has been spiking after lunch. Any ideas?" },
    { role: "assistant", content: "Your post-lunch spikes are averaging 142 mg/dL, peaking 65-80 minutes post-meal — a classic carbohydrate-dominant meal response. Three evidence-based interventions: 1) 15-minute walk immediately after eating (reduces spike 20-30% via GLUT-4), 2) lead with protein and fiber before carbohydrates, 3) consider swapping white rice for legumes or quinoa. Your fasting glucose of 88 mg/dL is excellent, so this is purely a post-prandial pattern to optimize." },
    { role: "user", content: "How is my sleep quality compared to last month?" },
    { role: "assistant", content: "Comparing your last 7 days to days 8-30: deep sleep improved from 68 to 84 minutes (+24%), sleep efficiency jumped from 81% to 87%. REM is holding steady around 95 minutes. The main driver appears to be your consistent 10:15pm sleep onset this week vs. the erratic 11-midnight range earlier in the month. The magnesium glycinate you started 12 days ago likely contributed to the deep sleep increase." },
    { role: "user", content: "What's my current biological state?", },
    { role: "assistant", content: "Biological state snapshot right now: Recovery is GOOD (HRV 8% above baseline), Energy is GOOD (87% sleep efficiency last night), Cognitive is OPTIMAL (low glucose variability + excellent sleep), Stress is MODERATE (resting HR trending slightly elevated at 58bpm vs 55bpm 7-day avg), Metabolic is GOOD (glucose averaging 91 mg/dL, 89% time-in-range). Composite readiness: 76/100. Recommendation: This is a high-performance window — schedule demanding cognitive work in the next 4-6 hours." },
    { role: "user", content: "Should I add any new supplements?" },
    { role: "assistant", content: "Given your current stack and biometric patterns, one addition stands out: Ashwagandha (300-600mg KSM-66 extract, evening). Your stress state trends moderate-to-low on high-strain training days, and your cortisol-proxy metrics (HRV morning dip + resting HR elevation) suggest HPA axis overactivation. Ashwagandha has the strongest RCT evidence among adaptogens for reducing cortisol 15-30% in trained athletes. Your magnesium and omega-3 coverage is solid. Nothing else in the evidence tier I'd add without more data." },
  ];
  for (let i = 0; i < chatData.length; i++) {
    const createdAt = new Date(Date.now() - (chatData.length - i) * 20 * 60 * 1000);
    await db.insert(chatMessagesTable).values({ userId, ...chatData[i]!, createdAt });
  }
  console.log("Seeded chat messages");

  console.log("✅ Seed complete — demo user id:", userId);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
