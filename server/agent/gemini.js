// Minimal Gemini API client (REST, no SDK): one generateContent call with function declarations.
// Environment: GEMINI_API_KEY, and optionally GEMINI_MODEL and GEMINI_BASE_URL. The base URL lets the same
// native-format calls go through a reseller such as APIYI (https://api.apiyi.com) instead of Google directly.

export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const geminiModel = () => process.env.GEMINI_MODEL || DEFAULT_MODEL;
const baseUrl = () => (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);

const userMessage = (status, detail) => {
  if (status === 401 || (status === 400 && /api key|token/i.test(detail))) return 'The Gemini API key was rejected. Check GEMINI_API_KEY in .env.';
  if (status === 403) return 'This Gemini API key is not allowed to use the model. Check the key in Google AI Studio.';
  if (status === 404) return `Gemini model "${geminiModel()}" was not found. Set GEMINI_MODEL in .env to a model your key can use.`;
  if (status === 429) return 'Gemini rate limit or quota reached. Wait a minute and try again.';
  return 'The AI analyst could not reach Gemini. Try again.';
};

export async function callGemini({ system, contents, tools, timeoutMs = 40000 }) {
  const model = geminiModel();
  const response = await fetch(`${baseUrl()}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      ...(tools.length ? { tools: [{ functionDeclarations: tools.map(({ name, description, parameters }) => ({ name, description, parameters })) }] } : {}),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.error?.message ?? '';
    console.error(`[Hunch analyst] Gemini ${response.status}: ${detail}`);
    throw Object.assign(new Error(userMessage(response.status, detail)), { status: 502 });
  }
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) throw Object.assign(new Error('Gemini returned no answer (it may have been blocked). Try rephrasing.'), { status: 502 });
  return candidate.content; // { role: 'model', parts: [...] }, kept whole so thought signatures go back unchanged
}
