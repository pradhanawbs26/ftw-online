export interface FitToWorkAssessment {
  id: string;
  timestamp: string;
  nama: string;
  nik: string;
  
  // Timing parameters
  shiftStart: string; // ISO String
  currentSleepStart: string; // ISO String
  currentSleepEnd: string; // ISO String
  prevSleepStart: string; // ISO String
  prevSleepEnd: string; // ISO String

  // Calculated intermediate values
  sleepLast12h: number; // hours
  sleepLast36h: number; // hours
  awakeLast12h: number; // hours (duration awake inside the last 12 hrs before shift start)

  // Risk parameters
  consumesObat: boolean;
  hasPersonalProblem: boolean;

  // Computed scores
  scoreA: number; // 12h sleep fatigue score
  scoreB: number; // 36h sleep fatigue score
  scoreC: number; // awake 12h fatigue score
  totalFatigueScore: number; // A + B + C

  // Result and outcomes
  fatigueCategory: 'NORMAL' | 'LAPOR' | 'REST' | 'REJECT';
  obatAction: 'NORMAL' | 'OBSERVE';
  problemAction: 'NORMAL' | 'CNC';
  finalDecision: 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT';
}

export type ThemeType = 'light' | 'dark' | 'industrial';
