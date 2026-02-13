#!/usr/bin/env bun
import { Command } from "commander";
import {
  saveOAuth2Credentials,
  loadTokens,
  buildAuthorizeUrl,
  exchangeCode,
  saveTokens,
  clearOAuth2Data,
  loadOAuth2Credentials,
  error as showError,
} from "@luff/shared";
import * as out from "@luff/shared/output";
import { whoopProvider, OAUTH2_CONFIG } from "./providers/whoop.ts";
import type { WhoopProvider, WhoopSleep } from "./types.ts";

const TOOL = "whoop";
const provider: WhoopProvider = whoopProvider;

// ── Formatting helpers ───────────────────────────────────────────

function msToHm(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m}m`;
}

function msToMin(ms: number): string {
  return `${Math.round(ms / 60000)}m`;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function pct(n: number | null): string {
  if (n == null) return "\u2014";
  return `${Math.round(n)}%`;
}

function num(n: number | null): string {
  if (n == null) return "\u2014";
  return String(Math.round(n));
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program
  .name("whoop")
  .description("WHOOP health data CLI (v0.2.1)")
  .version("0.2.1")
  .addHelpText("after", `
OVERVIEW
  Fetches health and recovery data from the WHOOP API v2.
  All credentials are stored in macOS Keychain (service: luff-whoop).
  All data commands accept an optional [days] argument (default: 7).
  Output is formatted tables to stdout; use 'json' for raw API data.

COMMAND CATEGORIES
  Auth:
    auth-setup <id> <secret> <uri>   Save OAuth2 app credentials
    auth-login                       Interactive OAuth2 login flow
    auth-status                      Check token validity
    auth-logout                      Remove all credentials

  Data (default 7 days):
    overview [days]    Full dashboard — profile + recovery + sleep + workouts
    recovery [days]    Recovery score, HRV, RHR, SpO2, skin temperature
    sleep [days]       Sleep stages, performance, efficiency, respiratory rate
    workouts [days]    Workout strain, HR zones, distance, elevation
    cycles [days]      Physiological cycles (day strain, avg/max HR, kJ)
    profile            User profile information
    body               Body measurements (height, weight, max HR)

  Raw API:
    json <path> [k=v ...]   Raw JSON from any WHOOP API endpoint

METRIC QUICK REFERENCE
  Recovery Score (0–100):
    67–100  Green   — Well recovered. Push hard, high-intensity training OK.
    34–66   Yellow  — Moderate recovery. Normal training, monitor fatigue.
    0–33    Red     — Under-recovered. Light activity only, prioritize sleep.

  Strain (0–21 scale, logarithmic):
    0–9     Light     — Easy day, minimal cardiovascular load
    10–13   Moderate  — Noticeable effort, typical normal day
    14–17   High      — Hard training, significant cardiovascular load
    18–21   All-out   — Maximal effort, extreme exertion

  Sleep Performance (%):
    100%+   Exceeded sleep need
    85–99%  Good — meeting most sleep needs
    70–84%  Fair — some sleep debt accumulating
    <70%    Poor — significant sleep debt

  Sleep Efficiency (%):
    ≥85%   Good — most time in bed is actual sleep
    <85%   Below target — too much awake time in bed

  Sleep Stages (% of total sleep time):
    REM    20–25%  — Memory consolidation, learning, emotional processing
    Deep   15–20%  — Physical recovery, immune function, growth hormone
    Light  50–55%  — Transition sleep, muscle recovery
    Awake  <10%    — Normal awakenings during sleep

  Sleep Needed breakdown:
    Baseline  — Base sleep need (genetic, age-dependent)
    +Debt     — Extra sleep needed to repay accumulated debt
    +Strain   — Extra sleep needed due to today's strain
    -Nap      — Sleep credit from naps taken

  HRV (RMSSD, ms) — higher is better:
    Highly individual. Track YOUR trend, not absolute values.
    Declining HRV over 3+ days = possible overtraining or illness.

  RHR (bpm) — lower is better:
    Trending down = improving fitness.
    Sudden spike (5+ bpm) = potential illness, stress, or overtraining.

  SpO2 (%):
    95–100%  Normal
    <95%     Below normal — may indicate altitude or respiratory issues

  Skin Temperature (°C):
    Baseline varies by person (~34–35°C typical).
    Spike >1°C above your baseline may indicate illness onset.

  Respiratory Rate (breaths/min during sleep):
    Normal: 12–20 breaths/min. Sudden increase may indicate illness.

  HR Zones (per workout, Z0–Z5):
    Z0  Below 50% max HR — Warm-up / cooldown
    Z1  50–60% max HR    — Light / recovery
    Z2  60–70% max HR    — Fat burn / aerobic base
    Z3  70–80% max HR    — Aerobic / cardio
    Z4  80–90% max HR    — Threshold / tempo
    Z5  90–100% max HR   — VO2 max / anaerobic

