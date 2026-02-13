import { getSecret, setSecret } from "@luff/shared";
import { getValidAccessToken } from "../auth.ts";
import type {
  FitnessProvider,
  TrainingReadiness,
  SleepData,
  HeartRate,
  HrvData,
  StressData,
  BodyBattery,
  StepData,
  Activity,
  DailySummary,
} from "../types.ts";

const TOOL = "garmin";
const BASE_URL = "https://connectapi.garmin.com";

const UA = "com.garmin.android.apps.connectmobile";

// ── API helpers ──────────────────────────────────────────────────

async function apiGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getValidAccessToken();
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} GET ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function getDisplayName(): Promise<string> {
  const cached = getSecret(TOOL, "display-name");
  if (cached) return cached;

  const profile = await apiGet<{ displayName?: string; userName?: string }>(
    "/userprofile-service/socialProfile"
  );
  const name = profile?.displayName || profile?.userName;
  if (!name) throw new Error("Could not determine display name from profile");

  setSecret(TOOL, "display-name", name);
  return name;
}

function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

// ── Provider ─────────────────────────────────────────────────────

export const garminProvider: FitnessProvider = {
  name: "garmin",

  async trainingReadiness(days) {
    const results: TrainingReadiness[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(`/metrics-service/metrics/trainingreadiness/${date}`);
        if (!raw || raw.length === 0) continue;
        const r = Array.isArray(raw) ? raw[0] : raw;
        results.push({
          date: r.calendarDate ?? date,
          score: r.score ?? 0,
          level: r.level ?? "UNKNOWN",
          sleepScore: r.sleepScoreFactorPercent ?? r.sleepScore ?? 0,
          hrvFactor: r.hrvFactorPercent ?? 0,
          recoveryFactor: r.recoveryTimeFactorPercent ?? 0,
          loadFactor: r.acwrFactorPercent ?? 0,
          stressFactor: r.stressHistoryFactorPercent ?? 0,
        });
      } catch {
        // Some days may not have data
      }
    }
    return results.reverse();
  },

  async sleep(days) {
    const displayName = await getDisplayName();
    const results: SleepData[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(
          `/wellness-service/wellness/dailySleepData/${displayName}`,
          { date, nonSleepBufferMinutes: "60" },
        );
        if (!raw || !raw.dailySleepDTO) continue;
        const s = raw.dailySleepDTO;
        results.push({
          date: s.calendarDate ?? date,
          score: s.sleepScores?.overall?.value ?? null,
          totalSeconds: s.sleepTimeSeconds ?? 0,
          remSeconds: s.remSleepSeconds ?? 0,
          deepSeconds: s.deepSleepSeconds ?? 0,
          lightSeconds: s.lightSleepSeconds ?? 0,
          awakeSeconds: s.awakeSleepSeconds ?? 0,
        });
      } catch {
        // Skip missing days
      }
    }
    return results.reverse();
  },

  async heartRate(days) {
    const displayName = await getDisplayName();
    const results: HeartRate[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(
          `/wellness-service/wellness/dailyHeartRate/${displayName}`,
          { date },
        );
        if (!raw) continue;
        results.push({
          date: raw.calendarDate ?? date,
          restingHr: raw.restingHeartRate ?? null,
          minHr: raw.minHeartRate ?? null,
          maxHr: raw.maxHeartRate ?? null,
          avgRhr7d: raw.lastSevenDaysAvgRestingHeartRate ?? null,
        });
      } catch {
        // Skip
      }
    }
    return results.reverse();
  },

  async hrv(days) {
    const results: HrvData[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(`/hrv-service/hrv/${date}`);
        if (!raw || !raw.hrvSummary) continue;
        const h = raw.hrvSummary;
        results.push({
          date: h.calendarDate ?? date,
          lastNightAvg: h.lastNightAvg ?? null,
          weeklyAvg: h.weeklyAvg ?? null,
          lastNight5MinHigh: h.lastNight5MinHigh ?? null,
          baselineLow: h.baseline?.lowUpper ?? null,
          baselineBalancedLow: h.baseline?.balancedLow ?? null,
          baselineBalancedHigh: h.baseline?.balancedUpper ?? null,
          status: h.status ?? null,
        });
      } catch {
        // Skip
      }
    }
    return results.reverse();
  },

  async stress(days) {
    const displayName = await getDisplayName();
    const results: StressData[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        // Get stress from daily summary which has stress data
        const raw = await apiGet<any>(
          `/usersummary-service/usersummary/daily/${displayName}`,
          { calendarDate: date },
        );
        if (!raw) continue;
        results.push({
          date: raw.calendarDate ?? date,
          avgStress: raw.averageStressLevel ?? null,
          maxStress: raw.maxStressLevel ?? null,
          qualifier: raw.stressQualifier ?? null,
        });
      } catch {
        // Skip
      }
    }
    return results.reverse();
  },

  async bodyBattery(days) {
    const start = dateStr(days - 1);
    const end = today();
    try {
      const raw = await apiGet<any[]>(
        "/wellness-service/wellness/bodyBattery/reports/daily",
        { startDate: start, endDate: end },
      );
      if (!raw || !Array.isArray(raw)) return [];
      return raw.map((r) => {
        const vals: number[] = (r.bodyBatteryValuesArray ?? []).map((v: number[]) => v[1]);
        return {
          date: r.calendarDate ?? r.date ?? "",
          charged: r.charged ?? null,
          drained: r.drained ?? null,
          highest: vals.length ? Math.max(...vals) : null,
          lowest: vals.length ? Math.min(...vals) : null,
          atWake: null,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  },

  async steps(days) {
    const start = dateStr(days - 1);
    const end = today();
    const displayName = await getDisplayName();
    const results: StepData[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(
          `/usersummary-service/usersummary/daily/${displayName}`,
          { calendarDate: date },
        );
        if (!raw) continue;
        results.push({
          date: raw.calendarDate ?? date,
          totalSteps: raw.totalSteps ?? 0,
          distanceMeters: raw.totalDistanceMeters ?? 0,
          stepGoal: raw.dailyStepGoal ?? 0,
          floorsAscended: raw.floorsAscended ?? 0,
        });
      } catch {
        // Skip
      }
    }
    return results.reverse();
  },

  async activities(days) {
    const start = dateStr(days - 1);
    try {
      const raw = await apiGet<any[]>(
        "/activitylist-service/activities/search/activities",
        { start: "0", limit: "50", startDate: start, endDate: today() },
      );
      if (!raw || !Array.isArray(raw)) return [];
      return raw.map((a) => ({
        date: (a.startTimeLocal ?? a.startTimeGMT ?? "").slice(0, 10),
        name: a.activityName ?? "Unknown",
        type: a.activityType?.typeKey ?? "unknown",
        durationSeconds: a.duration ?? 0,
        distanceMeters: a.distance ?? null,
        avgHr: a.averageHR ?? null,
        maxHr: a.maxHR ?? null,
        calories: a.calories ?? null,
      })).sort((a, b) => a.date.localeCompare(b.date));
    } catch {
      return [];
    }
  },

  async daily(days) {
    const displayName = await getDisplayName();
    const results: DailySummary[] = [];
    for (let i = 0; i < days; i++) {
      const date = dateStr(i);
      try {
        const raw = await apiGet<any>(
          `/usersummary-service/usersummary/daily/${displayName}`,
          { calendarDate: date },
        );
        if (!raw) continue;
        results.push({
          date: raw.calendarDate ?? date,
          totalSteps: raw.totalSteps ?? 0,
          distanceMeters: raw.totalDistanceMeters ?? 0,
          activeKcal: raw.activeKilocalories ?? 0,
          restingHr: raw.restingHeartRate ?? null,
          minHr: raw.minHeartRate ?? null,
          maxHr: raw.maxHeartRate ?? null,
          avgStress: raw.averageStressLevel ?? null,
          bbAtWake: raw.bodyBatteryAtWakeTime ?? null,
          floorsAscended: raw.floorsAscended ?? 0,
        });
      } catch {
        // Skip
      }
    }
    return results.reverse();
  },

  async json(path, params) {
    return apiGet(path, params);
  },
};
