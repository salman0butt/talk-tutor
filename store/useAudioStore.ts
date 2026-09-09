import {
  AVAILABLE_LANGUAGES,
  AVAILABLE_PROFICIENCY_LEVELS,
  AVAILABLE_VOICES,
  DEFAULT_CONFIGURATION,
} from "@/lib/constants";
import {
  parsePracticeConfiguration,
  PRACTICE_SCENARIOS,
  type ConversationDifficulty,
  type CorrectionFrequency,
  type PracticeMode,
} from "@/lib/learning/practice";
import { browserLearningSessionApi } from "@/lib/learning/session-api";
import { LearningSessionRecorder } from "@/lib/learning/session-recorder";
import type { GrammarCategory } from "@/lib/learning/types";
import {
  applyTranscriptEvent,
  createTranscriptState,
  type TranscriptState,
} from "@/lib/live/transcript";
import { LiveManager } from "@/services/liveManager";
import {
  type AgentState,
  type AudioVolume,
  ConnectionState,
  type LiveConversationError,
} from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

type TutorPreferencePatch = {
  preferredLanguage?: string;
  proficiencyLevel?: string;
  preferredVoice?: string;
  correctionFrequency?: CorrectionFrequency;
  conversationDifficulty?: ConversationDifficulty;
};

export type AudioStore = {
  connectionState: ConnectionState;
  error: string | null;
  preferenceError: string | null;
  preferencesSaving: boolean;
  sessionPersistenceError: string | null;
  isMuted: boolean;
  audioLevel: AudioVolume;
  agentState: AgentState;
  transcriptState: TranscriptState;
  selectedInputDeviceId: string;
  selectedLanguage: string;
  selectedTopic: string;
  selectedAssistantVoice: string;
  selectedProficiencyLevel: string;
  practiceMode: PracticeMode;
  correctionFrequency: CorrectionFrequency;
  difficulty: ConversationDifficulty;
  scenarioId: string;
  customScenario: string;
  learnerRole: string;
  tutorRole: string;
  targetMistakeCategories: GrammarCategory[];
  hydratePreferences: (preferences: {
    preferredLanguage: string;
    proficiencyLevel: string;
    preferredVoice: string;
    correctionFrequency: CorrectionFrequency;
    conversationDifficulty: ConversationDifficulty;
    practiceMode?: PracticeMode;
    scenarioId?: string;
    topic?: string;
    targetMistakeCategories?: GrammarCategory[];
  }) => void;
  setSelectedInputDeviceId: (deviceId: string) => void;
  setSelectedLanguage: (language: string) => void;
  setSelectedTopic: (topic: string) => void;
  setselectedAssistantVoice: (voice: string) => void;
  setSelectedProficiencyLevel: (level: string) => void;
  setPracticeMode: (mode: PracticeMode) => void;
  setCorrectionFrequency: (frequency: CorrectionFrequency) => void;
  setDifficulty: (difficulty: ConversationDifficulty) => void;
  applyScenario: (scenarioId: string) => void;
  setCustomScenario: (scenario: string) => void;
  setLearnerRole: (role: string) => void;
  setTutorRole: (role: string) => void;
  setTargetMistakeCategories: (categories: GrammarCategory[]) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMute: () => void;
};