ALERTING THRESHOLDS
  Recovery <25 two days in a row    → Recovery critically low, consider rest day
  Sleep <5h two nights in a row     → Sleep debt accumulating, prioritize tonight
  HRV declining 3+ days             → Watch for overtraining or illness
  SpO2 <94%                         → Below normal, monitor for altitude or illness
  Skin temp >1°C above baseline     → Possible illness onset
  Strain >16 on red recovery day    → Overreaching risk

EXAMPLES
  whoop recovery              Last 7 days recovery scores
  whoop recovery 1            Just today's recovery
  whoop sleep 14              Two weeks of sleep data
  whoop workouts 30           Last month of workouts
  whoop overview              Full 7-day dashboard
  whoop json /v2/recovery     Raw JSON from recovery endpoint

COMPLEMENTARY TOOLS
  Use alongside 'garmin' CLI for a complete health picture:
  - WHOOP excels at: recovery score, sleep efficiency/performance, strain,
    workout HR zones (Z0–Z5), sleep needed breakdown
  - Garmin excels at: training readiness (richer factors), body battery, stress,
    steps, VO2 max, training status/ACWR, weight, activity detail/splits`);

// ── Auth commands ────────────────────────────────────────────────

program
  .command("auth-setup <clientId> <clientSecret> <redirectUri>")
  .description("Save WHOOP OAuth2 app credentials to macOS Keychain")
  .addHelpText("after", `
Details:
  Stores your WHOOP developer app credentials in macOS Keychain
  (service: luff-whoop). You need a WHOOP developer account and an app
  registered at https://developer.whoop.com/ to get these values.

  After setup, run 'whoop auth-login' to complete the OAuth2 flow.

Arguments:
  clientId      — OAuth2 client ID from WHOOP developer portal
  clientSecret  — OAuth2 client secret from WHOOP developer portal
  redirectUri   — Redirect URI configured in your WHOOP app

Example:
  whoop auth-setup abc123 secret456 https://localhost:8080/callback`)
  .action((clientId: string, clientSecret: string, redirectUri: string) => {
    saveOAuth2Credentials(TOOL, clientId, clientSecret, redirectUri);
    out.success("OAuth2 credentials saved to Keychain.");
    out.info("Now run: whoop auth-login");
  });

program
  .command("auth-login")
  .description("Interactive OAuth2 login — opens browser, waits for redirect URL")
  .addHelpText("after", `
Details:
  Starts the OAuth2 Authorization Code flow:
  1. Prints an authorization URL — open it in your browser
  2. Log in to WHOOP and authorize the app
  3. You'll be redirected to your redirect URI with a code parameter
  4. Paste the full redirect URL back into the terminal
  5. Tokens are exchanged and saved to macOS Keychain

  Tokens auto-refresh on subsequent API calls via the 'offline' scope.
  Run 'whoop auth-setup' first if you haven't saved credentials yet.

Example:
  whoop auth-login`)
  .action(async () => {
    const creds = loadOAuth2Credentials(TOOL);
    const state = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const url = buildAuthorizeUrl(OAUTH2_CONFIG, creds.clientId, creds.redirectUri, state);

    out.info("Open this URL in your browser:\n");
    console.log(url);
    out.blank();

    const rl = await import("readline");
    const iface = rl.createInterface({ input: process.stdin, output: process.stdout });
    const redirectUrl = await new Promise<string>((resolve) => {
      iface.question("After authorizing, paste the full redirect URL here:\n", (answer) => {
        iface.close();
        resolve(answer.trim());
      });
    });

    // Extract code from URL
    const codeMatch = redirectUrl.match(/[?&]code=([^&]+)/);
    if (!codeMatch) {
      out.error("Could not extract authorization code from URL.");
      process.exit(1);
    }

    const tokens = await exchangeCode(
      OAUTH2_CONFIG,
      creds.clientId,
      creds.clientSecret,
      creds.redirectUri,
      codeMatch[1],
    );
    saveTokens(TOOL, tokens);
    out.success("Login successful! Tokens saved to Keychain.");
  });

