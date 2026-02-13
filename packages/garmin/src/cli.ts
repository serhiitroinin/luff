#!/usr/bin/env bun
import { Command } from "commander";
import {
  getSecret,
  hasSecret,
  deleteSecret,
  error as showError,
} from "@luff/shared";
import * as out from "@luff/shared/output";
import { login, importTokens, getValidAccessToken } from "./auth.ts";
import { garminProvider } from "./providers/garmin.ts";
import type { FitnessProvider } from "./types.ts";

const TOOL = "garmin";
const provider: FitnessProvider = garminProvider;

// ── Formatting helpers ───────────────────────────────────────────

function secToH(s: number): string {
  const h = Math.round((s / 3600) * 10) / 10;
  return `${h}h`;
}

function secToMin(s: number): string {
  return `${Math.round(s / 60)} min`;
}

function secToHMS(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function km(meters: number | null): string {
  if (meters == null) return "\u2014";
  return `${(meters / 1000).toFixed(1)} km`;
}

function n(v: number | null, decimals = 0): string {
  if (v == null) return "\u2014";
  return decimals > 0 ? v.toFixed(decimals) : String(Math.round(v));
}

function mps(speed: number | null): string {
  if (speed == null) return "\u2014";
  // m/s → min/km pace
  if (speed <= 0) return "\u2014";
  const paceSeconds = 1000 / speed;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program.name("garmin").description("Garmin Connect health data CLI").version("0.2.0");

// ── Auth commands ────────────────────────────────────────────────

program
  .command("login <email> <password>")
  .description("Login to Garmin Connect (SSO + OAuth)")
  .action(async (email: string, password: string) => {
    await login(email, password);
  });

program
  .command("import-tokens [dir]")
  .description("Import tokens from garth/garmy directory (default: ~/.garmy)")
  .action((dir?: string) => {
    importTokens(dir ?? `${process.env.HOME}/.garmy`);
  });

program
  .command("status")
  .description("Check auth status")
  .action(async () => {
    if (!hasSecret(TOOL, "oauth1-token")) {
      out.info("Not logged in. Run: garmin login <email> <password>");
      out.info("Or import existing tokens: garmin import-tokens");
      return;
    }

    const expiresAt = parseInt(getSecret(TOOL, "expires-at") ?? "0", 10);
    const refreshExpiresAt = parseInt(getSecret(TOOL, "refresh-expires-at") ?? "0", 10);
    const now = Math.floor(Date.now() / 1000);

    const displayName = getSecret(TOOL, "display-name") ?? "not cached yet";

    console.log(`User:    ${displayName}`);

    if (now >= expiresAt) {
      console.log("Token:   expired (will auto-refresh on next API call)");
    } else {
      const hrs = Math.round((expiresAt - now) / 3600 * 10) / 10;
      console.log(`Token:   valid (${hrs}h remaining)`);
    }

    if (now >= refreshExpiresAt) {
      console.log("Refresh: expired (re-login required)");
    } else {
      const days = Math.round((refreshExpiresAt - now) / 86400 * 10) / 10;
      console.log(`Refresh: valid (${days}d remaining)`);
    }

    out.info("Credentials: macOS Keychain (service: luff-garmin)");
  });

program
  .command("logout")
  .description("Remove all Garmin credentials from Keychain")
  .action(() => {
    for (const key of [
      "oauth1-token", "oauth1-secret", "access-token", "refresh-token",
      "expires-at", "refresh-expires-at", "consumer-key", "consumer-secret",
      "display-name", "profile-pk",
    ]) {
      deleteSecret(TOOL, key);
    }
    out.success("All Garmin credentials removed from Keychain.");
  });

// ── Existing data commands ──────────────────────────────────────

program
  .command("training-readiness [days]")
  .alias("tr")
  .description("Training readiness score + factors")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.trainingReadiness(d);
    out.heading(`Training Readiness — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Score", "Level", "Sleep", "HRV", "Recovery", "Load", "Stress"],
      data.map((r) => [
        r.date, String(r.score), r.level,
        String(r.sleepScore), String(r.hrvFactor),
        String(r.recoveryFactor), String(r.loadFactor), String(r.stressFactor),
      ]),
    );
  });

program
  .command("sleep [days]")
  .description("Sleep score, stages, duration")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.sleep(d);
    out.heading(`Sleep — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Score", "Total", "REM", "Deep", "Light", "Awake"],
      data.map((r) => [
        r.date, r.score != null ? String(r.score) : "\u2014",
        secToH(r.totalSeconds), secToH(r.remSeconds),
        secToH(r.deepSeconds), secToH(r.lightSeconds), secToH(r.awakeSeconds),
      ]),
    );
  });

