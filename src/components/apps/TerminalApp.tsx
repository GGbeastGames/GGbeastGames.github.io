import { FormEvent, useMemo, useState } from 'react';
import { Cooldowns, PlayerState, TerminalLog, baseCommandSpecs, executeCommand, getCooldownLeft } from '../../game/terminal';

type TerminalAppProps = {
  player: PlayerState;
  cooldowns: Cooldowns;
  logs: TerminalLog[];
  ownedCommandKeys: string[];
  onUpdate: (state: PlayerState, cooldowns: Cooldowns, appendedLogs: TerminalLog[]) => void;
  onClearLogs: () => void;
};

const shellHelp = ['help — list all commands', 'status — show wallet, trace, and level', 'clear — clear terminal output'];

export function TerminalApp({ player, cooldowns, logs, ownedCommandKeys, onUpdate, onClearLogs }: TerminalAppProps) {
  const [input, setInput] = useState('');

  const quickStats = useMemo(
    () => [
      { label: 'Balance', value: `${player.nops} Ø` },
      { label: 'Trace', value: `${player.trace}%` },
      { label: 'Level', value: `${player.level}` },
      { label: 'XP', value: `${player.xp}` }
    ],
    [player]
  );

  function appendInfo(text: string, tone: TerminalLog['tone'] = 'info') {
    onUpdate(player, cooldowns, [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        text,
        tone
      }
    ]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim().toLowerCase();
    if (!normalized) return;

    if (normalized === 'help') {
      appendInfo([...shellHelp, ...ownedCommandKeys.map((key) => `${key} — unlocked executable`)].join(' | '));
      setInput('');
      return;
    }

    if (normalized === 'status') {
      appendInfo(`status => Ø ${player.nops} | trace ${player.trace}% | lvl ${player.level} | xp ${player.xp}`);
      setInput('');
      return;
    }

    if (normalized === 'clear') {
      onClearLogs();
      setInput('');
      return;
    }

    if (ownedCommandKeys.includes(normalized)) {
      const result = executeCommand(normalized, player, cooldowns, ownedCommandKeys);
      onUpdate(result.state, result.cooldowns, result.logs);
      setInput('');
      return;
    }

    appendInfo(`Unknown or locked command: ${normalized}. Run 'help' for available commands.`, 'warn');
    setInput('');
  }

  return (
    <div className="terminal-app">
      <div className="terminal-hud">
        {quickStats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <div className="terminal-log" role="log" aria-live="polite">
        {logs.map((log) => (
          <p key={log.id} data-tone={log.tone}>
            {new Date(log.ts).toLocaleTimeString()} — {log.text}
          </p>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="terminal-input-row">
        <span>&gt;</span>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="type help, phish, scan, spoof, phish-ts" />
        <button type="submit">Run</button>
      </form>

      <div className="terminal-command-grid">
        {ownedCommandKeys.map((key) => {
          const [baseKey, traitSuffix] = key.split('-');
          const spec = baseCommandSpecs[baseKey as keyof typeof baseCommandSpecs];
          const cooldownLeftMs = getCooldownLeft(cooldowns[key]);
          if (!spec) return null;
          return (
            <article key={key}>
              <h4>{spec.label + (traitSuffix ? ` (${traitSuffix.toUpperCase()})` : '')}</h4>
              <p>{spec.description}</p>
              <p>
                Success {Math.round(spec.successRate * 100)}% · Reward {spec.payoutMin}-{spec.payoutMax} Ø
                {traitSuffix ? ' · Trait boosted' : ''}
              </p>
              <p>Cooldown: {(spec.cooldownMs / 1000).toFixed(0)}s</p>
              <p className={cooldownLeftMs > 0 ? 'warn' : 'ok'}>
                {cooldownLeftMs > 0 ? `Ready in ${(cooldownLeftMs / 1000).toFixed(1)}s` : 'Ready'}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
