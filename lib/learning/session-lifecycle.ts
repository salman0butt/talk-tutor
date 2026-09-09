export interface PendingTranscriptTurn {
  role: "user" | "assistant";
  text: string;
  occurredAt: string;
}
export interface SequencedTranscriptTurn extends PendingTranscriptTurn { sequence: number }

export function hasFinalUserTurn(turns: PendingTranscriptTurn[]): boolean {
  return turns.some((turn) => turn.role === "user" && turn.text.trim().length > 0);
}
export function normalizePendingTurns(turns: PendingTranscriptTurn[]): SequencedTranscriptTurn[] {
  const normalized: SequencedTranscriptTurn[] = [];
  for (const turn of turns) {
    const text = turn.text.trim();
    if (!text) continue;
    const occurredAt = new Date(turn.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) continue;
    normalized.push({ role: turn.role, text, occurredAt: occurredAt.toISOString(), sequence: normalized.length });
  }
  return normalized;
}
export function calculateDurationSeconds(startedAt: string, endedAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}
export function isMeaningfulCompletedSession(input: { status: string; durationSeconds: number; userMessageCount: number }): boolean {
  return input.status === "completed" && Number.isFinite(input.durationSeconds)
    && input.durationSeconds >= 60 && Number.isInteger(input.userMessageCount) && input.userMessageCount > 0;
}