program
  .command("heart-rate [days]")
  .alias("hr")
  .description("Resting HR, min/max")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.heartRate(d);
    out.heading(`Heart Rate — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "RHR", "Min", "Max", "7d Avg RHR"],
      data.map((r) => [
        r.date,
        n(r.restingHr), n(r.minHr), n(r.maxHr), n(r.avgRhr7d),
      ]),
    );
  });

program
  .command("hrv [days]")
  .description("Heart rate variability + baseline")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.hrv(d);
    out.heading(`HRV — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "HRV", "Weekly", "Night High", "Base Low", "Bal Low", "Bal High", "Status"],
      data.map((r) => [
        r.date,
        n(r.lastNightAvg), n(r.weeklyAvg), n(r.lastNight5MinHigh),
        n(r.baselineLow), n(r.baselineBalancedLow), n(r.baselineBalancedHigh),
        r.status ?? "\u2014",
      ]),
    );
  });

program
  .command("stress [days]")
  .description("Stress levels")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.stress(d);
    out.heading(`Stress — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Avg", "Max", "Qualifier"],
      data.map((r) => [
        r.date, n(r.avgStress), n(r.maxStress), r.qualifier ?? "\u2014",
      ]),
    );
  });

program
  .command("body-battery [days]")
  .alias("bb")
  .description("Body battery charge/drain")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.bodyBattery(d);
    out.heading(`Body Battery — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Charged", "Drained", "Highest", "Lowest", "At Wake"],
      data.map((r) => [
        r.date, n(r.charged), n(r.drained), n(r.highest), n(r.lowest), n(r.atWake),
      ]),
    );
  });

program
  .command("steps [days]")
  .description("Steps, distance, floors")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.steps(d);
    out.heading(`Steps — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Steps", "Distance", "Goal", "Floors"],
      data.map((r) => [
        r.date, String(r.totalSteps), km(r.distanceMeters),
        String(r.stepGoal), String(Math.round(r.floorsAscended)),
      ]),
    );
  });

program
  .command("activities [days]")
  .description("Workouts: name, duration, distance, HR, calories")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.activities(d);
    out.heading(`Activities — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No activity data."); return; }

    out.table(
      ["ID", "Date", "Name", "Type", "Duration", "Distance", "AvgHR", "kcal", "Elev", "AE/AnE"],
      data.map((r) => [
        r.activityId != null ? String(r.activityId) : "\u2014",
        r.date, r.name, r.type, secToMin(r.durationSeconds), km(r.distanceMeters),
        n(r.avgHr), n(r.calories),
        r.elevationGain != null ? `${Math.round(r.elevationGain)}m` : "\u2014",
        r.aerobicEffect != null ? `${n(r.aerobicEffect, 1)}/${n(r.anaerobicEffect, 1)}` : "\u2014",
      ]),
    );
  });

program
  .command("daily [days]")
  .description("Daily summary: steps, HR, stress, calories")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.daily(d);
    out.heading(`Daily Summary — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Steps", "Distance", "Active kcal", "RHR", "Min HR", "Max HR", "Avg Stress", "BB Wake", "Floors"],
      data.map((r) => [
        r.date, String(r.totalSteps), km(r.distanceMeters), String(r.activeKcal),
        n(r.restingHr), n(r.minHr), n(r.maxHr), n(r.avgStress), n(r.bbAtWake),
        String(Math.round(r.floorsAscended)),
      ]),
    );
  });

// ── Tier 1: New data commands ───────────────────────────────────

program
  .command("vo2max [days]")
  .description("VO2 Max values (running + cycling)")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "30", 10);
    const data = await provider.vo2max(d);
    out.heading(`VO2 Max — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Running", "Cycling", "Generic", "Fitness Age"],
      data.map((r) => [
        r.date, n(r.vo2MaxRunning, 1), n(r.vo2MaxCycling, 1),
        n(r.generic, 1), n(r.fitnessAge),
      ]),
    );
  });

