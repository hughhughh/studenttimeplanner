import { GoogleGenAI } from "@google/genai";
import type { ContentListUnion, Schema } from "@google/genai";

/**
 * Gemini client — uses gemini-2.5-flash (fast, low-cost) for all AI calls.
 * Structured JSON output is validated with Zod before anything hits the DB.
 */

export const AI_MODEL = "gemini-2.5-flash";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function client(): GoogleGenAI {
  if (!geminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * Generate a JSON response constrained to `responseSchema`. The schema is kept
 * deliberately permissive (optional fields); strict correctness is enforced
 * afterwards with Zod, never by trusting the model.
 */
export async function generateJson(opts: {
  systemInstruction: string;
  contents: ContentListUnion;
  responseSchema: Schema;
}): Promise<unknown> {
  const ai = client();
  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: opts.contents,
    config: {
      systemInstruction: opts.systemInstruction,
      responseMimeType: "application/json",
      responseSchema: opts.responseSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from the model.");
  return JSON.parse(text);
}
