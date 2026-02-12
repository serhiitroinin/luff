import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "life");

export function getConfigDir(): string {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    chmodSync(CONFIG_DIR, 0o700);
  }
  return CONFIG_DIR;
}

export function getModuleConfigPath(module: string): string {
  return join(getConfigDir(), `${module}.json`);
}

export function readConfig<T>(module: string): T | null {
  const path = getModuleConfigPath(module);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function writeConfig<T>(module: string, data: T): void {
  const path = getModuleConfigPath(module);
  getConfigDir(); // ensure dir exists
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  chmodSync(path, 0o600);
}

export function requireConfig<T>(module: string): T {
  const config = readConfig<T>(module);
  if (!config) {
    throw new Error(
      `No config for "${module}". Run: life ${module} setup`
    );
  }
  return config;
}
