import { HttpClient, requireSecret } from "@luff/shared";
import type {
  ProductivityProvider,
  DailySummary,
  RankedActivity,
  DailyFocus,
  FocusSession,
  Highlight,
} from "../types.ts";

const TOOL = "rescuetime";
const BASE_URL = "https://www.rescuetime.com";

// ── Raw API types ────────────────────────────────────────────────

interface RawDailySummary {
  date: string;
  productivity_pulse: number;
  total_hours: number;
  all_productive_percentage: number;
  neutral_percentage: number;
  all_distracting_percentage: number;
  software_development_duration_formatted: string;
  communication_and_scheduling_duration_formatted: string;
  reference_and_learning_duration_formatted: string;
  business_duration_formatted: string;
  social_networking_duration_formatted: string;
  entertainment_duration_formatted: string;
  news_duration_formatted: string;
  utilities_duration_formatted: string;
}

interface RawAnalyticData {
  row_headers: string[];
  rows: (string | number)[][];
}

interface RawFocusSession {
  created_at: string;
  duration: number;
}

interface RawHighlight {
  date: string;
  description: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function client(): HttpClient {
  return new HttpClient({ baseUrl: BASE_URL });
}

function apiKey(): string {
  return requireSecret(TOOL, "api-key");
}

function dateRange(days: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return {
    start: start.toISOString().split("T")[0],
    end: now.toISOString().split("T")[0],
  };
}

// ── Mappers ──────────────────────────────────────────────────────

function mapSummary(r: RawDailySummary): DailySummary {
  return {
    date: r.date,
    productivityPulse: r.productivity_pulse,
    totalHours: r.total_hours,
    productivePercentage: r.all_productive_percentage,
    neutralPercentage: r.neutral_percentage,
    distractingPercentage: r.all_distracting_percentage,
    softwareDevFormatted: r.software_development_duration_formatted ?? "0s",
    commFormatted: r.communication_and_scheduling_duration_formatted ?? "0s",
    refLearningFormatted: r.reference_and_learning_duration_formatted ?? "0s",
    businessFormatted: r.business_duration_formatted ?? "0s",
    socialFormatted: r.social_networking_duration_formatted ?? "0s",
    entertainmentFormatted: r.entertainment_duration_formatted ?? "0s",
    newsFormatted: r.news_duration_formatted ?? "0s",
    utilitiesFormatted: r.utilities_duration_formatted ?? "0s",
  };
}

function productivityLabel(score: number): string {
  if (score === 2) return "Very Productive";
  if (score === 1) return "Productive";
  if (score === 0) return "Neutral";
  if (score === -1) return "Distracting";
  if (score === -2) return "Very Distracting";
  return "Unknown";
}

// ── Provider ─────────────────────────────────────────────────────

export const rescuetimeProvider: ProductivityProvider = {
  name: "rescuetime",

  async dailySummary(days) {
    const http = client();
    const raw = await http.get<RawDailySummary[]>("/anapi/daily_summary_feed", {
      key: apiKey(),
      format: "json",
    });
    return raw
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days)
      .map(mapSummary);
  },

  async topActivities(days) {
    const http = client();
    const { start, end } = dateRange(days);
    const raw = await http.get<RawAnalyticData>("/anapi/data", {
      key: apiKey(),
      format: "json",
      perspective: "rank",
      restrict_kind: "activity",
      restrict_begin: start,
      restrict_end: end,
    });
    return (raw.rows ?? []).slice(0, 20).map((row, i) => ({
      rank: i + 1,
      seconds: row[1] as number,
      activity: row[3] as string,
      category: row[4] as string,
      productivity: row[5] as number,
    }));
  },

  async dailyFocus(days) {
    const http = client();
    const { start, end } = dateRange(days);
    const raw = await http.get<RawAnalyticData>("/anapi/data", {
      key: apiKey(),
      format: "json",
      perspective: "interval",
      resolution_time: "day",
      restrict_kind: "productivity",
      restrict_begin: start,
      restrict_end: end,
    });

    // Group rows by date, sum by productivity level
    const byDate = new Map<string, DailyFocus>();
    for (const row of raw.rows ?? []) {
      const date = (row[0] as string).slice(0, 10);
      const seconds = row[1] as number;
      const level = row[3] as number;

      if (!byDate.has(date)) {
        byDate.set(date, {
          date,
          veryProductive: 0,
          productive: 0,
          neutral: 0,
          distracting: 0,
          veryDistracting: 0,
        });
      }
      const entry = byDate.get(date)!;
      if (level === 2) entry.veryProductive += seconds;
      else if (level === 1) entry.productive += seconds;
      else if (level === 0) entry.neutral += seconds;
      else if (level === -1) entry.distracting += seconds;
      else if (level === -2) entry.veryDistracting += seconds;
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  },

  async focusSessions() {
    const http = client();
    const key = apiKey();
    const [started, ended] = await Promise.all([
      http.get<RawFocusSession[]>("/anapi/focustime_started_feed", { key, format: "json" }),
      http.get<RawFocusSession[]>("/anapi/focustime_ended_feed", { key, format: "json" }),
    ]);
    return {
      started: (started ?? []).slice(0, 20).map((s) => ({
        createdAt: s.created_at,
        duration: s.duration,
      })),
      ended: (ended ?? []).slice(0, 20).map((s) => ({
        createdAt: s.created_at,
        duration: s.duration,
      })),
    };
  },

  async highlights() {
    const http = client();
    const raw = await http.get<RawHighlight[]>("/anapi/highlights_feed", {
      key: apiKey(),
      format: "json",
    });
    return (raw ?? []).slice(0, 20).map((h) => ({
      date: h.date,
      description: h.description,
    }));
  },

  async json(endpoint, days) {
    const http = client();
    const key = apiKey();
    switch (endpoint) {
      case "summary":
        return http.get("/anapi/daily_summary_feed", { key, format: "json" });
      case "data": {
        const { start, end } = dateRange(days ?? 7);
        return http.get("/anapi/data", {
          key,
          format: "json",
          perspective: "rank",
          restrict_kind: "activity",
          restrict_begin: start,
          restrict_end: end,
        });
      }
      case "focus-started":
        return http.get("/anapi/focustime_started_feed", { key, format: "json" });
      case "focus-ended":
        return http.get("/anapi/focustime_ended_feed", { key, format: "json" });
      case "highlights":
        return http.get("/anapi/highlights_feed", { key, format: "json" });
      default:
        throw new Error(`Unknown endpoint: ${endpoint}. Try: summary, data, focus-started, focus-ended, highlights`);
    }
  },
};

export { productivityLabel };