program
  .command("spo2 [days]")
  .description("Blood oxygen (SpO2) levels")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.spo2(d);
    out.heading(`SpO2 — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Avg %", "Lowest %", "Latest %"],
      data.map((r) => [
        r.date, n(r.avgSpo2), n(r.lowestSpo2), n(r.latestSpo2),
      ]),
    );
  });

program
  .command("respiration [days]")
  .alias("resp")
  .description("Respiration rates (breaths/min)")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.respiration(d);
    out.heading(`Respiration — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Avg Waking", "Avg Sleeping", "Highest", "Lowest"],
      data.map((r) => [
        r.date, n(r.avgWaking, 1), n(r.avgSleeping, 1),
        n(r.highest, 1), n(r.lowest, 1),
      ]),
    );
  });

program
  .command("training-status [days]")
  .alias("ts")
  .description("Training status, load focus, ACWR")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.trainingStatus(d);
    out.heading(`Training Status — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Status", "Focus", "Acute", "Chronic", "ACWR", "VO2"],
      data.map((r) => [
        r.date, r.trainingStatus ?? "\u2014", r.loadFocus ?? "\u2014",
        n(r.acuteLoad), n(r.chronicLoad), n(r.acwrPercent, 2), n(r.vo2Max, 1),
      ]),
    );
  });

program
  .command("race-predictions")
  .alias("rp")
  .description("Race time predictions")
  .action(async () => {
    const data = await provider.racePredictions();
    out.heading("Race Predictions");
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Distance", "Predicted Time"],
      data.map((r) => [r.distance, r.predictedTime]),
    );
  });

program
  .command("weight [days]")
  .description("Body weight + composition")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "30", 10);
    const data = await provider.weight(d);
    out.heading(`Weight — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Weight (kg)", "BMI", "Body Fat %", "Muscle (kg)", "Bone (kg)", "Water %"],
      data.map((r) => [
        r.date, n(r.weight, 1), n(r.bmi, 1), n(r.bodyFat, 1),
        n(r.muscleMass, 1), n(r.boneMass, 1), n(r.bodyWater, 1),
      ]),
    );
  });

program
  .command("fitness-age")
  .alias("fa")
  .description("Fitness age vs chronological age")
  .action(async () => {
    const data = await provider.fitnessAge();
    out.heading("Fitness Age");
    out.blank();
    console.log(`Chronological age: ${data.chronologicalAge}`);
    console.log(`Fitness age:       ${data.fitnessAge ?? "\u2014"}`);
    if (data.fitnessAge != null && data.chronologicalAge > 0) {
      const diff = data.chronologicalAge - data.fitnessAge;
      console.log(`Difference:        ${diff > 0 ? `${diff} years younger` : diff < 0 ? `${Math.abs(diff)} years older` : "same"}`);
    }
  });

program
  .command("intensity [days]")
  .alias("im")
  .description("Intensity minutes (moderate + vigorous)")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.intensityMinutes(d);
    out.heading(`Intensity Minutes — last ${d} days`);
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    out.table(
      ["Date", "Moderate", "Vigorous", "Total (2x vig)", "Weekly Goal"],
      data.map((r) => [
        r.date, String(r.moderate), String(r.vigorous),
        String(r.total), String(r.weeklyGoal),
      ]),
    );
  });

program
  .command("endurance")
  .alias("es")
  .description("Endurance score")
  .action(async () => {
    const data = await provider.enduranceScore();
    out.heading("Endurance Score");
    out.blank();
    console.log(`Score:          ${data.overall ?? "\u2014"}`);
    console.log(`Classification: ${data.classification ?? "\u2014"}`);
  });

// ── Tier 2: Activity detail commands ────────────────────────────

