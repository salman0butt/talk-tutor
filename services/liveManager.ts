import {
    INPUT_SAMPLE_RATE,
    MODEL,
    OUTPUT_SAMPLE_RATE,
} from "@/lib/constants";

import {
    GoogleGenAI,
    InteractionStatus,
    LiveConnectConfig,
    LiveServerMessage,
    Modality,
    Session,
    VoiceActivityType,
} from "@google/genai";
import { base64ToUint8Array, createPCMBlob, decodeAudioData, getAudioLevel, } from "../lib/audioUtils";
import { ConnectionState, LiveManagerCallbacks } from "@/types";
export class LiveManager {
    private ai: GoogleGenAI;
    private activeSession: Session | null = null;
    private inputAudioContext: AudioContext | null = null;
    private outputAudioContext: AudioContext | null = null;
    private outputNode: GainNode | null = null;
    private outputAnalyser: AnalyserNode | null = null;
    private mediaStream: MediaStream | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private inputSource: MediaStreamAudioSourceNode | null = null;
    private nextStartTime = 0;
    private sources = new Set<AudioBufferSourceNode>()
    private callbacks: LiveManagerCallbacks;
    private isMuted: boolean = false;

    constructor(
        callbacks: LiveManagerCallbacks,
        token: string,
    ) {
        this.ai = new GoogleGenAI({
            apiKey: token,
            apiVersion: "v1alpha",
        });
        this.callbacks = callbacks;

    }

    async startSession() {
        try {
            console.log("starting the session");

            this.callbacks.onStateChange(ConnectionState.CONNECTING);
            const config: LiveConnectConfig = {
                responseModalities: [Modality.AUDIO],
                systemInstruction:
                    this.generateSystemPrompt(),
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            };

            this.activeSession = await this.ai.live.connect({
                model: MODEL,
                config: config,
                callbacks: {
                    onopen: () => {
                        this.callbacks.onStateChange(ConnectionState.CONNECTED)
                    },
                    onmessage: this.handleMessage.bind(this),
                    onerror: () => {
                        this.callbacks.onStateChange(ConnectionState.ERROR);
                        this.callbacks.onError("Could not connect.")
                    },
                    // todo: handle this -> destroy strems, ...
                    onclose: (e) => console.log("Closed:", e.reason),
                },
            });

            this.inputAudioContext = new AudioContext({
                sampleRate: INPUT_SAMPLE_RATE
            });
            this.outputAudioContext = new AudioContext({
                sampleRate: OUTPUT_SAMPLE_RATE
            });

            if (this.inputAudioContext.state === 'suspended') {
                this.inputAudioContext.resume();
            }


            if (this.outputAudioContext.state === 'suspended') {
                this.outputAudioContext.resume();
            }

            this.outputNode = this.outputAudioContext.createGain();
            this.outputAnalyser = this.outputAudioContext.createAnalyser();
            this.outputAnalyser.fftSize = 256;
            this.outputAnalyser.smoothingTimeConstant = 0.8;
            this.outputNode.connect(this.outputAnalyser);
            this.outputAnalyser.connect(this.outputAudioContext.destination);
            this.monitorOutputLevel();

            await this.inputAudioContext.audioWorklet.addModule(
                "/worklet/mic-processor.js"
            )

            this.workletNode = new AudioWorkletNode(
                this.inputAudioContext,
                "mic-processor",
            );

            this.workletNode.port.onmessage = (event) => {
                const samples = event.data as Float32Array;
                const level = this.isMuted ? 0 : getAudioLevel(samples);
                this.callbacks.onAudioLevel(level, "input");

                if (this.isMuted || !this.activeSession) return;

                this.activeSession.sendRealtimeInput({
                    audio: createPCMBlob(samples),
                });

                if (level > 0.05) {
                    this.callbacks.onAgentState("listening");
                }
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: INPUT_SAMPLE_RATE,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.inputSource = this.inputAudioContext.createMediaStreamSource(
                this.mediaStream,
            );

            this.inputSource.connect(this.workletNode)

            console.log("Connected to Gemini Live");
        } catch (e) {
            console.error(e);
            this.callbacks.onStateChange(ConnectionState.ERROR);
            this.callbacks.onError("Something went wrong.")
        }
    }


    generateSystemPrompt() {
        return `
    ROLE: You are an expert language tutor, Your name is "TalkGyan".
    `;
    }

    handleMessage(message: LiveServerMessage) {
        const serverContent = message.serverContent;
        const voiceActivity = message.voiceActivity?.voiceActivityType;

        if (!serverContent) {
            if (voiceActivity === VoiceActivityType.ACTIVITY_START) {
                this.callbacks.onAgentState("listening");
            } else if (voiceActivity === VoiceActivityType.ACTIVITY_END) {
                this.callbacks.onAgentState("thinking");
            }
            return;
        }

        if (serverContent?.interrupted) {
            this.stopAllAudio();
            this.callbacks.onAgentState("listening");
        }

        const base64Data = serverContent?.modelTurn?.parts?.[0].inlineData?.data;

        if (base64Data) {
            this.callbacks.onAgentState("talking");
            void this.playAudioChunk(base64Data);
            return;
        }

        if (voiceActivity === VoiceActivityType.ACTIVITY_START) {
            this.callbacks.onAgentState("listening");
        } else if (voiceActivity === VoiceActivityType.ACTIVITY_END) {
            this.callbacks.onAgentState("thinking");
        } else if (serverContent.turnComplete || serverContent.waitingForInput) {
            this.callbacks.onAgentState("listening");
        } else if (serverContent.interactionStatus === InteractionStatus.IN_PROGRESS) {
            this.callbacks.onAgentState("thinking");
        }

    }

    async playAudioChunk(audioData: string) {
        const uintData = base64ToUint8Array(audioData);

        if (!this.outputAudioContext || !this.outputNode) return;

        const audioBuffer = await decodeAudioData(uintData, this.outputAudioContext, OUTPUT_SAMPLE_RATE, 1);

        if (this.nextStartTime < this.outputAudioContext.currentTime) {
            this.nextStartTime = this.outputAudioContext.currentTime;
        }

        const source = this.outputAudioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.outputNode)

        source.start(this.nextStartTime);
        this.nextStartTime += audioBuffer.duration;

        source.addEventListener('ended', () => {
            this.sources.delete(source);
            if (!this.sources.size) {
                this.callbacks.onAgentState("listening");
            }
        })

        this.sources.add(source);

    }
    async stopAllAudio() {
        this.sources.forEach((source) => {
            try {
                source.stop();
            } catch { }
        });

        this.sources.clear();
        this.callbacks.onAudioLevel(0, "output");

        if (this.outputAudioContext) {
            this.nextStartTime = this.outputAudioContext?.currentTime;
        }
    }

    setMute(isMuted: boolean) {
        this.isMuted = isMuted;

        if(this.mediaStream) {
            this.mediaStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }

        if(isMuted) {
            this.callbacks.onAudioLevel(0, "input");
        }
    }

    private monitorOutputLevel() {
        if (!this.outputAnalyser) return;

        const samples = new Float32Array(this.outputAnalyser.fftSize);
        const update = () => {
            if (!this.outputAnalyser) return;

            this.outputAnalyser.getFloatTimeDomainData(samples);
            this.callbacks.onAudioLevel(getAudioLevel(samples), "output");
            requestAnimationFrame(update);
        };

        update();
    }

}