program
  .command("auth-status")
  .description("Check OAuth2 token status and expiry")
  .addHelpText("after", `
Details:
  Shows whether you're logged in, how long the access token is valid,
  and whether a refresh token is available for auto-renewal.

  If the access token is expired but a refresh token exists, it will
  auto-refresh on the next API call — no action needed.

Output fields:
  Token status    — Valid (with seconds remaining) or expired
  Refresh token   — Available or missing
  Credentials     — Storage location (macOS Keychain)

Example:
  whoop auth-status`)
  .action(() => {
    const tokens = loadTokens(TOOL);
    if (!tokens) {
      out.info("Not logged in.");
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    if (now >= tokens.expiresAt) {
      out.info("Token expired. Will auto-refresh on next API call.");
    } else {
      const remaining = tokens.expiresAt - now;
      out.success(`Logged in. Token valid for ${remaining}s.`);
    }
    out.info(`Refresh token: ${tokens.refreshToken ? "available" : "missing"}`);
    out.info("Credentials: macOS Keychain (service: luff-whoop)");
  });

program
  .command("auth-logout")
  .description("Remove all WHOOP credentials from macOS Keychain")
  .addHelpText("after", `
Details:
  Deletes OAuth2 client credentials and tokens from macOS Keychain.
  After logout, you'll need to run 'whoop auth-setup' and 'whoop auth-login'
  again to re-authenticate.

Example:
  whoop auth-logout`)
  .action(() => {
    clearOAuth2Data(TOOL);
    out.success("All WHOOP credentials removed from Keychain.");
  });

// ── Data commands ────────────────────────────────────────────────

program
  .command("profile")
  .description("Show user profile (name, email)")
  .addHelpText("after", `
Output:
  Full name and email address associated with the WHOOP account.

Example:
  whoop profile`)
  .action(async () => {
    const p = await provider.profile();
    out.heading("Profile");
    out.blank();
    out.info(`${p.firstName} ${p.lastName} (${p.email})`);
  });

program
  .command("body")
  .description("Show body measurements — height, weight, max heart rate")
  .addHelpText("after", `
Columns:
  Height  — Height in centimeters
  Weight  — Weight in kilograms
  Max HR  — Maximum heart rate (bpm), used for HR zone calculations

  These values are set in the WHOOP app and used for strain/zone calculations.

Example:
  whoop body`)
  .action(async () => {
    const b = await provider.body();
    out.heading("Body Measurements");
    out.blank();
    out.table(
      ["Metric", "Value"],
      [
        ["Height", `${(b.heightMeter * 100).toFixed(0)} cm`],
        ["Weight", `${b.weightKilogram.toFixed(1)} kg`],
        ["Max HR", `${b.maxHeartRate} bpm`],
      ],
    );
  });

program
  .command("recovery [days]")
  .description("Recovery scores (0–100), HRV (ms), RHR (bpm), SpO2 (%), skin temperature (°C)")
  .addHelpText("after", `
Columns:
  Date    — YYYY-MM-DD (date the recovery was calculated)
  Score   — 0–100 recovery score, or score state if still processing
  HRV     — Heart rate variability RMSSD (ms). Higher = better recovery.
  RHR     — Resting heart rate (bpm). Lower = better cardiovascular fitness.
  SpO2    — Blood oxygen saturation (%). Should stay >95%.
  Skin°C  — Skin temperature (°C). Spikes >1°C above baseline may indicate illness.

Recovery zones:
  67–100  Green   — Well recovered. High-intensity training OK.
  34–66   Yellow  — Moderate. Normal training, don't push max effort.
  0–33    Red     — Under-recovered. Light activity, prioritize sleep.

  Score may show "PENDING" or "SCORED" (scoreState) when the score is not
  yet available — this happens when the device hasn't finished processing.

Cross-reference:
  Compare with Garmin training readiness for a fuller picture.
  Low HRV + high RHR + red recovery = strong signal to take it easy.

Examples:
  whoop recovery             Last 7 days (default)
  whoop recovery 1           Today's recovery only
  whoop recovery 14          Two-week recovery trend
  whoop recovery 30          Monthly recovery history`)
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const records = await provider.recovery(d);
    out.heading(`Recovery — last ${d} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No recovery data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    out.table(
      ["Date", "Score", "HRV", "RHR", "SpO2", "Skin\u00b0C"],
      sorted.map((r) => [
        r.createdAt.split("T")[0],
        r.score ? String(r.score.recoveryScore) : r.scoreState,
        r.score ? String(Math.round(r.score.hrvRmssdMilli)) : "\u2014",
        r.score ? String(Math.round(r.score.restingHeartRate)) : "\u2014",
        r.score?.spo2Percentage != null ? String(r.score.spo2Percentage) : "\u2014",
        r.score?.skinTempCelsius != null ? String(r.score.skinTempCelsius) : "\u2014",
      ]),
    );
  });

program
  .command("sleep [days]")
  .description("Sleep stages, performance %, efficiency %, respiratory rate, sleep needed breakdown")
  .addHelpText("after", `
Main table columns:
  Date    — YYYY-MM-DD (sleep start date)
  Perf%   — Sleep performance: % of sleep need achieved. Target: ≥85%.
  Eff%    — Sleep efficiency: % of in-bed time actually asleep. Target: ≥85%.
  Total   — Total time in bed (hours + minutes)
  REM     — REM sleep duration. Target: 20–25% of total.
  Deep    — Deep/SWS sleep duration. Target: 15–20% of total.
  Light   — Light sleep duration. Typically 50–55% of total.
  Awake   — Time awake during sleep. Should be <10% of total.
  RespR   — Respiratory rate during sleep (breaths/min). Normal: 12–20.
  Dist    — Number of sleep disturbances
  Cycles  — Number of complete sleep cycles (typically 4–6 per night)
  Nap     — "nap" if this was a nap, empty if overnight sleep

Sleep Need Breakdown table (shown separately for non-nap entries):
  Date     — YYYY-MM-DD
  Needed   — Total sleep needed (baseline + debt + strain - nap credit)
  Baseline — Base sleep need (individual, genetically influenced)
  +Debt    — Additional sleep needed to repay accumulated sleep debt
  +Strain  — Additional sleep needed due to day's physical strain
  -Nap     — Sleep credit earned from daytime naps

Interpretation:
  Performance ≥100%: Exceeded sleep need — sleep debt reducing
  Performance 85–99%: Meeting most needs — good
  Performance 70–84%: Some debt accumulating — room to improve
  Performance <70%: Significant sleep debt — prioritize sleep tonight

  Two nights with <5h sleep in a row = sleep debt alert.

Examples:
  whoop sleep              Last 7 days (default)
  whoop sleep 14           Two-week sleep history
  whoop sleep 30           Monthly sleep trends`)
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const records = await provider.sleep(d);
    out.heading(`Sleep — last ${d} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No sleep data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start));
    out.table(
      ["Date", "Perf%", "Eff%", "Total", "REM", "Deep", "Light", "Awake", "RespR", "Dist", "Cycles", "Nap"],
      sorted.map((r: WhoopSleep) => [
        r.start.split("T")[0],
        pct(r.score?.sleepPerformancePercentage ?? null),
        pct(r.score?.sleepEfficiencyPercentage ?? null),
        r.score ? msToHm(r.score.totalInBedMs) : "\u2014",
        r.score ? msToHm(r.score.totalRemMs) : "\u2014",
        r.score ? msToHm(r.score.totalDeepMs) : "\u2014",
        r.score ? msToHm(r.score.totalLightMs) : "\u2014",
        r.score ? msToHm(r.score.totalAwakeMs) : "\u2014",
        r.score?.respiratoryRate != null ? round1(r.score.respiratoryRate) : "\u2014",
        num(r.score?.disturbanceCount ?? null),
        num(r.score?.sleepCycleCount ?? null),
        r.nap ? "nap" : "",
      ]),
    );

    // Sleep needed breakdown
    const withNeeded = sorted.filter((r) => r.score?.sleepNeeded && !r.nap);
    if (withNeeded.length > 0) {
      out.blank();
      out.subheading("Sleep Need Breakdown");
      out.table(
        ["Date", "Needed", "Baseline", "+Debt", "+Strain", "-Nap"],
        withNeeded.map((r) => {
          const sn = r.score!.sleepNeeded!;
          return [
            r.start.split("T")[0],
            msToHm(sn.totalMs),
            msToHm(sn.baselineMs),
            sn.debtMs > 0 ? `+${msToHm(sn.debtMs)}` : "\u2014",
            sn.strainMs > 0 ? `+${msToHm(sn.strainMs)}` : "\u2014",
            sn.napMs < 0 ? msToHm(Math.abs(sn.napMs)) : "\u2014",
          ];
        }),
      );
    }
  });