program
  .command("activity <id>")
  .description("Detailed view of a specific activity (splits + HR zones)")
  .action(async (id: string) => {
    const activityId = parseInt(id, 10);
    if (isNaN(activityId)) { showError("Invalid activity ID"); process.exit(1); }

    const detail = await provider.activityDetail(activityId);
    out.heading(`${detail.name} — ${detail.date}`);
    out.blank();

    console.log(`Type:     ${detail.type}`);
    console.log(`Duration: ${secToHMS(detail.durationSeconds)}`);
    if (detail.distanceMeters != null) console.log(`Distance: ${km(detail.distanceMeters)}`);
    if (detail.elevationGain != null) console.log(`Elev:     +${Math.round(detail.elevationGain)}m / -${Math.round(detail.elevationLoss ?? 0)}m`);
    if (detail.avgHr != null) console.log(`HR:       avg ${detail.avgHr} / max ${detail.maxHr ?? "\u2014"}`);
    if (detail.avgRunCadence != null) console.log(`Cadence:  avg ${Math.round(detail.avgRunCadence)} / max ${detail.maxRunCadence != null ? Math.round(detail.maxRunCadence) : "\u2014"} spm`);
    if (detail.avgSpeed != null) console.log(`Pace:     avg ${mps(detail.avgSpeed)} / max ${mps(detail.maxSpeed)}`);
    if (detail.calories != null) console.log(`Calories: ${Math.round(detail.calories)} kcal`);
    if (detail.aerobicEffect != null) console.log(`Training: AE ${detail.aerobicEffect.toFixed(1)} / AnE ${(detail.anaerobicEffect ?? 0).toFixed(1)}`);
    if (detail.vo2Max != null) console.log(`VO2 Max:  ${detail.vo2Max.toFixed(1)}`);
    if (detail.avgPower != null) console.log(`Power:    avg ${Math.round(detail.avgPower)}W / max ${detail.maxPower != null ? Math.round(detail.maxPower) : "\u2014"}W`);
    if (detail.avgTemperature != null) console.log(`Temp:     ${detail.avgTemperature.toFixed(1)}\u00b0C`);

    // Splits
    try {
      const splits = await provider.activitySplits(activityId);
      if (splits.length > 0) {
        out.blank();
        out.subheading("Splits");
        out.table(
          ["#", "Distance", "Duration", "Pace", "AvgHR", "MaxHR", "Cadence", "Elev +/-"],
          splits.map((s) => [
            String(s.index), km(s.distanceMeters), secToHMS(s.durationSeconds),
            mps(s.avgSpeed), n(s.avgHr), n(s.maxHr),
            s.avgCadence != null ? String(Math.round(s.avgCadence)) : "\u2014",
            s.elevationGain != null ? `+${Math.round(s.elevationGain)}/-${Math.round(s.elevationLoss ?? 0)}` : "\u2014",
          ]),
        );
      }
    } catch {
      // Splits not available for all activity types
    }

    // HR Zones
    try {
      const zones = await provider.activityHrZones(activityId);
      if (zones.length > 0) {
        out.blank();
        out.subheading("HR Zones");
        out.table(
          ["Zone", "Range (bpm)", "Duration"],
          zones.map((z) => [
            `Z${z.zone}`,
            `${z.zoneLow}\u2013${z.zoneHigh}`,
            secToHMS(z.durationSeconds),
          ]),
        );
      }
    } catch {
      // HR zones not available for all activity types
    }
  });

program
  .command("records")
  .alias("prs")
  .description("Personal records (PRs)")
  .action(async () => {
    const data = await provider.personalRecords();
    out.heading("Personal Records");
    out.blank();
    if (data.length === 0) { out.info("No data."); return; }

    // Format value based on type: time PRs in HH:MM:SS, distance in km, others raw
    const fmtValue = (typeId: number, value: number | null): string => {
      if (value == null) return "\u2014";
      if (typeId >= 1 && typeId <= 6) return secToHMS(value); // time records
      if (typeId >= 7 && typeId <= 9) return km(value); // distance records
      return String(Math.round(value)); // steps, counts, etc.
    };

    out.table(
      ["Type", "Value", "Date", "Activity"],
      data.map((r) => [
        r.type,
        fmtValue(r.typeId, r.value),
        r.date ?? "\u2014",
        r.activityName ?? "\u2014",
      ]),
    );
  });

program
  .command("gear")
  .description("Equipment tracking")
  .action(async () => {
    const data = await provider.gear();
    out.heading("Gear");
    out.blank();
    if (data.length === 0) { out.info("No gear registered."); return; }

    out.table(
      ["Name", "Type", "Distance", "Activities", "Max Distance", "Since"],
      data.map((g) => [
        g.name, g.type, km(g.distanceMeters), String(g.activities),
        g.maxDistanceMeters != null ? km(g.maxDistanceMeters) : "\u2014",
        g.createDate.slice(0, 10),
      ]),
    );
  });

// ── Overview ────────────────────────────────────────────────────

