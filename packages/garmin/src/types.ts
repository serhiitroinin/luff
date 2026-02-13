/** Provider-agnostic types for the garmin CLI */

export interface TrainingReadiness {
  date: string;
  score: number;
  level: string;
  sleepScore: number;
  hrvFactor: number;
  recoveryFactor: number;
  loadFactor: number;
  stressFactor: number;
}

export interface SleepData {
  date: string;
  score: number | null;
  totalSeconds: number;
  remSeconds: number;
  deepSeconds: number;
  lightSeconds: number;
  awakeSeconds: number;
}

export interface HeartRate {
  date: string;
  restingHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  avgRhr7d: number | null;
}

export interface HrvData {
  date: string;
  lastNightAvg: number | null;
  weeklyAvg: number | null;
  lastNight5MinHigh: number | null;
  baselineLow: number | null;
  baselineBalancedLow: number | null;
  baselineBalancedHigh: number | null;
  status: string | null;
}

export interface StressData {
  date: string;
  avgStress: number | null;
  maxStress: number | null;
  qualifier: string | null;
}

export interface BodyBattery {
  date: string;
  charged: number | null;
  drained: number | null;
  highest: number | null;
  lowest: number | null;
  atWake: number | null;
}

export interface StepData {
  date: string;
  totalSteps: number;
  distanceMeters: number;
  stepGoal: number;
  floorsAscended: number;
}

export interface Activity {
  date: string;
  name: string;
  type: string;
  durationSeconds: number;
  distanceMeters: number | null;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
}

export interface DailySummary {
  date: string;
  totalSteps: number;
  distanceMeters: number;
  activeKcal: number;
  restingHr: number | null;
  minHr: number | null;
  maxHr: number | null;
  avgStress: number | null;
  bbAtWake: number | null;
  floorsAscended: number;
}

/** Every fitness data provider must implement this interface */
export interface FitnessProvider {
  name: string;

  trainingReadiness(days: number): Promise<TrainingReadiness[]>;
  sleep(days: number): Promise<SleepData[]>;
  heartRate(days: number): Promise<HeartRate[]>;
  hrv(days: number): Promise<HrvData[]>;
  stress(days: number): Promise<StressData[]>;
  bodyBattery(days: number): Promise<BodyBattery[]>;
  steps(days: number): Promise<StepData[]>;
  activities(days: number): Promise<Activity[]>;
  daily(days: number): Promise<DailySummary[]>;
  json(path: string, params?: Record<string, string>): Promise<unknown>;
}
