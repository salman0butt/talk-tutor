import "server-only";
import { GoogleGenAI } from "@google/genai";
import type { FeedbackProvider } from "@/lib/learning/feedback/service";

export const SESSION_FEEDBACK_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    grammarCorrections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
          category: {
            type: "string",
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
        required: ["original", "corrected", "explanation", "category"],
      },
    },
    betterSentences: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          suggestion: { type: "string" },
          reason: { type: "string" },
        },
        required: ["original", "suggestion"],
      },
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          meaning: { type: "string" },
          example: { type: "string" },
        },
        required: ["term", "meaning"],
      },
    },
    fluency: {
      type: "object",
      properties: {
        score: { type: "integer" },
        summary: { type: "string" },
      },
      required: ["score", "summary"],
    },
    pronunciationNotes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          note: { type: "string" },
        },
        required: ["note"],
      },
    },
    nextSteps: {
      type: "array",
      items: { type: "string" },
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
  private readonly ai: GoogleGenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    this.ai = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_FEEDBACK_MODEL?.trim() || "gemini-2.5-flash";
  }

  async generate({ prompt }: { prompt: string }): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: SESSION_FEEDBACK_RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    if (!response.text?.trim()) {
      throw new Error("Feedback provider returned an empty response.");
    }
    return response.text;
  }
}
