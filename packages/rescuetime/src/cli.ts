#!/usr/bin/env bun
import { Command } from "commander";
import { setSecret, hasSecret, error as showError } from "@luff/shared";
import * as out from "@luff/shared/output";
import { rescuetimeProvider, productivityLabel } from "./providers/rescuetime.ts";
import type { ProductivityProvider } from "./types.ts";

const TOOL = "rescuetime";
const provider: ProductivityProvider = rescuetimeProvider;

// ── Formatting helpers ───────────────────────────────────────────

function fmtHours(seconds: number): string {
  const h = Math.round((seconds / 3600) * 10) / 10;
  return `${h}h`;
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program.name("rescuetime").description("RescueTime productivity data CLI").version("0.1.0");

// ── Setup ────────────────────────────────────────────────────────

program
  .command("setup <apiKey>")
  .description("Save RescueTime API key (stored in macOS Keychain)")
  .action(async (apiKey: string) => {
    setSecret(TOOL, "api-key", apiKey);
    out.success("API key saved to Keychain.");
    try {
      const data = await provider.dailySummary(1);
      if (data.length > 0) {
        out.info(`Connected — latest data: ${data[data.length - 1].date}`);
      } else {
        out.info("Connected but no recent data found.");
      }
    } catch (e: unknown) {
      out.error(`Key saved but API check failed: ${(e as Error).message}`);
    }
  });

program
  .command("status")
  .description("Check API connection")
  .action(async () => {
    if (!hasSecret(TOOL, "api-key")) {
      out.error("No API key in Keychain. Run: rescuetime setup <api_key>");
      process.exit(1);
    }
    try {
      const data = await provider.dailySummary(1);
      out.success("RescueTime API: OK");
      if (data.length > 0) out.info(`Latest data: ${data[data.length - 1].date}`);
      out.info("Credentials: macOS Keychain (service: luff-rescuetime)");
    } catch (e: unknown) {
      out.error((e as Error).message);
      process.exit(1);
    }
  });

// ── Data commands ────────────────────────────────────────────────

program
  .command("productivity [days]")
  .description("Daily productivity pulse scores (0-100)")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.dailySummary(d);
    out.heading(`Productivity — last ${d} days`);
    out.blank();

    if (data.length === 0) {
      out.info("No data. Daily summary excludes the current day.");
      return;
    }

    out.table(
      ["Date", "Pulse", "Productive", "Neutral", "Distracting"],
      data.map((r) => [
        r.date,
        String(r.productivityPulse),
        `${Math.round(r.productivePercentage)}%`,
        `${Math.round(r.neutralPercentage)}%`,
        `${Math.round(r.distractingPercentage)}%`,
      ]),
    );
  });

program
  .command("categories [days]")
  .description("Time by category (SoftDev, Comm, Social, etc.)")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.dailySummary(d);
    out.heading(`Categories — last ${d} days`);
    out.blank();

    if (data.length === 0) {
      out.info("No data.");
      return;
    }

    out.table(
      ["Date", "SoftDev", "Comm", "RefLearn", "BizOps", "Social", "Entertain", "News", "Other"],
      data.map((r) => [
        r.date,
        r.softwareDevFormatted,
        r.commFormatted,
        r.refLearningFormatted,
        r.businessFormatted,
        r.socialFormatted,
        r.entertainmentFormatted,
        r.newsFormatted,
        r.utilitiesFormatted,
      ]),
    );
  });

program
  .command("activities [days]")
  .description("Top apps/sites ranked by time spent")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.topActivities(d);
    out.heading(`Top Activities — last ${d} days`);
    out.blank();

    if (data.length === 0) {
      out.info("No activity data.");
      return;
    }

    out.table(
      ["Rank", "Hours", "Activity", "Category", "Productivity"],
      data.map((r) => [
        String(r.rank),
        String(Math.round((r.seconds / 3600) * 10) / 10),
        r.activity,
        r.category,
        productivityLabel(r.productivity),
      ]),
    );
  });

program
  .command("focus [days]")
  .description("Productive vs distracting time per day")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    const data = await provider.dailyFocus(d);
    out.heading(`Focus Breakdown — last ${d} days`);
    out.blank();

    if (data.length === 0) {
      out.info("No focus data.");
      return;
    }

    out.table(
      ["Date", "V.Productive", "Productive", "Neutral", "Distracting", "V.Distract", "Total Prod"],
      data.map((r) => [
        r.date,
        fmtHours(r.veryProductive),
        fmtHours(r.productive),
        fmtHours(r.neutral),
        fmtHours(r.distracting),
        fmtHours(r.veryDistracting),
        fmtHours(r.veryProductive + r.productive),
      ]),
    );
  });