program
  .command("workouts [days]")
  .description("Workout strain (0–21), HR zones (Z0–Z5), distance, elevation, kilojoules")
  .addHelpText("after", `
Main table columns:
  Date     — YYYY-MM-DD (workout start date)
  Sport    — Sport/activity name (e.g., Running, Cycling, Functional Fitness)
  Strain   — Workout strain score (0–21 logarithmic scale)
  AvgHR    — Average heart rate during workout (bpm)
  MaxHR    — Maximum heart rate during workout (bpm)
  kJ       — Energy expenditure in kilojoules
  Dist(km) — Distance in kilometers (if applicable)
  Elev(m)  — Altitude/elevation gain in meters (if applicable)

HR Zones table (shown separately for workouts with zone data):
  Date   — YYYY-MM-DD
  Sport  — Activity type
  Z0–Z5  — Time spent in each heart rate zone (minutes)

Strain scale (0–21, logarithmic — each point harder to achieve):
  0–9     Light     — Easy activity, minimal cardiovascular demand
  10–13   Moderate  — Noticeable effort, typical workout
  14–17   High      — Hard training, significant load
  18–21   All-out   — Maximal effort, extreme exertion

HR Zone definitions:
  Z0  Below 50% max HR — Warm-up, cooldown, very light movement
  Z1  50–60% max HR    — Light activity, recovery
  Z2  60–70% max HR    — Fat burn, aerobic base building
  Z3  70–80% max HR    — Aerobic, cardio improvement
  Z4  80–90% max HR    — Threshold, tempo efforts
  Z5  90–100% max HR   — VO2 max, anaerobic capacity

Cross-reference:
  Compare strain with recovery: high strain (>14) on red recovery (<33)
  = overreaching risk. Match workout intensity to recovery zone.

Examples:
  whoop workouts            Last 7 days (default)
  whoop workouts 14         Two weeks of workouts
  whoop workouts 30         Monthly workout history`)
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const records = await provider.workouts(d);
    out.heading(`Workouts — last ${d} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No workout data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start));
    out.table(
      ["Date", "Sport", "Strain", "AvgHR", "MaxHR", "kJ", "Dist(km)", "Elev(m)"],
      sorted.map((r) => [
        r.start.split("T")[0],
        r.sportName,
        r.score ? round1(r.score.strain) : "\u2014",
        r.score ? String(r.score.averageHeartRate) : "\u2014",
        r.score ? String(r.score.maxHeartRate) : "\u2014",
        r.score ? String(Math.round(r.score.kilojoule)) : "\u2014",
        r.score?.distanceMeter != null ? round1(r.score.distanceMeter / 1000) : "\u2014",
        r.score?.altitudeGainMeter != null ? num(r.score.altitudeGainMeter) : "\u2014",
      ]),
    );

    // HR zone breakdown
    const withZones = sorted.filter((r) => r.score && r.score.zoneMs.some((z) => z > 0));
    if (withZones.length > 0) {
      out.blank();
      out.subheading("HR Zones");
      out.table(
        ["Date", "Sport", "Z0", "Z1", "Z2", "Z3", "Z4", "Z5"],
        withZones.map((r) => [
          r.start.split("T")[0],
          r.sportName,
          ...r.score!.zoneMs.map((z) => z > 0 ? msToMin(z) : "\u2014"),
        ]),
      );
    }
  });

program
  .command("cycles [days]")
  .description("Physiological cycles — day strain, average/max HR, energy expenditure")
  .addHelpText("after", `
Columns:
  Start   — Cycle start datetime (YYYY-MM-DD HH:MM)
  End     — Cycle end datetime, or "ongoing" if current cycle
  Strain  — Total day strain (0–21 logarithmic scale)
  AvgHR   — Average heart rate for the cycle (bpm)
  MaxHR   — Maximum heart rate for the cycle (bpm)
  kJ      — Total energy expenditure in kilojoules

Details:
  A WHOOP cycle represents one physiological day (typically wake-to-wake,
  not midnight-to-midnight). Each cycle accumulates strain from all activity.
  The current cycle shows as "ongoing" until it completes.

  Day strain is cumulative and logarithmic — harder to increase as it gets higher.
  A cycle strain of 0–9 is a light day, 10–13 moderate, 14+ high.

Examples:
  whoop cycles             Last 7 days (default)
  whoop cycles 14          Two weeks of cycles`)
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const records = await provider.cycles(d);
    out.heading(`Cycles — last ${d} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No cycle data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start));
    out.table(
      ["Start", "End", "Strain", "AvgHR", "MaxHR", "kJ"],
      sorted.map((r) => {
        const startParts = r.start.split("T");
        const startStr = `${startParts[0]} ${startParts[1]?.split(".")[0]?.slice(0, 5) ?? ""}`;
        let endStr = "ongoing";
        if (r.end) {
          const endParts = r.end.split("T");
          endStr = `${endParts[0]} ${endParts[1]?.split(".")[0]?.slice(0, 5) ?? ""}`;
        }
        return [
          startStr,
          endStr,
          r.score ? round1(r.score.strain) : "\u2014",
          r.score ? String(r.score.averageHeartRate) : "\u2014",
          r.score ? String(r.score.maxHeartRate) : "\u2014",
          r.score ? String(Math.round(r.score.kilojoule)) : "\u2014",
        ];
      }),
    );
  });

