#!/usr/bin/env bun
import { Command } from "commander";
import { register as registerTodoist } from "./modules/todoist/index.ts";
import { error } from "./lib/output.ts";

const program = new Command();

program
  .name("life")
  .description("Unified CLI for personal productivity tools")
  .version("0.1.0");

// Register modules
registerTodoist(program);

// Global error handler
program.hook("preAction", () => {
  // Nothing for now — hook point for future auth checks
});

// Parse
try {
  await program.parseAsync(process.argv);
} catch (e: unknown) {
  error((e as Error).message);
  process.exit(1);
}
