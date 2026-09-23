import { FitToWorkAssessment } from './types';

export function calculateHoursFromTimeStrings(bedtime: string, wakeTime: string): number {
  if (!bedtime || !wakeTime) return 0;
  const [bHr, bMin] = bedtime.split(':').map(Number);
  const [wHr, wMin] = wakeTime.split(':').map(Number);
  
  if (isNaN(bHr) || isNaN(bMin) || isNaN(wHr) || isNaN(wMin)) return 0;
  
  let diffMin = (wHr * 60 + wMin) - (bHr * 60 + bMin);
  if (diffMin < 0) {
    // Wrapped across midnight (e.g. bedtime 23:00 to wake time 06:00 is -17 hrs, corrected to +7 hrs)
    diffMin += 24 * 60;
  }
  
  return parseFloat((diffMin / 60).toFixed(1));
}

export function calculateOverlapHours(
  sleepStartStr: string,
  sleepEndStr: string,
  windowStart: Date,
  windowEnd: Date
): number {
  if (!sleepStartStr || !sleepEndStr) return 0;
  
  const sleepStart = new Date(sleepStartStr);
  const sleepEnd = new Date(sleepEndStr);
  
  if (isNaN(sleepStart.getTime()) || isNaN(sleepEnd.getTime())) return 0;
  if (sleepStart >= sleepEnd) return 0;

  const start = Math.max(sleepStart.getTime(), windowStart.getTime());
  const end = Math.min(sleepEnd.getTime(), windowEnd.getTime());

  if (start < end) {
    return (end - start) / (1000 * 60 * 60); // convert millseconds to hours
  }
  return 0;
}

export function calculateScoreA(hours: number): number {
  if (hours <= 1.5) return 20;
  if (hours <= 2.5) return 16;
  if (hours <= 3.5) return 12;
  if (hours <= 4.5) return 8;
  if (hours <= 5.5) return 6;
  if (hours <= 6.5) return 3;
  return 0; // >= 7 jam
}

export function calculateScoreB(hours: number): number {
  if (hours < 7.5) return 8;
  if (hours < 8.5) return 7;
  if (hours < 9.5) return 6;
  if (hours < 10.5) return 5;
  if (hours < 11.5) return 4;
  if (hours < 12.5) return 3;
  if (hours < 13.5) return 2;
  return 1; // >= 14 jam
}

export function calculateScoreC(awakeMinusSleep: number): number {
  if (awakeMinusSleep < 0.5) return 0; // < 1 jam or negative
  if (awakeMinusSleep < 1.5) return 1; // 1 jam
  if (awakeMinusSleep < 2.5) return 2; // 2 jam
  return 3; // >= 3 jam or larger
}

export function getFatigueCategory(score: number): 'NORMAL' | 'LAPOR' | 'REST' | 'REJECT' {
  if (score <= 6) return 'NORMAL';
  if (score <= 8) return 'LAPOR';
  if (score <= 10) return 'REST';
  return 'REJECT';
}

export function getFinalDecision(
  fatigueCategory: 'NORMAL' | 'LAPOR' | 'REST' | 'REJECT',
  consumesObat: boolean,
  hasPersonalProblem: boolean
): 'FIT' | 'FIT_CONDITIONAL' | 'REST_BEFORE_WORK' | 'UNFIT' {
  if (fatigueCategory === 'REJECT') {
    return 'UNFIT';
  }
  if (fatigueCategory === 'REST') {
    return 'REST_BEFORE_WORK';
  }
  if (fatigueCategory === 'LAPOR') {
    return 'FIT_CONDITIONAL'; // needs to report to supervisor
  }
  if (consumesObat || hasPersonalProblem) {
    return 'FIT_CONDITIONAL'; // needs observation or CNC interview
  }
  return 'FIT';
}

