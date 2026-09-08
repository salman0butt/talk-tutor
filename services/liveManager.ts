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
import { ConnectConfig, ConnectionState, LiveManagerCallbacks } from "@/types";
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
    private outputLevelFrame: number | null = null;
    private callbacks: LiveManagerCallbacks;
    private isMuted: boolean = false;
    private inputTranscription: string = "";
    private outputTranscription: string = "";

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

    async startSession(connectConfig: ConnectConfig) {
        try {
            console.log("starting the session");

            this.callbacks.onStateChange(ConnectionState.CONNECTING);
            const config: LiveConnectConfig = {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: connectConfig.selected_assistant_voice,
                        },
                    },
                },
                systemInstruction:
                    this.generateSystemPrompt(connectConfig),
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
                if (!this.activeSession) return;

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



  generateSystemPrompt(config: ConnectConfig) {
    return `
    ROLE: You are an expert language tutor, Your name is "TalkWalk".

    GOAL: Help the user improve their proficiency in ${config.selected_launguage_name} (${config.selected_launguage_region}).
    TOPIC: ${config.selected_topic}.
    USER LEVEL: ${config.selected_proefficent_level}.

    INSTRUCTIONS:
    1.  **Strictly** speak in ${config.selected_launguage_name}. Only use English if the user is completely stuck or asks for a translation.
    2.  **Correction Mode**:
        - If the user makes a grammar or pronunciation mistake, gently correct it *first*, then continue the conversation.
        - Format: "Small tip: In ${config.selected_launguage_name} we say [Correction]. Anyway, [Response]?"
    3.  **Conversation Flow**:
        - Keep responses concise (1-3 sentences).
        - Ask open-ended questions to keep the user talking.
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

        if(serverContent?.inputTranscription?.text) {
            this.inputTranscription += serverContent.inputTranscription.text;
            this.callbacks.onTranscript("user", serverContent.inputTranscription.text, true);
        }

        if(serverContent?.outputTranscription?.text) {
            this.outputTranscription += serverContent.outputTranscription.text;
            this.callbacks.onTranscript("model", serverContent.outputTranscription.text, true);
        }

        if(serverContent?.turnComplete) {
            if(this.inputTranscription) {
                this.callbacks.onTranscript("user", this.inputTranscription, false);
                this.inputTranscription = "";
            }

            if(this.outputTranscription) {
                this.callbacks.onTranscript("model", this.outputTranscription, false);
                this.outputTranscription = "";
            }
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
            if (this.activeSession && !this.sources.size) {
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

    async disconnect() {
        this.activeSession?.close();
        this.activeSession = null;

        if (this.outputLevelFrame !== null) {
            cancelAnimationFrame(this.outputLevelFrame);
            this.outputLevelFrame = null;
        }

        await this.stopAllAudio();

        this.inputSource?.disconnect();
        this.workletNode?.disconnect();
        this.mediaStream?.getTracks().forEach((track) => track.stop());
        this.outputNode?.disconnect();
        this.outputAnalyser?.disconnect();

        await Promise.all([
            this.inputAudioContext?.close(),
            this.outputAudioContext?.close(),
        ]);

        this.inputSource = null;
        this.workletNode = null;
        this.mediaStream = null;
        this.inputAudioContext = null;
        this.outputAudioContext = null;
        this.outputNode = null;
        this.outputAnalyser = null;
        this.nextStartTime = 0;
        this.isMuted = false;

        this.callbacks.onAudioLevel(0, "input");
        this.callbacks.onAgentState(null);
        this.callbacks.onStateChange(ConnectionState.DISCONNECTED);
    }

    private monitorOutputLevel() {
        if (!this.outputAnalyser) return;

        const samples = new Float32Array(this.outputAnalyser.fftSize);
        const update = () => {
            if (!this.outputAnalyser) return;

            this.outputAnalyser.getFloatTimeDomainData(samples);
            this.callbacks.onAudioLevel(getAudioLevel(samples), "output");
            this.outputLevelFrame = requestAnimationFrame(update);
        };

        update();
    }

}
