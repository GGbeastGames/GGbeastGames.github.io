export type MissionCadence = 'daily' | 'weekly';

export type MissionTemplate = {
  id: string;
  cadence: MissionCadence;
  title: string;
  description: string;
  target: number;
  metric: 'runs' | 'success' | 'earnings';
  rewardXp: number;
  rewardNops: number;
};

export type MissionProgress = {
  missionId: string;
  progress: number;
  completed: boolean;
  claimedAt: number | null;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlockedAt: number;
};

export type RetentionState = {
  xpTotal: number;
  streakDays: number;
  lastDailyClaimDay: string | null;
  lastActiveDay: string | null;
  dailyResetAt: number;
  missions: MissionProgress[];
  achievements: Achievement[];
  badges: string[];
  profilePhotoUrl: string | null;
  profilePhotoPath: string | null;
  commandMastery: Record<string, number>;
};

export const missionTemplates: MissionTemplate[] = [
  {
    id: 'daily-runs-5',
    cadence: 'daily',
    title: 'Signal Warmup',
    description: 'Run 5 commands today.',
    target: 5,
    metric: 'runs',
    rewardXp: 50,
    rewardNops: 12
  },
  {
    id: 'daily-earn-30',
    cadence: 'daily',
    title: 'Cashflow Ping',
    description: 'Earn 30 Ø from command payouts today.',
    target: 30,
    metric: 'earnings',
    rewardXp: 55,
    rewardNops: 14
  },
  {
    id: 'weekly-success-20',
    cadence: 'weekly',
    title: 'Silent Week',
    description: 'Complete 20 successful command runs this week.',
    target: 20,
    metric: 'success',
    rewardXp: 180,
    rewardNops: 50
  }
];

function missionDefaults(): MissionProgress[] {
  return missionTemplates.map((mission) => ({
    missionId: mission.id,
    progress: 0,
    completed: false,
    claimedAt: null
  }));
}

function getToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcMidnight(now = Date.now()): number {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.getTime();
}

export const defaultRetentionState: RetentionState = {
  xpTotal: 0,
  streakDays: 0,
  lastDailyClaimDay: null,
  lastActiveDay: null,
  dailyResetAt: nextUtcMidnight(),
  missions: missionDefaults(),
  achievements: [],
  badges: [],
  profilePhotoUrl: null,
  profilePhotoPath: null,
  commandMastery: {}
};

export function applyDailyReset(state: RetentionState, now = Date.now()): RetentionState {
  if (now < state.dailyResetAt) return state;
  return {
    ...state,
    dailyResetAt: nextUtcMidnight(now),
    missions: state.missions.map((mission) => {
      const template = missionTemplates.find((item) => item.id === mission.missionId);
      if (!template || template.cadence !== 'daily') return mission;
      return { ...mission, progress: 0, completed: false, claimedAt: null };
    })
  };
}

export function applyActivity(state: RetentionState, input: { commandKey: string; success: boolean; payout: number }, now = Date.now()): RetentionState {
  const resetState = applyDailyReset(state, now);
  const day = getToday(new Date(now));
  const yesterday = getToday(new Date(now - 86_400_000));

  const streakDays =
    !resetState.lastActiveDay ? 1 : resetState.lastActiveDay === day ? resetState.streakDays : resetState.lastActiveDay === yesterday ? resetState.streakDays + 1 : 1;

  const masteryCount = (resetState.commandMastery[input.commandKey] ?? 0) + 1;

  const nextMissions = resetState.missions.map((mission) => {
    const template = missionTemplates.find((item) => item.id === mission.missionId);
    if (!template || mission.completed) return mission;

    let delta = 0;
    if (template.metric === 'runs') delta = 1;
    if (template.metric === 'success' && input.success) delta = 1;
    if (template.metric === 'earnings') delta = input.payout;

    const progress = Math.min(template.target, mission.progress + delta);
    return {
      ...mission,
      progress,
      completed: progress >= template.target
    };
  });

  const achievements = [...resetState.achievements];
  const badges = [...resetState.badges];

  function unlockAchievement(id: string, title: string, description: string) {
    if (achievements.some((entry) => entry.id === id)) return;
    achievements.push({ id, title, description, unlockedAt: now });
  }

  if (streakDays >= 3) unlockAchievement('streak-3', 'Neural Routine', 'Hit a 3-day login streak.');
  if (masteryCount >= 25) {
    unlockAchievement(`mastery-${input.commandKey}`, 'Command Specialist', `Used ${input.commandKey} at least 25 times.`);
    if (!badges.includes(`Mastery:${input.commandKey}`)) badges.push(`Mastery:${input.commandKey}`);
  }

  return {
    ...resetState,
    lastActiveDay: day,
    streakDays,
    missions: nextMissions,
    achievements,
    badges,
    commandMastery: {
      ...resetState.commandMastery,
      [input.commandKey]: masteryCount
    }
  };
}

export function claimMissionReward(state: RetentionState, missionId: string, now = Date.now()): { next: RetentionState; xp: number; nops: number } {
  const mission = state.missions.find((entry) => entry.missionId === missionId);
  const template = missionTemplates.find((entry) => entry.id === missionId);
  if (!mission || !template || !mission.completed || mission.claimedAt) {
    return { next: state, xp: 0, nops: 0 };
  }

  return {
    next: {
      ...state,
      xpTotal: state.xpTotal + template.rewardXp,
      missions: state.missions.map((entry) => (entry.missionId === missionId ? { ...entry, claimedAt: now } : entry))
    },
    xp: template.rewardXp,
    nops: template.rewardNops
  };
}

export function claimDailyStreak(state: RetentionState, now = Date.now()): { next: RetentionState; nops: number } {
  const day = getToday(new Date(now));
  if (state.lastDailyClaimDay === day) {
    return { next: state, nops: 0 };
  }

  const reward = Math.min(40, 8 + state.streakDays * 2);
  return {
    next: {
      ...state,
      lastDailyClaimDay: day
    },
    nops: reward
  };
}