// Generate some realistic historical logging to populate dashboard automatically
export function generateMockHistory(): FitToWorkAssessment[] {
  const now = new Date();
  
  const sample1: FitToWorkAssessment = {
    id: "FTW-10492-01",
    timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000 - 3 * 3600 * 1000).toISOString(),
    nama: "Andi Saputra",
    nik: "A0483",
    shiftStart: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    currentSleepStart: new Date(now.getTime() - 32 * 60 * 60 * 1000).toISOString(),
    currentSleepEnd: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(),
    prevSleepStart: new Date(now.getTime() - 56 * 60 * 60 * 1000).toISOString(),
    prevSleepEnd: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
    sleepLast12h: 7,
    sleepLast36h: 15,
    awakeLast12h: 5,
    consumesObat: false,
    hasPersonalProblem: false,
    scoreA: 0,
    scoreB: 1,
    scoreC: 0,
    totalFatigueScore: 1,
    fatigueCategory: 'NORMAL',
    obatAction: 'NORMAL',
    problemAction: 'NORMAL',
    finalDecision: 'FIT'
  };

  const sample2: FitToWorkAssessment = {
    id: "FTW-10492-02",
    timestamp: new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString(),
    nama: "Rina Wijaya",
    nik: "A5021",
    shiftStart: new Date(now.getTime() - 15 * 60 * 60 * 1000).toISOString(),
    currentSleepStart: new Date(now.getTime() - 21 * 60 * 60 * 1000).toISOString(),
    currentSleepEnd: new Date(now.getTime() - 16 * 60 * 60 * 1000).toISOString(), // 5h sleep
    prevSleepStart: new Date(now.getTime() - 45 * 60 * 60 * 1000).toISOString(),
    prevSleepEnd: new Date(now.getTime() - 39 * 60 * 60 * 1000).toISOString(), // 6h sleep
    sleepLast12h: 5,
    sleepLast36h: 11,
    awakeLast12h: 7,
    consumesObat: true,
    hasPersonalProblem: false,
    scoreA: 6,
    scoreB: 4,
    scoreC: 2,
    totalFatigueScore: 12,
    fatigueCategory: 'REJECT',
    obatAction: 'OBSERVE',
    problemAction: 'NORMAL',
    finalDecision: 'UNFIT'
  };

  const sample3: FitToWorkAssessment = {
    id: "FTW-10492-03",
    timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
    nama: "Budi Pratama",
    nik: "A8274",
    shiftStart: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    currentSleepStart: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(),
    currentSleepEnd: new Date(now.getTime() - 4.5 * 60 * 60 * 1000).toISOString(),  // 5.5h
    prevSleepStart: new Date(now.getTime() - 34 * 60 * 60 * 1000).toISOString(),
    prevSleepEnd: new Date(now.getTime() - 28 * 60 * 60 * 1000).toISOString(),  // 6h
    sleepLast12h: 5.5,
    sleepLast36h: 11.5,
    awakeLast12h: 6.5,
    consumesObat: false,
    hasPersonalProblem: true,
    scoreA: 3,
    scoreB: 3,
    scoreC: 1,
    totalFatigueScore: 7,
    fatigueCategory: 'LAPOR',
    obatAction: 'NORMAL',
    problemAction: 'CNC',
    finalDecision: 'FIT_CONDITIONAL'
  };

  const sample4: FitToWorkAssessment = {
    id: "FTW-10492-04",
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    nama: "Siti Rahma",
    nik: "A0912",
    shiftStart: new Date().toISOString(),
    currentSleepStart: new Date(now.getTime() - 9*60*60*1000).toISOString(),
    currentSleepEnd: new Date(now.getTime() - 4*60*60*1000).toISOString(), // 5h
    prevSleepStart: new Date(now.getTime() - 33*60*60*1000).toISOString(),
    prevSleepEnd: new Date(now.getTime() - 27*60*60*1000).toISOString(), // 6h
    sleepLast12h: 5,
    sleepLast36h: 11,
    awakeLast12h: 7,
    consumesObat: false,
    hasPersonalProblem: false,
    scoreA: 6,
    scoreB: 4,
    scoreC: 2,
    totalFatigueScore: 12,
    fatigueCategory: 'REJECT',
    obatAction: 'NORMAL',
    problemAction: 'NORMAL',
    finalDecision: 'UNFIT'
  };

  const sample5: FitToWorkAssessment = {
    id: "FTW-10492-05",
    timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    nama: "Dani Setiawan",
    nik: "A3821",
    shiftStart: new Date().toISOString(),
    currentSleepStart: new Date(now.getTime() - 12*60*60*1000).toISOString(),
    currentSleepEnd: new Date(now.getTime() - 6*60*60*1000).toISOString(), // 6h sleep
    prevSleepStart: new Date(now.getTime() - 36*60*60*1000).toISOString(),
    prevSleepEnd: new Date(now.getTime() - 30*60*60*1000).toISOString(), // 6h sleep
    sleepLast12h: 6,
    sleepLast36h: 12,
    awakeLast12h: 6,
    consumesObat: false,
    hasPersonalProblem: false,
    scoreA: 3,
    scoreB: 3,
    scoreC: 0,
    totalFatigueScore: 6,
    fatigueCategory: 'NORMAL',
    obatAction: 'NORMAL',
    problemAction: 'NORMAL',
    finalDecision: 'FIT'
  };

  return [sample1, sample2, sample3, sample4, sample5];
}
