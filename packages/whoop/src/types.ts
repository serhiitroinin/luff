/** Provider-agnostic types for the whoop CLI */

export interface WhoopProfile {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
}

export interface WhoopBody {
  heightMeter: number;
  weightKilogram: number;
  maxHeartRate: number;
}

export interface WhoopRecovery {
  cycleId: number;
  createdAt: string;
  scoreState: string;
  score: {
    recoveryScore: number;
    hrvRmssdMilli: number;
    restingHeartRate: number;
    spo2Percentage: number | null;
    skinTempCelsius: number | null;
  } | null;
}

export interface WhoopSleep {
  id: number;
  start: string;
  end: string;
  nap: boolean;
  scoreState: string;
  score: {
    sleepPerformancePercentage: number | null;
    totalInBedMs: number;
    totalRemMs: number;
    totalDeepMs: number;
    totalLightMs: number;
    totalAwakeMs: number;
  } | null;
}

export interface WhoopWorkout {
  id: number;
  start: string;
  end: string;
  sportName: string;
  scoreState: string;
  score: {
    strain: number;
    averageHeartRate: number;
    maxHeartRate: number;
    kilojoule: number;
    distanceMeter: number | null;
  } | null;
}

export interface WhoopCycle {
  id: number;
  start: string;
  end: string | null;
  scoreState: string;
  score: {
    strain: number;
    averageHeartRate: number;
    maxHeartRate: number;
    kilojoule: number;
  } | null;
}

/** Every health-data provider must implement this interface */
export interface WhoopProvider {
  name: string;

  profile(): Promise<WhoopProfile>;
  body(): Promise<WhoopBody>;
  recovery(days: number): Promise<WhoopRecovery[]>;
  sleep(days: number): Promise<WhoopSleep[]>;
  workouts(days: number): Promise<WhoopWorkout[]>;
  cycles(days: number): Promise<WhoopCycle[]>;
  json(path: string, params?: Record<string, string>): Promise<unknown>;
}
