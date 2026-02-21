export type CommandId = 'phish' | 'scan' | 'spoof';

export type CommandSpec = {
  id: CommandId;
  label: string;
  successRate: number;
  payoutMin: number;
  payoutMax: number;
  cooldownMs: number;
  failTrace: number;
  xpGain: number;
  description: string;
};

export type PlayerState = {
  nops: number;
  trace: number;
  xp: number;
  level: number;
  totalRuns: number;
  totalSuccess: number;
};

export type Cooldowns = Record<CommandId, number>;

export type TerminalLog = {
  id: string;
  ts: number;
  text: string;
  tone: 'info' | 'success' | 'warn' | 'error';
};

export type CommandResult = {
  logs: TerminalLog[];
  state: PlayerState;
  cooldowns: Cooldowns;
};

export const commandSpecs: Record<CommandId, CommandSpec> = {
  phish: {
    id: 'phish',
    label: 'Phish',
    successRate: 0.76,
    payoutMin: 1,
    payoutMax: 5,
    cooldownMs: 7_000,
    failTrace: 8,
    xpGain: 10,
    description: 'Low-risk social vector attack that generates starter credits.'
  },
  scan: {
    id: 'scan',
    label: 'Scan',
    successRate: 0.68,
    payoutMin: 4,
    payoutMax: 9,
    cooldownMs: 12_000,
    failTrace: 12,
    xpGain: 18,
    description: 'Network recon. Better payout but higher detection footprint.'
  },
  spoof: {
    id: 'spoof',
    label: 'Spoof',
    successRate: 0.59,
    payoutMin: 8,
    payoutMax: 15,
    cooldownMs: 18_000,
    failTrace: 18,
    xpGain: 25,
    description: 'Identity masking exploit. High reward, high risk.'
  }
};

export const defaultPlayerState: PlayerState = {
  nops: 0,
  trace: 0,
  xp: 0,
  level: 1,
  totalRuns: 0,
  totalSuccess: 0
};

export const defaultCooldowns: Cooldowns = {
  phish: 0,
  scan: 0,
  spoof: 0
};

function nextLevelXp(level: number) {
  return 80 + level * 35;
}

function createLog(text: string, tone: TerminalLog['tone']): TerminalLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    text,
    tone
  };
}

export function getCooldownLeft(targetTime: number, now = Date.now()): number {
  return Math.max(0, targetTime - now);
}

export function getSuccessRate(player: PlayerState): number {
  if (player.totalRuns === 0) return 0;
  return player.totalSuccess / player.totalRuns;
}

export function executeCommand(command: CommandId, state: PlayerState, cooldowns: Cooldowns, now = Date.now()): CommandResult {
  const spec = commandSpecs[command];
  const cooldownLeft = getCooldownLeft(cooldowns[command], now);

  if (state.trace >= 100) {
    return {
      logs: [createLog('TRACE LOCKDOWN ACTIVE // Run `cooldown` or wait for passive decay.', 'error')],
      state,
      cooldowns
    };
  }

  if (cooldownLeft > 0) {
    return {
      logs: [createLog(`${spec.id} cooling down: ${(cooldownLeft / 1000).toFixed(1)}s remaining`, 'warn')],
      state,
      cooldowns
    };
  }

  const roll = Math.random();
  const success = roll <= spec.successRate;
  const nextState: PlayerState = {
    ...state,
    totalRuns: state.totalRuns + 1
  };

  const nextCooldowns: Cooldowns = {
    ...cooldowns,
    [command]: now + spec.cooldownMs
  };

  const logs: TerminalLog[] = [createLog(`> ${spec.id} --exec`, 'info')];

  if (success) {
    const payout = Math.floor(Math.random() * (spec.payoutMax - spec.payoutMin + 1)) + spec.payoutMin;
    nextState.nops += payout;
    nextState.xp += spec.xpGain;
    nextState.totalSuccess += 1;
    logs.push(createLog(`ACCESS GRANTED // +${payout} Ø NOP`, 'success'));
    logs.push(createLog(`XP +${spec.xpGain}`, 'success'));
  } else {
    nextState.trace = Math.min(100, nextState.trace + spec.failTrace);
    logs.push(createLog(`DETECTION SPIKE // TRACE +${spec.failTrace}%`, 'error'));
  }

  while (nextState.xp >= nextLevelXp(nextState.level)) {
    nextState.xp -= nextLevelXp(nextState.level);
    nextState.level += 1;
    logs.push(createLog(`LEVEL UP // Operator level ${nextState.level}`, 'success'));
  }

  return { logs, state: nextState, cooldowns: nextCooldowns };
}

export function passiveTraceDecay(state: PlayerState): PlayerState {
  if (state.trace <= 0) return state;
  return {
    ...state,
    trace: Math.max(0, state.trace - 1)
  };
}
