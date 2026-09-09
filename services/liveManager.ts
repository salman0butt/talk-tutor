import {
  INPUT_SAMPLE_RATE,
  MODEL,
  OUTPUT_SAMPLE_RATE,
} from "@/lib/constants";
import { buildTutorSystemInstruction } from "@/lib/learning/practice";
import { base64ToUint8Array, createPCMBlob, decodeAudioData, getAudioLevel } from "@/lib/audioUtils";
import type { TranscriptEvent } from "@/lib/live/transcript";
import {
  GoogleGenAI,
  InteractionStatus,
  type LiveConnectConfig,
  type LiveServerMessage,
  Modality,
  type Session,
  VoiceActivityType,
} from "@google/genai";
import {
  type ConnectConfig,
  ConnectionState,
  type LiveConversationError,
  type LiveConversationErrorCode,
  type LiveManagerCallbacks,
} from "@/types";

export class LiveManager {
  private readonly ai: GoogleGenAI;
  private readonly callbacks: LiveManagerCallbacks;

  private activeSession: Session | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;

  private nextStartTime = 0;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private outputLevelFrame: number | null = null;
  private cleanupPromise: Promise<void> | null = null;
  private isMuted = false;
  private generation = 0;
  private playbackEpoch = 0;
  private playbackQueue: Promise<void> = Promise.resolve();

  constructor(callbacks: LiveManagerCallbacks, token: string) {
    this.ai = new GoogleGenAI({
      apiKey: token,
      apiVersion: "v1alpha",
    });
    this.callbacks = callbacks;
  }

  async startSession(connectConfig: ConnectConfig): Promise<void> {
    const generation = ++this.generation;
    await this.cleanupResources(true);

    if (!this.isCurrent(generation)) return;

    let phase: "microphone" | "audio-worklet" | "connection" = "microphone";

    try {
      this.callbacks.onStateChange(ConnectionState.REQUESTING_PERMISSION);

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Microphone capture is unavailable.", "NotFoundError");
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(connectConfig.input_device_id
            ? { deviceId: { exact: connectConfig.input_device_id } }
            : {}),
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      if (!this.isCurrent(generation)) {
        await this.cleanupResources(true);
        return;
      }

      this.callbacks.onStateChange(ConnectionState.CONNECTING);
      this.inputAudioContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      this.outputAudioContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });

      await Promise.all([
        this.resumeAudioContext(this.inputAudioContext),
        this.resumeAudioContext(this.outputAudioContext),
      ]);

      if (!this.isCurrent(generation)) {
        await this.cleanupResources(true);
        return;
      }

