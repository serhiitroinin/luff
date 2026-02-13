#!/usr/bin/env bun
import { Command } from "commander";
import {
  setSecret,
  getSecret,
  hasSecret,
  error as showError,
} from "@luff/shared";
import * as out from "@luff/shared/output";
import { libreProvider, login } from "./providers/libre.ts";
import type { GlucoseProvider, TirAnalysis } from "./types.ts";

const TOOL = "libre";
const provider: GlucoseProvider = libreProvider;

// ── Formatting helpers ───────────────────────────────────────────

function tirCheck(value: number, target: number, op: "gte" | "lt"): string {
  if (op === "gte") return value >= target ? " ✓" : "";
  return value < target ? " ✓" : "";
}

function tirTarget(label: string, value: number, target: number, op: "gte" | "lt"): string {
  const pass = op === "gte" ? value >= target : value < target;
  return pass ? `✓ PASS` : `✗ MISS (${value}%)`;
}

function printTir(tir: TirAnalysis): void {
  out.info(`Readings:  ${tir.readings}`);
  out.blank();

  console.log("── Glucose ──────────────────────────");
  console.log(`  Mean:    ${tir.mean} mg/dL (${tir.meanMmol} mmol/L)`);
  console.log(`  SD:      ${tir.sd} mg/dL`);
  console.log(`  CV:      ${tir.cv}%${tir.cv < 33 ? " ✓" : tir.cv < 36 ? " ⚠" : " ✗"}`);
  console.log(`  Min:     ${tir.min} mg/dL  Max: ${tir.max} mg/dL`);
  console.log(`  GMI:     ${tir.gmi}%`);
  out.blank();

  console.log("── Time in Range ────────────────────");
  console.log(`  Very Low  (<54):     ${tir.veryLowPct}%  (${tir.veryLow}/${tir.readings})${tir.veryLow === 0 ? " ✓" : " ✗"}`);
  console.log(`  Low       (54-69):   ${tir.lowPct}%  (${tir.low}/${tir.readings})`);
  console.log(`  TBR total (<70):     ${tir.tbrPct}%${tirCheck(tir.tbrPct, 5, "lt")}`);
  console.log(`  In Range  (70-180):  ${tir.tirPct}%  (${tir.inRange}/${tir.readings})${tir.tirPct >= 80 ? " ✓" : tir.tirPct >= 70 ? " ⚠" : " ✗"}`);
  console.log(`  High      (181-250): ${tir.highPct}%  (${tir.high}/${tir.readings})`);
  console.log(`  Very High (>250):    ${tir.veryHighPct}%  (${tir.veryHigh}/${tir.readings})`);
  out.blank();

  console.log("── GPS 07.01 Targets ───────────────");
  console.log(`  TIR ≥80%:  ${tirTarget("TIR", tir.tirPct, 80, "gte")}`);
  console.log(`  TBR <5%:   ${tirTarget("TBR", tir.tbrPct, 5, "lt")}`);
  console.log(`  CV <33%:   ${tirTarget("CV", tir.cv, 33, "lt")}`);
  console.log(`  GMI <6.8%: ${tirTarget("GMI", tir.gmi, 6.8, "lt")}`);
}

// ── Program ──────────────────────────────────────────────────────

const program = new Command();
program.name("libre").description("FreeStyle Libre 3 CGM data CLI").version("0.1.2");

// ── Auth commands ────────────────────────────────────────────────

program
  .command("setup <email> <password>")
  .description("Save LibreLinkUp credentials (stored in macOS Keychain)")
  .action(async (email: string, password: string) => {
    setSecret(TOOL, "email", email);
    setSecret(TOOL, "password", password);
    out.success("Credentials saved to Keychain.");
    out.info("Now run: libre login");
  });

program
  .command("login")
  .description("Authenticate + discover patient")
  .action(async () => {
    await login();
  });

