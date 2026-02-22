const COMMAND_DEFINITIONS = {
  phish: {
    cooldownMs: 12_000,
    rewardMin: 1,
    rewardMax: 5,
    failurePenalty: 1,
    successRate: 0.72,
    description: 'Starter phishing probe command.',
  },
};

export function createTerminalEngine({ now = () => Date.now(), random = () => Math.random() } = {}) {
  const cooldowns = new Map();

  function normalizeCommand(input) {
    return String(input || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)[0];
  }

  function getDefinition(command) {
    return COMMAND_DEFINITIONS[command] || null;
  }

  function getCooldownRemainingMs(command) {
    const endsAt = cooldowns.get(command) || 0;
    return Math.max(0, endsAt - now());
  }

  function execute(rawInput) {
    const command = normalizeCommand(rawInput);
    if (!command) {
      return {
        ok: false,
        type: 'validation',
        message: 'Command is empty. Try `phish`.',
      };
    }

    const def = getDefinition(command);
    if (!def) {
      return {
        ok: false,
        type: 'unknown',
        message: `Unknown command: ${command}`,
      };
    }

    const remainingMs = getCooldownRemainingMs(command);
    if (remainingMs > 0) {
      return {
        ok: false,
        type: 'cooldown',
        command,
        remainingMs,
        message: `${command} is cooling down for ${Math.ceil(remainingMs / 1000)}s`,
      };
    }

    const success = random() <= def.successRate;
    cooldowns.set(command, now() + def.cooldownMs);

    if (!success) {
      return {
        ok: true,
        type: 'result',
        command,
        success: false,
        payout: -def.failurePenalty,
        cooldownMs: def.cooldownMs,
        message: `${command} failed. Trace penalty: -${def.failurePenalty} Ø`,
      };
    }

    const payout = def.rewardMin + Math.floor(random() * (def.rewardMax - def.rewardMin + 1));
    return {
      ok: true,
      type: 'result',
      command,
      success: true,
      payout,
      cooldownMs: def.cooldownMs,
      message: `${command} succeeded. Reward: +${payout} Ø`,
    };
  }

  function inspect() {
    return {
      commands: Object.keys(COMMAND_DEFINITIONS).map((id) => ({
        id,
        ...COMMAND_DEFINITIONS[id],
        cooldownRemainingMs: getCooldownRemainingMs(id),
      })),
    };
  }

  return {
    execute,
    inspect,
    getCooldownRemainingMs,
  };
}
