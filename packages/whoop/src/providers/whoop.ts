import {
  HttpClient,
  getValidAccessToken,
  type OAuth2Config,
} from "@luff/shared";
import type {
  WhoopProvider,
  WhoopProfile,
  WhoopBody,
  WhoopRecovery,
  WhoopSleep,
  WhoopWorkout,
  WhoopCycle,
} from "../types.ts";

const TOOL = "whoop";
const BASE_URL = "https://api.prod.whoop.com/developer";

export const OAUTH2_CONFIG: OAuth2Config = {
  authorizeUrl: "https://api.prod.whoop.com/oauth/oauth2/auth",
  tokenUrl: "https://api.prod.whoop.com/oauth/oauth2/token",
  scopes: [
    "read:recovery",
    "read:cycles",
    "read:sleep",
    "read:workout",
    "read:profile",
    "read:body_measurement",
    "offline",
  ],
};

// ── Raw API types (snake_case) ───────────────────────────────────

interface RawRecovery {
  cycle_id: number;
  created_at: string;
  score_state: string;
  score: {
    recovery_score: number;
    hrv_rmssd_milli: number;
    resting_heart_rate: number;
    spo2_percentage: number | null;
    skin_temp_celsius: number | null;
  } | null;
}

interface RawSleep {
  id: number;
  start: string;
  end: string;
  nap: boolean;
  score_state: string;
  score: {
    sleep_performance_percentage: number | null;
    stage_summary: {
      total_in_bed_time_milli: number;
      total_rem_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_light_sleep_time_milli: number;
      total_awake_time_milli: number;
    };
  } | null;
}

interface RawWorkout {
  id: number;
  start: string;
  end: string;
  sport_name: string;
  score_state: string;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    distance_meter: number | null;
  } | null;
}

interface RawCycle {
  id: number;
  start: string;
  end: string | null;
  score_state: string;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
  } | null;
}

interface RawProfile {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
}

interface RawBody {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

interface Paginated<T> {
  records: T[];
  next_token: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────

async function client(): Promise<HttpClient> {
  const token = await getValidAccessToken(TOOL, OAUTH2_CONFIG);
  return new HttpClient({
    baseUrl: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getAll<T>(
  http: HttpClient,
  path: string,
  params?: Record<string, string>,
): Promise<T[]> {
  let all: T[] = [];
  let nextToken: string | undefined;
  for (let i = 0; i < 40; i++) {
    const p: Record<string, string> = { ...params, limit: "25" };
    if (nextToken) p.nextToken = nextToken;
    const res = await http.get<Paginated<T>>(path, p);
    all = all.concat(res.records ?? []);
    if (!res.next_token) break;
    nextToken = res.next_token;
  }
  return all;
}

function dateRange(days: number): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return {
    start: start.toISOString(),
    end: now.toISOString(),
  };
}

// ── Mappers ──────────────────────────────────────────────────────

function mapRecovery(r: RawRecovery): WhoopRecovery {
  return {
    cycleId: r.cycle_id,
    createdAt: r.created_at,
    scoreState: r.score_state,
    score: r.score
      ? {
          recoveryScore: r.score.recovery_score,
          hrvRmssdMilli: r.score.hrv_rmssd_milli,
          restingHeartRate: r.score.resting_heart_rate,
          spo2Percentage: r.score.spo2_percentage,
          skinTempCelsius: r.score.skin_temp_celsius,
        }
      : null,
  };
}

function mapSleep(r: RawSleep): WhoopSleep {
  return {
    id: r.id,
    start: r.start,
    end: r.end,
    nap: r.nap,
    scoreState: r.score_state,
    score: r.score
      ? {
          sleepPerformancePercentage: r.score.sleep_performance_percentage,
          totalInBedMs: r.score.stage_summary.total_in_bed_time_milli,
          totalRemMs: r.score.stage_summary.total_rem_sleep_time_milli,
          totalDeepMs: r.score.stage_summary.total_slow_wave_sleep_time_milli,
          totalLightMs: r.score.stage_summary.total_light_sleep_time_milli,
          totalAwakeMs: r.score.stage_summary.total_awake_time_milli,
        }
      : null,
  };
}

function mapWorkout(r: RawWorkout): WhoopWorkout {
  return {
    id: r.id,
    start: r.start,
    end: r.end,
    sportName: r.sport_name,
    scoreState: r.score_state,
    score: r.score
      ? {
          strain: r.score.strain,
          averageHeartRate: r.score.average_heart_rate,
          maxHeartRate: r.score.max_heart_rate,
          kilojoule: r.score.kilojoule,
          distanceMeter: r.score.distance_meter,
        }
      : null,
  };
}

function mapCycle(r: RawCycle): WhoopCycle {
  return {
    id: r.id,
    start: r.start,
    end: r.end,
    scoreState: r.score_state,
    score: r.score
      ? {
          strain: r.score.strain,
          averageHeartRate: r.score.average_heart_rate,
          maxHeartRate: r.score.max_heart_rate,
          kilojoule: r.score.kilojoule,
        }
      : null,
  };
}

function mapProfile(r: RawProfile): WhoopProfile {
  return {
    userId: r.user_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
  };
}

function mapBody(r: RawBody): WhoopBody {
  return {
    heightMeter: r.height_meter,
    weightKilogram: r.weight_kilogram,
    maxHeartRate: r.max_heart_rate,
  };
}

// ── Provider ─────────────────────────────────────────────────────

export const whoopProvider: WhoopProvider = {
  name: "whoop",

  async profile() {
    const http = await client();
    return mapProfile(await http.get<RawProfile>("/v2/user/profile/basic"));
  },

  async body() {
    const http = await client();
    return mapBody(await http.get<RawBody>("/v2/user/measurement/body"));
  },

  async recovery(days) {
    const http = await client();
    const { start, end } = dateRange(days);
    const raw = await getAll<RawRecovery>(http, "/v2/recovery", { start, end });
    return raw.map(mapRecovery);
  },

  async sleep(days) {
    const http = await client();
    const { start, end } = dateRange(days);
    const raw = await getAll<RawSleep>(http, "/v2/activity/sleep", { start, end });
    return raw.map(mapSleep);
  },

  async workouts(days) {
    const http = await client();
    const { start, end } = dateRange(days);
    const raw = await getAll<RawWorkout>(http, "/v2/activity/workout", { start, end });
    return raw.map(mapWorkout);
  },

  async cycles(days) {
    const http = await client();
    const { start, end } = dateRange(days);
    const raw = await getAll<RawCycle>(http, "/v2/cycle", { start, end });
    return raw.map(mapCycle);
  },

  async json(path, params) {
    const http = await client();
    return http.get(path, params);
  },
};
