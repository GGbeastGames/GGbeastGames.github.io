import { FormEvent, useMemo, useState } from 'react';

export type CommandOutcome = {
  ok: boolean;
  commandId: string;
  success: boolean;
  walletDelta: number;
  walletAfter: number;
  xpDelta: number;
  xpAfter: number;
  levelAfter: number;
  cooldownUntilMs: number;
  message: string;
};

export type CommandMeta = {
  id: string;
  aliases: string[];
  usage: string;
  description: string;
  cooldownMs: number;
};

const CLIENT_RATE_LIMIT_MS = 1_000;
const MAX_HISTORY = 40;

type HistoryEntry = { id: string; tone: 'system' | 'success' | 'error'; text: string };

interface TerminalConsoleProps {
  commands: CommandMeta[];
  executeCommandRequest: (command: string) => Promise<CommandOutcome>;
}

const formatMs = (ms: number) => `${Math.max(1, Math.ceil(ms / 1000))}s`;

export const TerminalConsole = ({ commands, executeCommandRequest }: TerminalConsoleProps) => {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { id: crypto.randomUUID(), tone: 'system', text: 'Boot sequence stable. Type "help".' },
  ]);

  const commandMap = useMemo(() => {
    const entries = commands.flatMap((command) => [command.id, ...command.aliases].map((key) => [key, command] as const));
    return new Map(entries);
  }, [commands]);

  const push = (tone: HistoryEntry['tone'], text: string) => {
    setHistory((prev) => [...prev.slice(-MAX_HISTORY + 1), { id: crypto.randomUUID(), tone, text }]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = input.trim();
    if (!raw) {
      return;
    }

    const now = Date.now();
    if (now - lastSubmitAt < CLIENT_RATE_LIMIT_MS) {
      push('error', `Rate limited. Wait ${formatMs(CLIENT_RATE_LIMIT_MS - (now - lastSubmitAt))}.`);
      return;
    }

    setLastSubmitAt(now);
    setInput('');
    push('system', `> ${raw}`);

    if (raw === 'clear') {
      setHistory([{ id: crypto.randomUUID(), tone: 'system', text: 'History cleared.' }]);
      return;
    }

    if (raw === 'help') {
      for (const command of commands) {
        push('system', `${command.usage.padEnd(14)} | cooldown ${formatMs(command.cooldownMs)} | ${command.description}`);
      }

      push('system', 'Utility: help, clear');
      return;
    }

    const [head] = raw.toLowerCase().split(/\s+/);
    const normalized = head.endsWith('-ts') ? head.slice(0, -3) : head;
    if (!commandMap.get(normalized)) {
      push('error', `Unknown command "${head}". Use help.`);
      return;
    }

    setBusy(true);
    try {
      const result = await executeCommandRequest(head);
      const deltaPrefix = result.walletDelta >= 0 ? '+' : '';
      push(
        result.success ? 'success' : 'error',
        `${result.message} Credits ${deltaPrefix}${result.walletDelta}, XP +${result.xpDelta}, wallet=${result.walletAfter}, level=${result.levelAfter}.`,
      );
    } catch (error) {
      push('error', error instanceof Error ? error.message : 'Command execution failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="terminal-console">
      <div className="terminal-console__history">
        {history.map((entry) => (
          <p key={entry.id} className={`terminal-console__line is-${entry.tone}`}>
            {entry.text}
          </p>
        ))}
      </div>
      <form className="terminal-console__prompt" onSubmit={handleSubmit}>
        <span>$</span>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={busy ? 'Running command...' : 'Enter command'}
          disabled={busy}
          autoComplete="off"
        />
      </form>
    </div>
  );
};