program
  .command("status")
  .description("Check connection status")
  .action(() => {
    if (!hasSecret(TOOL, "token")) {
      out.info("Not logged in. Run: libre login");
      return;
    }

    const url = getSecret(TOOL, "api-url") ?? "unknown";
    const patient = getSecret(TOOL, "patient-name") ?? "unknown";
    const expiresStr = getSecret(TOOL, "token-expires");
    const expires = expiresStr ? parseInt(expiresStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    console.log(`API:     ${url}`);
    console.log(`Patient: ${patient}`);

    if (now >= expires) {
      console.log("Token:   expired (will auto-refresh on next call)");
    } else {
      const days = Math.floor((expires - now) / 86400);
      console.log(`Token:   valid (${days} days remaining)`);
    }
    out.info("Credentials: macOS Keychain (service: luff-libre)");
  });

// ── Data commands ────────────────────────────────────────────────

program
  .command("current")
  .description("Current glucose + trend arrow")
  .action(async () => {
    const r = await provider.current();
    console.log(`${r.mgPerDl} mg/dL (${r.mmolPerL} mmol/L) ${r.trendArrow ?? ""}  [${r.rangeLabel}]`);
    console.log(`  at ${r.timestamp}`);
  });

program
  .command("graph")
  .description("Last 12h readings (table)")
  .action(async () => {
    const { current, readings } = await provider.graph();

    if (current) {
      console.log(`Current: ${current.mgPerDl} mg/dL (${current.mmolPerL} mmol/L) ${current.trendArrow ?? ""}  at ${current.timestamp}`);
      out.blank();
    }

    out.info(`Last 12h — ${readings.length} readings`);
    out.blank();

    if (readings.length === 0) {
      out.info("No graph data.");
      return;
    }

    out.table(
      ["Time", "mg/dL", "mmol/L", "Range"],
      readings.map((r) => [
        r.timestamp,
        String(r.mgPerDl),
        String(r.mmolPerL),
        r.rangeLabel === "IN RANGE" ? "ok" : r.rangeLabel,
      ]),
    );
  });

program
  .command("logbook")
  .description("Last ~2 weeks (table)")
  .action(async () => {
    const readings = await provider.logbook();
    out.info(`Logbook — ${readings.length} entries`);
    out.blank();

    if (readings.length === 0) {
      out.info("No logbook data.");
      return;
    }

    out.table(
      ["Timestamp", "mg/dL", "mmol/L", "Range"],
      readings.map((r) => [
        r.timestamp,
        String(r.mgPerDl),
        String(r.mmolPerL),
        r.rangeLabel === "IN RANGE" ? "ok" : r.rangeLabel,
      ]),
    );
  });

program
  .command("tir [source]")
  .description("TIR/TBR/TAR/CV/SD/GMI analysis (source: graph or logbook, default: graph)")
  .action(async (source?: string) => {
    const src = (source ?? "graph") as "graph" | "logbook";
    if (src !== "graph" && src !== "logbook") {
      out.error("Usage: tir [graph|logbook] (default: graph)");
      process.exit(1);
    }

    const tir = await provider.tir(src);
    out.heading(`TIR Analysis — ${tir.source}`);
    out.blank();

    if (tir.readings === 0) {
      out.info("No readings available.");
      return;
    }

    printTir(tir);
  });

program
  .command("overview")
  .description("Current + 12h TIR summary")
  .action(async () => {
    out.heading("Libre 3 Overview");
    out.blank();

    // Use graph endpoint — gives both current + 12h data in one call
    const { current, readings } = await provider.graph();

    out.subheading("Current");
    if (current) {
      console.log(`  ${current.mgPerDl} mg/dL (${current.mmolPerL} mmol/L) ${current.trendArrow ?? ""}  [${current.rangeLabel}]  at ${current.timestamp}`);
    } else {
      out.info("  No current reading.");
    }
    out.blank();

    out.subheading("TIR (12h)");
    if (readings.length === 0) {
      out.info("  No data.");
      return;
    }

    const values = readings.map((r) => r.mgPerDl);
    const n = values.length;
    const preciseMean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + (v - preciseMean) ** 2, 0) / n;
    const sd = Math.round(Math.sqrt(variance) * 10) / 10;
    const cv = Math.round((sd / preciseMean) * 1000) / 10;
    const gmi = Math.round(((preciseMean + 46.7) / 28.7) * 10) / 10;
    const mean = Math.round(preciseMean);

    const below = values.filter((v) => v < 70).length;
    const inRange = values.filter((v) => v >= 70 && v <= 180).length;
    const above = values.filter((v) => v > 180).length;

    const pct = (c: number) => Math.round(c * 1000 / n) / 10;

    console.log(`  Readings: ${n} | Mean: ${mean} mg/dL | SD: ${sd} | CV: ${cv}%`);
    console.log(`  TIR: ${pct(inRange)}%${pct(inRange) >= 80 ? " ✓" : ""} | TBR: ${pct(below)}%${pct(below) < 5 ? " ✓" : ""} | TAR: ${pct(above)}%`);
    console.log(`  GMI: ${gmi}% | Range: ${Math.min(...values)}–${Math.max(...values)} mg/dL`);
  });

program
  .command("json <path>")
  .description("Raw JSON from any endpoint (e.g. /llu/connections)")
  .action(async (path: string) => {
    out.json(await provider.json(path));
  });

// ── Run ──────────────────────────────────────────────────────────

try {
  await program.parseAsync(process.argv);
} catch (e: unknown) {
  showError((e as Error).message);
  process.exit(1);
}
