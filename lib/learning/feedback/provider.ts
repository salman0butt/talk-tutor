import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { FeedbackProvider } from "@/lib/learning/feedback/service";

export const SESSION_FEEDBACK_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    grammarCorrections: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
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
        required: ["original", "corrected", "explanation", "category"],
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

  async generate({ prompt }: { prompt: string }): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
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
