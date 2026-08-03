import { GoogleGenAI } from "@google/genai";
import type { ContentListUnion, Schema } from "@google/genai";

/**
 * Gemini client — uses gemini-3.5-flash for calendar ops.
 * Thinking is disabled (budget 0): dynamic thinking made simple creates take
 * too long and hit our timeout. Structured JSON is still Zod-validated before DB writes.
 */

export const AI_MODEL = "gemini-3.5-flash";
/** Hard cap so a stuck Gemini call can't hang the command bar forever. */
export const GEMINI_TIMEOUT_MS = 10_000;

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function client(): GoogleGenAI {
  if (!geminiConfigured()) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              "The planner took too long to respond. Please try again."
            )
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
  const response = await withTimeout(
    ai.models.generateContent({
      model: AI_MODEL,
      contents: opts.contents,
      config: {
        systemInstruction: opts.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: 0.2,
        // Flash thinks by default; keep it off so calendar ops stay under the timeout.
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    GEMINI_TIMEOUT_MS
  );

  const text = response.text;
  if (!text) throw new Error("Empty response from the model.");
  return JSON.parse(text);
}