program
  .command("focus-sessions")
  .description("Recent focus session history")
  .action(async () => {
    const { started, ended } = await provider.focusSessions();
    out.heading("Focus Sessions");
    out.blank();

    out.subheading("Started");
    if (started.length === 0) {
      out.info("No focus sessions recorded.");
    } else {
      out.table(
        ["Date", "Duration"],
        started.map((s) => [s.createdAt, `${s.duration} min`]),
      );
    }
    out.blank();

    out.subheading("Completed");
    if (ended.length === 0) {
      out.info("No completed sessions.");
    } else {
      out.table(
        ["Date", "Duration"],
        ended.map((s) => [s.createdAt, `${s.duration} min`]),
      );
    }
  });

program
  .command("highlights")
  .description("Daily highlights (user-entered notes)")
  .action(async () => {
    const data = await provider.highlights();
    out.heading("Highlights");
    out.blank();

    if (data.length === 0) {
      out.info("No highlights.");
      return;
    }

    out.table(
      ["Date", "Highlight"],
      data.map((h) => [h.date, h.description]),
    );
  });

program
  .command("overview [days]")
  .description("Full dashboard: pulse + categories + activities + focus")
  .action(async (days?: string) => {
    const d = parseInt(days ?? "7", 10);
    out.heading(`RescueTime Overview — last ${d} days`);
    out.blank();

    out.subheading("Productivity Pulse");
    const summaries = await provider.dailySummary(d);
    if (summaries.length === 0) {
      out.info("No data.");
    } else {
      out.table(
        ["Date", "Pulse", "Productive", "Neutral", "Distracting"],
        summaries.map((r) => [
          r.date,
          String(r.productivityPulse),
          `${Math.round(r.productivePercentage)}%`,
          `${Math.round(r.neutralPercentage)}%`,
          `${Math.round(r.distractingPercentage)}%`,
        ]),
      );
    }
    out.blank();

    out.subheading("Categories");
    if (summaries.length === 0) {
      out.info("No data.");
    } else {
      out.table(
        ["Date", "SoftDev", "Comm", "RefLearn", "BizOps", "Social", "Entertain", "News", "Other"],
        summaries.map((r) => [
          r.date,
          r.softwareDevFormatted,
          r.commFormatted,
          r.refLearningFormatted,
          r.businessFormatted,
          r.socialFormatted,
          r.entertainmentFormatted,
          r.newsFormatted,
          r.utilitiesFormatted,
        ]),
      );
    }
    out.blank();

    out.subheading("Top Activities");
    const activities = await provider.topActivities(d);
    if (activities.length === 0) {
      out.info("No activity data.");
    } else {
      out.table(
        ["Rank", "Hours", "Activity", "Category", "Productivity"],
        activities.map((r) => [
          String(r.rank),
          String(Math.round((r.seconds / 3600) * 10) / 10),
          r.activity,
          r.category,
          productivityLabel(r.productivity),
        ]),
      );
    }
    out.blank();

    out.subheading("Focus Breakdown");
    const focus = await provider.dailyFocus(d);
    if (focus.length === 0) {
      out.info("No focus data.");
    } else {
      out.table(
        ["Date", "V.Productive", "Productive", "Neutral", "Distracting", "V.Distract", "Total Prod"],
        focus.map((r) => [
          r.date,
          fmtHours(r.veryProductive),
          fmtHours(r.productive),
          fmtHours(r.neutral),
          fmtHours(r.distracting),
          fmtHours(r.veryDistracting),
          fmtHours(r.veryProductive + r.productive),
        ]),
      );
    }
  });

program
  .command("json <endpoint> [days]")
  .description("Raw JSON output (endpoints: summary, data, focus-started, focus-ended, highlights)")
  .action(async (endpoint: string, days?: string) => {
    out.json(await provider.json(endpoint, days ? parseInt(days, 10) : undefined));
  });

// ── Run ──────────────────────────────────────────────────────────

try {
  await program.parseAsync(process.argv);
} catch (e: unknown) {
  showError((e as Error).message);
  process.exit(1);
}
