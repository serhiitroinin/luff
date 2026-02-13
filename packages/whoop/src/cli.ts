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

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program.name("whoop").description("WHOOP health data CLI").version("0.1.0");

// ── Auth commands ────────────────────────────────────────────────

program
  .command("auth-setup <clientId> <clientSecret> <redirectUri>")
  .description("Save WHOOP OAuth2 app credentials (stored in macOS Keychain)")
  .action((clientId: string, clientSecret: string, redirectUri: string) => {
    saveOAuth2Credentials(TOOL, clientId, clientSecret, redirectUri);
    out.success("OAuth2 credentials saved to Keychain.");
    out.info("Now run: whoop auth-login");
  });

program
  .command("auth-login")
  .description("OAuth2 login flow (prints URL, waits for redirect URL)")
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
  .description("Check OAuth2 token status")
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
  .description("Remove all WHOOP credentials from Keychain")
  .action(() => {
    clearOAuth2Data(TOOL);
    out.success("All WHOOP credentials removed from Keychain.");
  });

// ── Data commands ────────────────────────────────────────────────

program
  .command("profile")
  .description("Show user profile")
  .action(async () => {
    const p = await provider.profile();
    out.heading("Profile");
    out.blank();
    out.info(`${p.firstName} ${p.lastName} (${p.email})`);
  });

program
  .command("body")
  .description("Show body measurements")
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
  .description("Recovery scores, HRV, RHR, SpO2")
  .action(async (days?: string) => {
    const records = await provider.recovery(parseInt(days ?? "7", 10));
    out.heading(`Recovery — last ${days ?? 7} days`);
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
  .description("Sleep stages, performance, efficiency")
  .action(async (days?: string) => {
    const records = await provider.sleep(parseInt(days ?? "7", 10));
    out.heading(`Sleep — last ${days ?? 7} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No sleep data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start));
    out.table(
      ["Date", "Perf%", "Total", "REM", "Deep", "Light", "Awake", "Nap"],
      sorted.map((r: WhoopSleep) => [
        r.start.split("T")[0],
        r.score?.sleepPerformancePercentage != null
          ? `${Math.round(r.score.sleepPerformancePercentage)}%`
          : "\u2014",
        r.score ? msToHm(r.score.totalInBedMs) : "\u2014",
        r.score ? msToHm(r.score.totalRemMs) : "\u2014",
        r.score ? msToHm(r.score.totalDeepMs) : "\u2014",
        r.score ? msToHm(r.score.totalLightMs) : "\u2014",
        r.score ? msToHm(r.score.totalAwakeMs) : "\u2014",
        r.nap ? "nap" : "",
      ]),
    );
  });

program
  .command("workouts [days]")
  .description("Workout strain, HR, distance")
  .action(async (days?: string) => {
    const records = await provider.workouts(parseInt(days ?? "7", 10));
    out.heading(`Workouts — last ${days ?? 7} days`);
    out.blank();

    if (records.length === 0) {
      out.info("No workout data.");
      return;
    }

    const sorted = [...records].sort((a, b) => a.start.localeCompare(b.start));
    out.table(
      ["Date", "Sport", "Strain", "AvgHR", "MaxHR", "kJ", "Dist(km)"],
      sorted.map((r) => [
        r.start.split("T")[0],
        r.sportName,
        r.score ? round1(r.score.strain) : "\u2014",
        r.score ? String(r.score.averageHeartRate) : "\u2014",
        r.score ? String(r.score.maxHeartRate) : "\u2014",
        r.score ? String(Math.round(r.score.kilojoule)) : "\u2014",
        r.score?.distanceMeter != null ? round1(r.score.distanceMeter / 1000) : "\u2014",
      ]),
    );
  });

program
  .command("cycles [days]")
  .description("Physiological cycles (strain, HR)")
  .action(async (days?: string) => {
    const records = await provider.cycles(parseInt(days ?? "7", 10));
    out.heading(`Cycles — last ${days ?? 7} days`);
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
  .description("Full dashboard: profile + recovery + sleep + workouts")
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
        ["Date", "Perf%", "Total", "REM", "Deep", "Light", "Awake", "Nap"],
        sortedS.map((r) => [
          r.start.split("T")[0],
          r.score?.sleepPerformancePercentage != null
            ? `${Math.round(r.score.sleepPerformancePercentage)}%`
            : "\u2014",
          r.score ? msToHm(r.score.totalInBedMs) : "\u2014",
          r.score ? msToHm(r.score.totalRemMs) : "\u2014",
          r.score ? msToHm(r.score.totalDeepMs) : "\u2014",
          r.score ? msToHm(r.score.totalLightMs) : "\u2014",
          r.score ? msToHm(r.score.totalAwakeMs) : "\u2014",
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
        ["Date", "Sport", "Strain", "AvgHR", "MaxHR", "kJ", "Dist(km)"],
        sortedW.map((r) => [
          r.start.split("T")[0],
          r.sportName,
          r.score ? round1(r.score.strain) : "\u2014",
          r.score ? String(r.score.averageHeartRate) : "\u2014",
          r.score ? String(r.score.maxHeartRate) : "\u2014",
          r.score ? String(Math.round(r.score.kilojoule)) : "\u2014",
          r.score?.distanceMeter != null ? round1(r.score.distanceMeter / 1000) : "\u2014",
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
