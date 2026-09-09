import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import type { VocabularyExampleProvider } from "./service";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sentence: { type: Type.STRING },
    explanation: { type: Type.STRING },
    targetMistakeCategory: {
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
  required: ["sentence"],
} as const;

export class GeminiVocabularyExampleProvider
  implements VocabularyExampleProvider
{
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
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.25,
      },
    });

    if (!response.text?.trim()) {
      throw new Error("Vocabulary example provider returned an empty response.");
    }
    return response.text;
  }
}
