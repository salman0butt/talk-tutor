import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { FeedbackProvider } from "@/lib/learning/feedback/service";

const FEEDBACK_REQUEST_TIMEOUT_MS = 60_000;
const FEEDBACK_MAX_OUTPUT_TOKENS = 8_192;
const FEEDBACK_THINKING_BUDGET = 2_048;

export const SESSION_FEEDBACK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    grammarCorrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceSequence: { type: Type.INTEGER },
          original: { type: Type.STRING },
          corrected: { type: Type.STRING },
          explanation: { type: Type.STRING },
          category: {
            type: Type.STRING,
            enum: [
              "articles",
              "verb_tense",
              "prepositions",
              "word_order",
              "pluralization",
              "vocabulary_misuse",
              "agreement",
              "other",
            ],
          },
        },
        required: [
          "sourceSequence",
          "original",
          "corrected",
          "explanation",
          "category",
        ],
      },
    },
    betterSentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          suggestion: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["original", "suggestion"],
      },
    },
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          meaning: { type: Type.STRING },
          example: { type: Type.STRING },
        },
        required: ["term", "meaning"],
      },
    },
    fluency: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        summary: { type: Type.STRING },
      },
      required: ["score", "summary"],
    },
    pronunciationNotes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          term: { type: Type.STRING },
          note: { type: Type.STRING },
        },
        required: ["note"],
      },
    },
    nextSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    "summary",
    "grammarCorrections",
    "betterSentences",
    "vocabulary",
    "fluency",
    "pronunciationNotes",
    "nextSteps",
  ],
} as const;

export class GeminiFeedbackProvider implements FeedbackProvider {
  private readonly model =
    process.env.GEMINI_FEEDBACK_MODEL?.trim() || "gemini-2.5-flash";

  async generate({
    systemInstruction,
    prompt,
  }: {
    systemInstruction: string;
    prompt: string;
  }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: SESSION_FEEDBACK_RESPONSE_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: FEEDBACK_MAX_OUTPUT_TOKENS,
        ...(this.model.startsWith("gemini-2.5-")
          ? {
              // Gemini 2.5 Flash defaults to dynamic thinking. Keep reasoning
              // available for language analysis, but bound it so a simple
              // feedback request cannot consume the entire response budget.
              thinkingConfig: { thinkingBudget: FEEDBACK_THINKING_BUDGET },
            }
          : {}),
        httpOptions: { timeout: FEEDBACK_REQUEST_TIMEOUT_MS },
      },
    });

    if (!response.text?.trim()) {
      throw new Error("Feedback provider returned an empty response.");
    }
    return response.text;
  }
}
