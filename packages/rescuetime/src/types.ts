/** Provider-agnostic types for the rescuetime CLI */

export interface DailySummary {
  date: string;
  productivityPulse: number;
  totalHours: number;
  productivePercentage: number;
  neutralPercentage: number;
  distractingPercentage: number;
  softwareDevFormatted: string;
  commFormatted: string;
  refLearningFormatted: string;
  businessFormatted: string;
  socialFormatted: string;
  entertainmentFormatted: string;
  newsFormatted: string;
  utilitiesFormatted: string;
}

export interface RankedActivity {
  rank: number;
  seconds: number;
  activity: string;
  category: string;
  productivity: number; // -2 to +2
}

export interface DailyFocus {
  date: string;
  veryProductive: number; // seconds
  productive: number;
  neutral: number;
  distracting: number;
  veryDistracting: number;
}

export interface FocusSession {
  createdAt: string;
  duration: number; // minutes
}

export interface Highlight {
  date: string;
  description: string;
}

/** Every productivity provider must implement this interface */
export interface ProductivityProvider {
  name: string;

  dailySummary(days: number): Promise<DailySummary[]>;
  topActivities(days: number): Promise<RankedActivity[]>;
  dailyFocus(days: number): Promise<DailyFocus[]>;
  focusSessions(): Promise<{ started: FocusSession[]; ended: FocusSession[] }>;
  highlights(): Promise<Highlight[]>;
  json(endpoint: string, days?: number): Promise<unknown>;
}