export const useAudioStore = create<AudioStore>()(
  devtools(
    (set, get) => {
      let connectAttempt = 0;
      let transcriptSessionSequence = 0;
      let activeManager: LiveManager | null = null;
      let activeRecorder: LearningSessionRecorder | null = null;

      const persistPreference = async (patch: TutorPreferencePatch) => {
        set({ preferencesSaving: true, preferenceError: null });
        try {
          const response = await fetch("/api/learning/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(
              payload?.error ?? "Could not save tutor preference.",
            );
          }
        } catch (reason) {
          set({
            preferenceError:
              reason instanceof Error
                ? reason.message
                : "Could not save tutor preference.",
          });
        } finally {
          set({ preferencesSaving: false });
        }
      };

      const reportSessionPersistenceError = (reason: unknown) => {
        set({
          sessionPersistenceError:
            reason instanceof Error
              ? reason.message
              : "Practice history could not be saved.",
        });
      };

      const reportLiveError = (liveError: LiveConversationError) => {
        set({ error: liveError.message });
      };

      const applyTranscriptForRecorder = (
        event: Parameters<typeof applyTranscriptEvent>[1],
        recorder: LearningSessionRecorder,
      ) => {
        const transition = applyTranscriptEvent(
          get().transcriptState,
          event,
        );
        set({ transcriptState: transition.state });

        for (const message of transition.completed) {
          void recorder
            .recordFinalTurn(
              message.speaker === "assistant"
                ? "assistant"
                : "user",
              message.text,
              new Date(
                message.completedAt ?? event.at,
              ).toISOString(),
            )
            .catch(reportSessionPersistenceError);
        }
      };

      return {
        connectionState: ConnectionState.DISCONNECTED,
        error: null,
        preferenceError: null,
        preferencesSaving: false,
        sessionPersistenceError: null,
        isMuted: false,
        audioLevel: { input: 0, output: 0 },
        agentState: null,
        transcriptState: createTranscriptState("idle"),
        selectedInputDeviceId: "",
        ...DEFAULT_CONFIGURATION,
        practiceMode: "conversation",
        correctionFrequency: "balanced",
        difficulty: "normal",
        scenarioId: "",
        customScenario: "",
        learnerRole: "",
        tutorRole: "",
        targetMistakeCategories: [],

        hydratePreferences: (preferences) =>
          set((current) => {
            const scenario = preferences.scenarioId
              ? PRACTICE_SCENARIOS.find(
                  (candidate) => candidate.id === preferences.scenarioId,
                )
              : null;
            return {
              selectedLanguage: preferences.preferredLanguage,
              selectedProficiencyLevel: preferences.proficiencyLevel,
              selectedAssistantVoice: preferences.preferredVoice,
              correctionFrequency: preferences.correctionFrequency,
              difficulty: preferences.conversationDifficulty,
              practiceMode: preferences.practiceMode ?? current.practiceMode,
              scenarioId:
                scenario?.id ??
                preferences.scenarioId ??
                current.scenarioId,
              selectedTopic:
                scenario?.title ??
                preferences.topic ??
                current.selectedTopic,
              ...(scenario
                ? {
                    customScenario: scenario.situation,
                    learnerRole: scenario.learnerRole,
                    tutorRole: scenario.tutorRole,
                  }
                : {}),
              targetMistakeCategories:
                preferences.targetMistakeCategories ??
                current.targetMistakeCategories,
              preferenceError: null,
            };
          }),

        setSelectedInputDeviceId: (selectedInputDeviceId) =>
          set({ selectedInputDeviceId }),

        setSelectedLanguage: (language) => {
          set({ selectedLanguage: language });
          void persistPreference({ preferredLanguage: language });
        },

        setSelectedTopic: (topic) => set({ selectedTopic: topic }),

        setselectedAssistantVoice: (voice) => {
          set({ selectedAssistantVoice: voice });
          void persistPreference({ preferredVoice: voice });
        },

        setSelectedProficiencyLevel: (level) => {
          set({ selectedProficiencyLevel: level });
          void persistPreference({ proficiencyLevel: level });
        },

        setPracticeMode: (practiceMode) => set({ practiceMode }),

        setCorrectionFrequency: (correctionFrequency) =>
          set({ correctionFrequency }),

        setDifficulty: (difficulty) => set({ difficulty }),

        applyScenario: (scenarioId) => {
          const scenario = PRACTICE_SCENARIOS.find(
            (candidate) => candidate.id === scenarioId,
          );
          if (!scenario) {
            set({ scenarioId: "" });
            return;
          }
          set({
            practiceMode: "roleplay",
            scenarioId,
            selectedTopic: scenario.title,
            customScenario: scenario.situation,
            learnerRole: scenario.learnerRole,
            tutorRole: scenario.tutorRole,
          });
        },

        setCustomScenario: (customScenario) => set({ customScenario }),

        setLearnerRole: (learnerRole) => set({ learnerRole }),

        setTutorRole: (tutorRole) => set({ tutorRole }),

        setTargetMistakeCategories: (targetMistakeCategories) =>
          set({ targetMistakeCategories }),

        connect: async () => {
          const initialState = get();
          if (
            initialState.connectionState !== ConnectionState.DISCONNECTED &&
            initialState.connectionState !== ConnectionState.ERROR
          ) {
            return;
          }

          const attempt = ++connectAttempt;
          const transcriptState = createTranscriptState(
            `live-${++transcriptSessionSequence}`,
          );

          set({
            connectionState: ConnectionState.CONNECTING,
            error: null,
            sessionPersistenceError: null,
            transcriptState,
            isMuted: false,
            audioLevel: { input: 0, output: 0 },
            agentState: "thinking",
          });

          let response: Response;
          try {
            response = await fetch("/api/token");
          } catch {
            if (attempt !== connectAttempt) return;
            set({
              connectionState: ConnectionState.ERROR,
              agentState: null,
              error: "Could not request a live tutor token. Please try again.",
            });
            return;
          }

          if (attempt !== connectAttempt) return;

          if (!response.ok) {
            set({
              connectionState: ConnectionState.ERROR,
              agentState: null,
              error:
                response.status === 401
                  ? "Your session has expired. Sign in again to use the tutor."
                  : "Could not request a live tutor token. Please try again.",
            });
            return;
          }

          const data = await response.json().catch(() => null);
          const token = data?.token;
          if (!token?.name) {
            set({
              connectionState: ConnectionState.ERROR,
              agentState: null,
              error: "The live tutor token response was invalid.",
            });
            return;
          }

          const state = get();
          if (attempt !== connectAttempt) return;

          let practiceConfig;
          try {
            practiceConfig = parsePracticeConfiguration({
              practiceMode: state.practiceMode,
              topic: state.selectedTopic,
              scenarioId: state.scenarioId || undefined,
              customScenario: state.customScenario || undefined,
              learnerRole: state.learnerRole || undefined,
              tutorRole: state.tutorRole || undefined,
              correctionFrequency: state.correctionFrequency,
              difficulty: state.difficulty,
              targetMistakeCategories:
                state.practiceMode === "mistakes"
                  ? state.targetMistakeCategories
                  : [],
            });
          } catch (reason) {
            set({
              connectionState: ConnectionState.ERROR,
              agentState: null,
              error:
                reason instanceof Error
                  ? reason.message
                  : "Invalid practice configuration.",
            });
            return;
          }

          const language =
            AVAILABLE_LANGUAGES.find(
              ({ code }) => code === state.selectedLanguage,
            ) ?? AVAILABLE_LANGUAGES[0];
          const proficiency =
            AVAILABLE_PROFICIENCY_LEVELS.find(
              ({ id, label }) =>
                id === state.selectedProficiencyLevel ||
                label === state.selectedProficiencyLevel,
            ) ?? AVAILABLE_PROFICIENCY_LEVELS[0];
          const voice =
            AVAILABLE_VOICES.find(
              ({ id, name }) =>
                id === state.selectedAssistantVoice ||
                name === state.selectedAssistantVoice,
            )?.name ?? state.selectedAssistantVoice;

          const recorder = new LearningSessionRecorder(
            browserLearningSessionApi,
          );
          recorder.begin({
            language: language.code,
            proficiencyLevel: proficiency.label,
            assistantVoice: voice,
            ...practiceConfig,
          });

          const manager = new LiveManager(
            {
              onStateChange: (newState) => {
                if (activeManager !== manager) return;
                set({
                  connectionState: newState,
                  agentState:
                    newState === ConnectionState.CONNECTED
                      ? "listening"
                      : newState === ConnectionState.CONNECTING ||
                          newState === ConnectionState.REQUESTING_PERMISSION
                        ? "thinking"
                        : null,
                });
              },

              onTranscriptEvent: (event) => {
                if (activeManager !== manager) return;
                applyTranscriptForRecorder(event, recorder);
              },

              onAudioLevel: (level, type) => {
                if (activeManager !== manager) return;
                set((current) => ({
                  audioLevel: {
                    ...current.audioLevel,
                    [type]: level,
                  },
                }));
              },

              onAgentState: (agentState) => {
                if (activeManager !== manager) return;
                set({ agentState });
              },

              onError: (liveError) => {
                if (activeManager !== manager) return;
                reportLiveError(liveError);
              },

              onSessionClosed: () => {
                if (activeManager !== manager) return;

                applyTranscriptForRecorder(
                  { type: "session-end", at: Date.now() },
                  recorder,
                );
                void recorder.finalize().catch(reportSessionPersistenceError);

                activeManager = null;
                activeRecorder = null;
                set({
                  isMuted: false,
                  audioLevel: { input: 0, output: 0 },
                  agentState: null,
                });
              },
            },
            token.name,
          );

          activeManager = manager;
          activeRecorder = recorder;

          await manager.startSession({
            selected_topic: practiceConfig.topic,
            description: proficiency.description,
            selected_launguage_name: language.name || "English",
            selected_launguage_code: language.code || "en-US",
            selected_launguage_region:
              language.region || "United States",
            context: "",
            selected_proefficent_level: proficiency.label,
            selected_assistant_voice: voice,
            input_device_id: state.selectedInputDeviceId || undefined,
            practice_config: practiceConfig,
          });

          if (
            attempt === connectAttempt &&
            activeManager === manager &&
            get().connectionState === ConnectionState.ERROR
          ) {
            applyTranscriptForRecorder(
              { type: "session-end", at: Date.now() },
              recorder,
            );
            await recorder.finalize().catch(reportSessionPersistenceError);
            activeManager = null;
            activeRecorder = null;
            set({
              isMuted: false,
              audioLevel: { input: 0, output: 0 },
              agentState: null,
            });
          }
        },

        disconnect: async () => {
          ++connectAttempt;

          const manager = activeManager;
          const recorder = activeRecorder;
          if (
            !manager &&
            !recorder &&
            get().connectionState === ConnectionState.DISCONNECTED
          ) {
            return;
          }

          set({
            connectionState: ConnectionState.DISCONNECTING,
            agentState: null,
          });

          if (recorder) {
            applyTranscriptForRecorder(
              { type: "session-end", at: Date.now() },
              recorder,
            );
          }

          const results = await Promise.allSettled([
            manager?.disconnect(),
            recorder?.finalize(),
          ]);

          const persistenceResult = results[1];
          if (persistenceResult?.status === "rejected") {
            reportSessionPersistenceError(persistenceResult.reason);
          }

          if (activeManager && activeManager !== manager) {
            return;
          }

          activeManager = null;
          activeRecorder = null;
          set({
            connectionState: ConnectionState.DISCONNECTED,
            isMuted: false,
            audioLevel: { input: 0, output: 0 },
            agentState: null,
          });
        },

        toggleMute: () => {
          const state = get();
          if (state.connectionState !== ConnectionState.CONNECTED) return;

          const newMuteState = !state.isMuted;
          set({ isMuted: newMuteState });
          activeManager?.setMute(newMuteState);
        },
      };
    },
    { name: "Talk Tutor Audio Store" },
  ),
);
