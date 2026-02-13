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

function km(meters: number | null): string {
  if (meters == null) return "\u2014";
  return `${(meters / 1000).toFixed(1)} km`;
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program.name("garmin").description("Garmin Connect health data CLI").version("0.1.0");

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
      "display-name",
    ]) {
      deleteSecret(TOOL, key);
    }
    out.success("All Garmin credentials removed from Keychain.");
  });

// ── Data commands ────────────────────────────────────────────────

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
        r.restingHr != null ? String(r.restingHr) : "\u2014",
        r.minHr != null ? String(r.minHr) : "\u2014",
        r.maxHr != null ? String(r.maxHr) : "\u2014",
        r.avgRhr7d != null ? String(r.avgRhr7d) : "\u2014",
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
        r.lastNightAvg != null ? String(r.lastNightAvg) : "\u2014",
        r.weeklyAvg != null ? String(r.weeklyAvg) : "\u2014",
        r.lastNight5MinHigh != null ? String(r.lastNight5MinHigh) : "\u2014",
        r.baselineLow != null ? String(r.baselineLow) : "\u2014",
        r.baselineBalancedLow != null ? String(r.baselineBalancedLow) : "\u2014",
        r.baselineBalancedHigh != null ? String(r.baselineBalancedHigh) : "\u2014",
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
        r.date,
        r.avgStress != null ? String(r.avgStress) : "\u2014",
        r.maxStress != null ? String(r.maxStress) : "\u2014",
        r.qualifier ?? "\u2014",
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
        r.date,
        r.charged != null ? String(r.charged) : "\u2014",
        r.drained != null ? String(r.drained) : "\u2014",
        r.highest != null ? String(r.highest) : "\u2014",
        r.lowest != null ? String(r.lowest) : "\u2014",
        r.atWake != null ? String(r.atWake) : "\u2014",
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
      ["Date", "Name", "Type", "Duration", "Distance", "AvgHR", "MaxHR", "kcal"],
      data.map((r) => [
        r.date, r.name, r.type, secToMin(r.durationSeconds), km(r.distanceMeters),
        r.avgHr != null ? String(r.avgHr) : "\u2014",
        r.maxHr != null ? String(r.maxHr) : "\u2014",
        r.calories != null ? String(r.calories) : "\u2014",
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
        r.restingHr != null ? String(r.restingHr) : "\u2014",
        r.minHr != null ? String(r.minHr) : "\u2014",
        r.maxHr != null ? String(r.maxHr) : "\u2014",
        r.avgStress != null ? String(r.avgStress) : "\u2014",
        r.bbAtWake != null ? String(r.bbAtWake) : "\u2014",
        String(Math.round(r.floorsAscended)),
      ]),
    );
  });

program
  .command("overview [days]")
  .description("Full dashboard: readiness + sleep + HR + HRV + steps + activities")
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
          r.date,
          r.restingHr != null ? String(r.restingHr) : "\u2014",
          r.minHr != null ? String(r.minHr) : "\u2014",
          r.maxHr != null ? String(r.maxHr) : "\u2014",
          r.avgRhr7d != null ? String(r.avgRhr7d) : "\u2014",
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
          r.date,
          r.lastNightAvg != null ? String(r.lastNightAvg) : "\u2014",
          r.weeklyAvg != null ? String(r.weeklyAvg) : "\u2014",
          r.lastNight5MinHigh != null ? String(r.lastNight5MinHigh) : "\u2014",
          r.status ?? "\u2014",
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
        ["Date", "Name", "Type", "Duration", "Distance", "AvgHR", "MaxHR", "kcal"],
        acts.map((r) => [
          r.date, r.name, r.type, secToMin(r.durationSeconds), km(r.distanceMeters),
          r.avgHr != null ? String(r.avgHr) : "\u2014",
          r.maxHr != null ? String(r.maxHr) : "\u2014",
          r.calories != null ? String(r.calories) : "\u2014",
        ]),
      );
    }
  });

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
