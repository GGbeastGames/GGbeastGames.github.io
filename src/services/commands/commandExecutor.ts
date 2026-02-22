export type CommandExecutionResponse = {
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

export const requestCommandExecution = async (command: string): Promise<CommandExecutionResponse> => {
  const response = await fetch('/api/executeCommand', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command }),
    credentials: 'include',
  });

  const payload = (await response.json().catch(() => ({}))) as Partial<CommandExecutionResponse> & { error?: string };

  if (!response.ok || payload.ok !== true) {
    throw new Error(payload.error ?? 'Execution request rejected by backend.');
  }

  return payload as CommandExecutionResponse;
};