program
  .command("overview [days]")
  .description("Full dashboard: all health metrics")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    out.heading(`Garmin Overview — last ${d} days`);
    out.blank();

    out.subheading("Training Readiness");
    const tr = await provider.trainingReadiness(d);
    if (tr.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Score", "Level", "Sleep", "HRV", "Recovery", "Load", "Stress"],
        tr.map((r) => [
          r.date, String(r.score), r.level,
          String(r.sleepScore), String(r.hrvFactor),
          String(r.recoveryFactor), String(r.loadFactor), String(r.stressFactor),
        ]),
      );
    }
    out.blank();

    out.subheading("Sleep");
    const sl = await provider.sleep(d);
    if (sl.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Score", "Total", "REM", "Deep", "Light", "Awake"],
        sl.map((r) => [
          r.date, r.score != null ? String(r.score) : "\u2014",
          secToH(r.totalSeconds), secToH(r.remSeconds),
          secToH(r.deepSeconds), secToH(r.lightSeconds), secToH(r.awakeSeconds),
        ]),
      );
    }
    out.blank();

    out.subheading("Heart Rate");
    const hr = await provider.heartRate(d);
    if (hr.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "RHR", "Min", "Max", "7d Avg RHR"],
        hr.map((r) => [
          r.date, n(r.restingHr), n(r.minHr), n(r.maxHr), n(r.avgRhr7d),
        ]),
      );
    }
    out.blank();

    out.subheading("HRV");
    const hrvData = await provider.hrv(d);
    if (hrvData.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "HRV", "Weekly", "Night High", "Status"],
        hrvData.map((r) => [
          r.date, n(r.lastNightAvg), n(r.weeklyAvg), n(r.lastNight5MinHigh),
          r.status ?? "\u2014",
        ]),
      );
    }
    out.blank();

    out.subheading("Stress");
    const stress = await provider.stress(d);
    if (stress.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Avg", "Max", "Qualifier"],
        stress.map((r) => [
          r.date, n(r.avgStress), n(r.maxStress), r.qualifier ?? "\u2014",
        ]),
      );
    }
    out.blank();

    out.subheading("Body Battery");
    const bb = await provider.bodyBattery(d);
    if (bb.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Charged", "Drained", "Highest", "Lowest"],
        bb.map((r) => [
          r.date, n(r.charged), n(r.drained), n(r.highest), n(r.lowest),
        ]),
      );
    }
    out.blank();

    out.subheading("Steps");
    const st = await provider.steps(d);
    if (st.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Steps", "Distance", "Goal", "Floors"],
        st.map((r) => [
          r.date, String(r.totalSteps), km(r.distanceMeters),
          String(r.stepGoal), String(Math.round(r.floorsAscended)),
        ]),
      );
    }
    out.blank();

    out.subheading("Activities");
    const acts = await provider.activities(d);
    if (acts.length === 0) { out.info("No activity data."); } else {
      out.table(
        ["ID", "Date", "Name", "Type", "Duration", "Distance", "AvgHR", "kcal"],
        acts.map((r) => [
          r.activityId != null ? String(r.activityId) : "\u2014",
          r.date, r.name, r.type, secToMin(r.durationSeconds), km(r.distanceMeters),
          n(r.avgHr), n(r.calories),
        ]),
      );
    }
    out.blank();

    out.subheading("VO2 Max");
    const vo2 = await provider.vo2max(d);
    if (vo2.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Running", "Cycling", "Generic"],
        vo2.map((r) => [
          r.date, n(r.vo2MaxRunning, 1), n(r.vo2MaxCycling, 1), n(r.generic, 1),
        ]),
      );
    }
    out.blank();

    out.subheading("Intensity Minutes");
    const im = await provider.intensityMinutes(d);
    if (im.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Moderate", "Vigorous", "Total"],
        im.map((r) => [
          r.date, String(r.moderate), String(r.vigorous), String(r.total),
        ]),
      );
    }
    out.blank();

    out.subheading("Weight");
    const wt = await provider.weight(d);
    if (wt.length === 0) { out.info("No data."); } else {
      out.table(
        ["Date", "Weight (kg)", "BMI", "Body Fat %"],
        wt.map((r) => [
          r.date, n(r.weight, 1), n(r.bmi, 1), n(r.bodyFat, 1),
        ]),
      );
    }
  });

// ── Raw JSON ────────────────────────────────────────────────────

program
  .command("json <path> [params...]")
  .description("Raw JSON from any API endpoint")
  .action(async (path: string, params: string[]) => {
    const paramMap: Record<string, string> = {};
    for (const p of params) {
      const [k, v] = p.split("=");
      if (k && v) paramMap[k] = v;
    }
    out.json(await provider.json(path, Object.keys(paramMap).length ? paramMap : undefined));
  });

// ── Run ──────────────────────────────────────────────────────────

try {
  await program.parseAsync(process.argv);
} catch (e: unknown) {
  showError((e as Error).message);
  process.exit(1);
}
