import {
  hasFinalUserTurn,
  normalizePendingTurns,
  type PendingTranscriptTurn,
} from "./session-lifecycle.ts";
import type { FinalTranscriptMessage, TranscriptRole } from "./types.ts";
import type { PracticeConfiguration } from "./practice.ts";

export interface SessionRecorderConfig extends PracticeConfiguration {
  language: string;
  proficiencyLevel: string;
  assistantVoice: string;
}

export interface SessionRecorderApi {
  createSession(
    config: SessionRecorderConfig,
    messages: FinalTranscriptMessage[],
  ): Promise<string>;
  appendMessage(sessionId: string, message: FinalTranscriptMessage): Promise<void>;
  finalizeSession(sessionId: string): Promise<unknown>;
}

export class LearningSessionRecorder {
  private config: SessionRecorderConfig | null = null;
  private sessionId: string | null = null;
  private pending: PendingTranscriptTurn[] = [];
  private nextSequence = 0;
  private finalized = false;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly api: SessionRecorderApi;

  constructor(api: SessionRecorderApi) {
    this.api = api;
  }

  begin(config: SessionRecorderConfig) {
    this.config = config;
    this.sessionId = null;
    this.pending = [];
    this.nextSequence = 0;
    this.finalized = false;
    this.queue = Promise.resolve();
  }

  recordFinalTurn(
    role: TranscriptRole,
    text: string,
    occurredAt = new Date().toISOString(),
  ) {
    const trimmed = text.trim();
    if (!trimmed || this.finalized || !this.config) return Promise.resolve();

    this.pending.push({ role, text: trimmed, occurredAt });
    return this.enqueue(async () => {
      if (!this.sessionId) {
        if (!hasFinalUserTurn(this.pending)) return;
        const batch = normalizePendingTurns(this.pending);
        const id = await this.api.createSession(this.config!, batch);
        this.sessionId = id;
        this.pending = [];
        this.nextSequence = batch.length;
        return;
      }

      while (this.pending.length > 0) {
        const turn = this.pending[0];
        const normalized = normalizePendingTurns([turn])[0];
        if (!normalized) {
          this.pending.shift();
          continue;
        }
        await this.api.appendMessage(this.sessionId, {
          ...normalized,
          sequence: this.nextSequence,
        });
        this.pending.shift();
        this.nextSequence += 1;
      }
    });
  }

  finalize() {
    return this.enqueue(async () => {
      if (this.finalized) return;

      if (
        !this.sessionId &&
        this.config &&
        hasFinalUserTurn(this.pending)
      ) {
        const batch = normalizePendingTurns(this.pending);
        this.sessionId = await this.api.createSession(this.config, batch);
        this.pending = [];
        this.nextSequence = batch.length;
      }

      if (this.sessionId && this.pending.length > 0) {
        while (this.pending.length > 0) {
          const turn = this.pending[0];
          const normalized = normalizePendingTurns([turn])[0];
          if (!normalized) {
            this.pending.shift();
            continue;
          }
          await this.api.appendMessage(this.sessionId, {
            ...normalized,
            sequence: this.nextSequence,
          });
          this.pending.shift();
          this.nextSequence += 1;
        }
      }

      if (!this.sessionId) {
        this.finalized = true;
        return;
      }

      await this.api.finalizeSession(this.sessionId);
      this.finalized = true;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => undefined).then(operation);
    this.queue = next;
    return next;
  }
}