      this.outputNode = this.outputAudioContext.createGain();
      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.8;
      this.outputNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioContext.destination);
      this.monitorOutputLevel(generation);

      phase = "audio-worklet";
      await this.inputAudioContext.audioWorklet.addModule("/worklet/mic-processor.js");

      if (!this.isCurrent(generation)) {
        await this.cleanupResources(true);
        return;
      }

      this.workletNode = new AudioWorkletNode(
        this.inputAudioContext,
        "mic-processor",
      );
      this.configureWorklet(generation);

      this.inputSource = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );

      phase = "connection";
      const config: LiveConnectConfig = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: connectConfig.selected_assistant_voice,
            },
          },
        },
        systemInstruction: this.generateSystemPrompt(connectConfig),
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      };

      const session = await this.ai.live.connect({
        model: MODEL,
        config,
        callbacks: {
          onopen: () => undefined,
          onmessage: (message) => this.handleMessage(message, generation),
          onerror: (event) => this.handleProviderError(event, generation),
          onclose: (event) => this.handleProviderClose(event.reason, generation),
        },
      });

      if (!this.isCurrent(generation)) {
        try {
          session.close();
        } catch {
          // A cancelled connection may already be closed.
        }
        await this.cleanupResources(false);
        return;
      }

      this.activeSession = session;
      this.inputSource.connect(this.workletNode);
      this.callbacks.onStateChange(ConnectionState.CONNECTED);
      this.callbacks.onAgentState("listening");
    } catch (reason) {
      if (!this.isCurrent(generation)) return;

      const error = this.classifyStartError(reason, phase);
      await this.cleanupResources(true);
      if (!this.isCurrent(generation)) return;

      this.callbacks.onStateChange(ConnectionState.ERROR);
      this.reportError(error, reason);
    }
  }

  generateSystemPrompt(config: ConnectConfig) {
    return buildTutorSystemInstruction({
      languageName: config.selected_launguage_name,
      languageRegion: config.selected_launguage_region,
      proficiencyLevel: config.selected_proefficent_level,
      config: config.practice_config,
    });
  }

  handleMessage(message: LiveServerMessage, generation = this.generation) {
    if (!this.isCurrent(generation)) return;

    const serverContent = message.serverContent;
    const voiceActivity = message.voiceActivity?.voiceActivityType;

    if (voiceActivity === VoiceActivityType.ACTIVITY_START) {
      this.callbacks.onAgentState("listening");
    } else if (voiceActivity === VoiceActivityType.ACTIVITY_END) {
      this.callbacks.onAgentState("thinking");
    }

    if (!serverContent) return;

    const at = Date.now();

    if (serverContent.interrupted) {
      this.resetPlayback();
      this.emitTranscript({ type: "interrupted", at });
      this.callbacks.onAgentState("listening");
    }

    const interimInput = serverContent.interimInputTranscription?.text;
    if (interimInput !== undefined) {
      this.emitTranscript({
        type: "input-interim",
        text: interimInput,
        at,
      });
    }

    const finalInput = serverContent.inputTranscription?.text;
    if (finalInput !== undefined) {
      this.emitTranscript({
        type: "input-final",
        text: finalInput,
        at,
      });
    }

    const outputText = serverContent.outputTranscription?.text;
    if (outputText !== undefined) {
      this.emitTranscript({
        type: "output-fragment",
        text: outputText,
        at,
      });
    }

    for (const part of serverContent.modelTurn?.parts ?? []) {
      const inlineData = part.inlineData;
      if (
        inlineData?.data &&
        (!inlineData.mimeType || inlineData.mimeType.startsWith("audio/"))
      ) {
        this.callbacks.onAgentState("talking");
        this.enqueueAudioChunk(inlineData.data, generation);
      }
    }

    if (serverContent.turnComplete) {
      this.emitTranscript({ type: "turn-complete", at });
    }

    if (serverContent.turnComplete || serverContent.waitingForInput) {
      if (!this.sources.size) {
        this.callbacks.onAgentState("listening");
      }
    } else if (
      serverContent.interactionStatus === InteractionStatus.IN_PROGRESS &&
      !this.sources.size
    ) {
      this.callbacks.onAgentState("thinking");
    }
  }

  setMute(isMuted: boolean) {
    this.isMuted = isMuted;

    this.mediaStream?.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });

    if (isMuted) {
      this.callbacks.onAudioLevel(0, "input");
    }
  }

  async disconnect(): Promise<void> {
    ++this.generation;
    this.callbacks.onStateChange(ConnectionState.DISCONNECTING);
    await this.cleanupResources(true);
    this.callbacks.onAudioLevel(0, "input");
    this.callbacks.onAudioLevel(0, "output");
    this.callbacks.onAgentState(null);
    this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
  }

  private configureWorklet(generation: number) {
    if (!this.workletNode || !this.inputAudioContext) return;

    const sampleRate = this.inputAudioContext.sampleRate;

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (!this.isCurrent(generation) || !this.activeSession) return;

      const samples = event.data;
      const level = this.isMuted ? 0 : getAudioLevel(samples);
      this.callbacks.onAudioLevel(level, "input");

      if (this.isMuted) return;

      try {
        this.activeSession.sendRealtimeInput({
          audio: createPCMBlob(samples, sampleRate),
        });
      } catch (reason) {
        this.reportError(
          {
            code: "live_connection_failed",
            message: "Audio could not be sent to the live tutor.",
          },
          reason,
        );
      }

      if (level > 0.05) {
        this.callbacks.onAgentState("listening");
      }
    };
  }

  private emitTranscript(event: TranscriptEvent) {
    this.callbacks.onTranscriptEvent(event);
  }

  private enqueueAudioChunk(audioData: string, generation: number) {
    const epoch = this.playbackEpoch;

    this.playbackQueue = this.playbackQueue
      .then(() => this.playAudioChunk(audioData, generation, epoch))
      .catch((reason) => {
        if (!this.isCurrent(generation) || epoch !== this.playbackEpoch) return;
        this.reportError(
          {
            code: "audio_decode_failed",
            message: "A tutor audio chunk could not be played.",
          },
          reason,
        );
      });
  }

  private async playAudioChunk(
    audioData: string,
    generation: number,
    epoch: number,
  ) {
    const context = this.outputAudioContext;
    const outputNode = this.outputNode;

    if (!context || !outputNode || !this.isCurrent(generation)) return;

    const uintData = base64ToUint8Array(audioData);
    const audioBuffer = await decodeAudioData(
      uintData,
      context,
      OUTPUT_SAMPLE_RATE,
      1,
    );

    if (
      !this.isCurrent(generation) ||
      epoch !== this.playbackEpoch ||
      this.outputAudioContext !== context
    ) {
      return;
    }

    if (this.nextStartTime < context.currentTime) {
      this.nextStartTime = context.currentTime;
    }

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputNode);

    const startAt = this.nextStartTime;
    this.nextStartTime += audioBuffer.duration;
    this.sources.add(source);

    source.addEventListener(
      "ended",
      () => {
        this.sources.delete(source);
        try {
          source.disconnect();
        } catch {
          // The node may already be disconnected during cleanup.
        }
        if (
          this.isCurrent(generation) &&
          epoch === this.playbackEpoch &&
          this.activeSession &&
          !this.sources.size
        ) {
          this.callbacks.onAgentState("listening");
        }
      },
      { once: true },
    );

    source.start(startAt);
  }

  private resetPlayback() {
    ++this.playbackEpoch;
    this.playbackQueue = Promise.resolve();

    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already-ended sources are harmless.
      }
      try {
        source.disconnect();
      } catch {
        // Already-disconnected sources are harmless.
      }
    }

    this.sources.clear();
    this.callbacks.onAudioLevel(0, "output");
    this.nextStartTime = this.outputAudioContext?.currentTime ?? 0;
  }

  private handleProviderError(reason: unknown, generation: number) {
    if (!this.isCurrent(generation)) return;

    ++this.generation;
    void this.cleanupResources(true).finally(() => {
      this.callbacks.onStateChange(ConnectionState.ERROR);
      this.reportError(
        {
          code: "live_connection_failed",
          message: "The live tutor connection failed. Please try again.",
        },
        reason,
      );
      this.callbacks.onSessionClosed?.("connection error");
    });
  }

  private handleProviderClose(reason: string | undefined, generation: number) {
    if (!this.isCurrent(generation)) return;

    ++this.generation;
    void this.cleanupResources(false).finally(() => {
      this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
      this.reportError(
        {
          code: "session_closed",
          message: "The live tutor session ended. You can reconnect.",
        },
        reason,
      );
      this.callbacks.onSessionClosed?.(reason);
    });
  }

  private async cleanupResources(closeSession: boolean): Promise<void> {
    if (this.cleanupPromise) return this.cleanupPromise;

    this.cleanupPromise = (async () => {
      const session = this.activeSession;
      const inputSource = this.inputSource;
      const workletNode = this.workletNode;
      const mediaStream = this.mediaStream;
      const outputNode = this.outputNode;
      const outputAnalyser = this.outputAnalyser;
      const inputContext = this.inputAudioContext;
      const outputContext = this.outputAudioContext;

      this.activeSession = null;
      this.inputSource = null;
      this.workletNode = null;
      this.mediaStream = null;
      this.outputNode = null;
      this.outputAnalyser = null;
      this.inputAudioContext = null;
      this.outputAudioContext = null;

      if (this.outputLevelFrame !== null) {
        cancelAnimationFrame(this.outputLevelFrame);
        this.outputLevelFrame = null;
      }

      this.resetPlayback();

      if (workletNode) {
        workletNode.port.onmessage = null;
        try {
          workletNode.port.close();
        } catch {
          // Port may already be closed.
        }
      }

      this.tryCleanup(() => inputSource?.disconnect());
      this.tryCleanup(() => workletNode?.disconnect());
      mediaStream?.getTracks().forEach((track) =>
        this.tryCleanup(() => track.stop()),
      );
      this.tryCleanup(() => outputNode?.disconnect());
      this.tryCleanup(() => outputAnalyser?.disconnect());

      if (closeSession) {
        this.tryCleanup(() => session?.close());
      }

      await Promise.allSettled([
        inputContext?.close(),
        outputContext?.close(),
      ].filter((promise): promise is Promise<void> => Boolean(promise)));

      this.nextStartTime = 0;
      this.isMuted = false;
      this.callbacks.onAudioLevel(0, "input");
      this.callbacks.onAudioLevel(0, "output");
      this.callbacks.onAgentState(null);
    })().finally(() => {
      this.cleanupPromise = null;
    });

    return this.cleanupPromise;
  }

  private tryCleanup(operation: () => void) {
    try {
      operation();
    } catch (reason) {
      console.warn(
        "[LiveManager] cleanup operation failed:",
        reason instanceof Error ? reason.message : "unknown cleanup error",
      );
    }
  }

  private monitorOutputLevel(generation: number) {
    const analyser = this.outputAnalyser;
    if (!analyser) return;

    const samples = new Float32Array(analyser.fftSize);
    const update = () => {
      if (!this.isCurrent(generation) || this.outputAnalyser !== analyser) {
        return;
      }

      analyser.getFloatTimeDomainData(samples);
      this.callbacks.onAudioLevel(getAudioLevel(samples), "output");
      this.outputLevelFrame = requestAnimationFrame(update);
    };

    update();
  }

  private isCurrent(generation: number) {
    return generation === this.generation;
  }

  private async resumeAudioContext(context: AudioContext) {
    if (context.state === "suspended") {
      await context.resume();
    }
  }

  private classifyStartError(
    reason: unknown,
    phase: "microphone" | "audio-worklet" | "connection",
  ): LiveConversationError {
    if (phase === "microphone") {
      const name = reason instanceof DOMException ? reason.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        return {
          code: "microphone_permission_denied",
          message: "Microphone permission was denied. Allow access and try again.",
        };
      }

      return {
        code: "microphone_unavailable",
        message: "A usable microphone could not be opened.",
      };
    }

    if (phase === "audio-worklet") {
      return {
        code: "audio_worklet_failed",
        message: "Microphone audio processing could not start.",
      };
    }

    return {
      code: "live_connection_failed",
      message: "The live tutor could not connect. Please try again.",
    };
  }

  private reportError(error: LiveConversationError, reason?: unknown) {
    console.error(
      `[LiveManager] ${error.code}`,
      reason instanceof Error ? reason.message : "",
    );
    this.callbacks.onError(error);
  }
}