program
  .command("overview [days]")
  .description("Full dashboard — profile + recovery + sleep + workouts in one view")
  .addHelpText("after", `
Details:
  Fetches and displays all available WHOOP data in one combined output.
  Includes: Profile, Recovery (with HRV/RHR/SpO2), Sleep (with stages and
  efficiency), and Workouts (with strain and distance).

  This is the most comprehensive single command — use it for daily check-ins
  or weekly reviews. For targeted data, use individual commands instead.

Examples:
  whoop overview           Full 7-day dashboard (default)
  whoop overview 14        Two-week comprehensive view
  whoop overview 1         Today's snapshot only`)
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    out.heading(`WHOOP Overview — last ${d} days`);
    out.blank();

    try {
      const p = await provider.profile();
      out.subheading("Profile");
      out.info(`${p.firstName} ${p.lastName} (${p.email})`);
    } catch {
      out.info("(could not fetch profile)");
    }
    out.blank();

    out.subheading("Recovery");
    const recoveries = await provider.recovery(d);
    if (recoveries.length === 0) {
      out.info("No recovery data.");
    } else {
      const sortedR = [...recoveries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      out.table(
        ["Date", "Score", "HRV", "RHR", "SpO2", "Skin\u00b0C"],
        sortedR.map((r) => [
          r.createdAt.split("T")[0],
          r.score ? String(r.score.recoveryScore) : r.scoreState,
          r.score ? String(Math.round(r.score.hrvRmssdMilli)) : "\u2014",
          r.score ? String(Math.round(r.score.restingHeartRate)) : "\u2014",
          r.score?.spo2Percentage != null ? String(r.score.spo2Percentage) : "\u2014",
          r.score?.skinTempCelsius != null ? String(r.score.skinTempCelsius) : "\u2014",
        ]),
      );
    }
    out.blank();

    out.subheading("Sleep");
    const sleeps = await provider.sleep(d);
    if (sleeps.length === 0) {
      out.info("No sleep data.");
    } else {
      const sortedS = [...sleeps].sort((a, b) => a.start.localeCompare(b.start));
      out.table(
        ["Date", "Perf%", "Eff%", "Total", "REM", "Deep", "Light", "Awake", "RespR", "Nap"],
        sortedS.map((r) => [
          r.start.split("T")[0],
          pct(r.score?.sleepPerformancePercentage ?? null),
          pct(r.score?.sleepEfficiencyPercentage ?? null),
          r.score ? msToHm(r.score.totalInBedMs) : "\u2014",
          r.score ? msToHm(r.score.totalRemMs) : "\u2014",
          r.score ? msToHm(r.score.totalDeepMs) : "\u2014",
          r.score ? msToHm(r.score.totalLightMs) : "\u2014",
          r.score ? msToHm(r.score.totalAwakeMs) : "\u2014",
          r.score?.respiratoryRate != null ? round1(r.score.respiratoryRate) : "\u2014",
          r.nap ? "nap" : "",
        ]),
      );
    }
    out.blank();

    out.subheading("Workouts");
    const workoutsData = await provider.workouts(d);
    if (workoutsData.length === 0) {
      out.info("No workout data.");
    } else {
      const sortedW = [...workoutsData].sort((a, b) => a.start.localeCompare(b.start));
      out.table(
        ["Date", "Sport", "Strain", "AvgHR", "MaxHR", "kJ", "Dist(km)", "Elev(m)"],
        sortedW.map((r) => [
          r.start.split("T")[0],
          r.sportName,
          r.score ? round1(r.score.strain) : "\u2014",
          r.score ? String(r.score.averageHeartRate) : "\u2014",
          r.score ? String(r.score.maxHeartRate) : "\u2014",
          r.score ? String(Math.round(r.score.kilojoule)) : "\u2014",
          r.score?.distanceMeter != null ? round1(r.score.distanceMeter / 1000) : "\u2014",
          r.score?.altitudeGainMeter != null ? num(r.score.altitudeGainMeter) : "\u2014",
        ]),
      );
    }
  });

program
  .command("json <path> [params...]")
  .description("Raw JSON from any WHOOP API v2 endpoint")
  .addHelpText("after", `
Details:
  Fetches raw JSON from any WHOOP API path. The path is relative to the
  API base URL — include the version prefix (e.g., /v2/recovery).

  Query parameters can be passed as key=value pairs after the path.
  Standard WHOOP pagination parameters: limit, nextToken.

  Useful for exploring the API, debugging, or accessing data not yet
  wrapped by dedicated commands.

Common endpoints:
  /v2/user/profile/basic     User profile
  /v2/user/measurement/body  Body measurements
  /v2/recovery               Recovery records (paginated)
  /v2/activity/sleep          Sleep records (paginated)
  /v2/activity/workout        Workout records (paginated)
  /v2/cycle                   Physiological cycles (paginated)

Examples:
  whoop json /v2/recovery
  whoop json /v2/recovery limit=3
  whoop json /v2/activity/sleep start=2026-02-01T00:00:00.000Z`)
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
