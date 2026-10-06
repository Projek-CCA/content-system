/**
 * Write scripts with the user's own AI account, straight from the browser.
 *
 * There is no server: the user's key stays in their browser and requests go
 * directly to the provider. Two ways in:
 *  1. Paste an API key for Claude (Anthropic), ChatGPT (OpenAI) or Gemini (Google).
 *  2. OpenRouter: one sign-in (OAuth PKCE) or key that reaches many models.
 */

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'openrouter';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  company: string;
  keyPlaceholder: string;
  keyUrl: string;
  /** Model ids or patterns tried in order to pick a default from the live model list. */
  preferred: (string | RegExp)[];
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: 'anthropic',
    label: 'Claude',
    company: 'Anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyUrl: 'https://platform.claude.com',
    preferred: ['claude-opus-5-5', /^claude-opus/, /^claude-sonnet/, /^claude/],
  },
  openai: {
    id: 'openai',
    label: 'ChatGPT',
    company: 'OpenAI',
    keyPlaceholder: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
    preferred: ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-sol', /^gpt-6/, /^gpt-5/, /^gpt/],
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    company: 'Google',
    keyPlaceholder: 'AIza...',
    keyUrl: 'https://aistudio.google.com/apikey',
    preferred: ['gemini-3.8-flash', 'gemini-3.5-flash', /^gemini-3/, /^gemini/],
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    company: 'OpenRouter',
    keyPlaceholder: 'sk-or-...',
    keyUrl: 'https://openrouter.ai/keys',
    preferred: ['anthropic/claude-opus-5.5', /^anthropic\/claude-opus-5/, /^anthropic\/claude-opus/, /^anthropic\/claude/, /^openai\/gpt/, /^google\/gemini/],
  },
};

export const PROVIDER_ORDER: ProviderId[] = ['anthropic', 'openai', 'gemini', 'openrouter'];

/** Claude models that take the effort setting and the server-side refusal fallback. */
const CLAUDE_CURRENT = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

export class AiError extends Error {}

// ---------------------------------------------------------------------------
// Models

export async function listModels(provider: ProviderId, key: string): Promise<string[]> {
  switch (provider) {
    case 'anthropic': {
      const client = await anthropicClient(key);
      const ids: string[] = [];
      try {
        for await (const model of client.models.list({ limit: 100 })) ids.push(model.id);
      } catch (error) {
        throw friendly(error);
      }
      return ids.filter((id) => id.startsWith('claude'));
    }
    case 'openai': {
      const data = await getJson('https://api.openai.com/v1/models', { Authorization: `Bearer ${key}` });
      return (data.data ?? [])
        .map((m: { id: string }) => m.id)
        .filter((id: string) => /^(gpt|o\d|chatgpt)/.test(id))
        .filter((id: string) => !/(audio|realtime|transcribe|tts|image|search|embedding|moderation|instruct)/.test(id));
    }
    case 'gemini': {
      const data = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key });
      return (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: { name: string }) => m.name.replace(/^models\//, ''))
        .filter((id: string) => id.startsWith('gemini'));
    }
    case 'openrouter': {
      const data = await getJson('https://openrouter.ai/api/v1/models', key ? { Authorization: `Bearer ${key}` } : {});
      return (data.data ?? []).map((m: { id: string }) => m.id);
    }
  }
}

/** The best default from a live model list, following the provider's preferences. */
export function pickDefaultModel(provider: ProviderId, ids: string[]): string | undefined {
  const usable = ids.filter((id) => !/(:|-fast\b|batch|preview-\d{2}-\d{2})/.test(id));
  for (const pref of PROVIDERS[provider].preferred) {
    if (typeof pref === 'string') {
      if (usable.includes(pref)) return pref;
      continue;
    }
    const matches = usable.filter((id) => pref.test(id)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (matches.length) return matches[0];
  }
  return usable[0] ?? ids[0];
}

// ---------------------------------------------------------------------------
// Generation

export interface GenerateOptions {
  provider: ProviderId;
  key: string;
  model: string;
  system: string;
  prompt: string;
  /** Called with each new piece of text as it streams in. */
  onText: (delta: string) => void;
  signal?: AbortSignal;
}

export async function generate(options: GenerateOptions): Promise<string> {
  switch (options.provider) {
    case 'anthropic':
      return generateClaude(options);
    case 'openai':
      return generateOpenAiCompatible(options, 'https://api.openai.com/v1/chat/completions', {});
    case 'openrouter':
      return generateOpenAiCompatible(options, 'https://openrouter.ai/api/v1/chat/completions', {
        'HTTP-Referer': appUrl(),
        'X-Title': 'Content Idea Matrix',
      });
    case 'gemini':
      return generateGemini(options);
  }
}

async function anthropicClient(key: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // The user's own key, used only from their own browser.
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

async function generateClaude({ key, model, system, prompt, onText, signal }: GenerateOptions): Promise<string> {
  const client = await anthropicClient(key);
  const current = CLAUDE_CURRENT.includes(model);
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 64000,
        system,
        messages: [{ role: 'user', content: prompt }],
        ...(current
          ? {
              output_config: { effort: 'medium' as const },
              // If the model declines, the API retries on a fallback model in the same call.
              betas: ['server-side-fallback-2026-07-01'],
              fallbacks: 'default' as const,
            }
          : {}),
      },
      { signal },
    );
    stream.on('text', (delta) => onText(delta));
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal') {
      throw new AiError('The model declined to write this one. Try different wording in "What is this content about?".');
    }
    return message.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
  } catch (error) {
    throw friendly(error);
  }
}

async function generateOpenAiCompatible(
  { key, model, system, prompt, onText, signal }: GenerateOptions,
  url: string,
  extraHeaders: Record<string, string>,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
    signal,
  }).catch((error) => {
    throw friendly(error);
  });
  if (!response.ok) throw await httpError(response);
  let text = '';
  await readSse(response, (data) => {
    const json = JSON.parse(data);
    if (json.error) throw new AiError(json.error.message ?? 'The AI provider returned an error.');
    const delta: string | undefined = json.choices?.[0]?.delta?.content;
    if (delta) {
      text += delta;
      onText(delta);
    }
  });
  return text;
}

async function generateGemini({ key, model, system, prompt, onText, signal }: GenerateOptions): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }),
    signal,
  }).catch((error) => {
    throw friendly(error);
  });
  if (!response.ok) throw await httpError(response);
  let text = '';
  await readSse(response, (data) => {
    const json = JSON.parse(data);
    const parts: { text?: string }[] = json.candidates?.[0]?.content?.parts ?? [];
    const delta = parts.map((p) => p.text ?? '').join('');
    if (delta) {
      text += delta;
      onText(delta);
    }
  });
  return text;
}

/** Read a server-sent-events body and hand each `data:` payload to `onData`. */
export async function readSse(response: Response, onData: (data: string) => void): Promise<void> {
  if (!response.body) throw new AiError('The AI provider sent an empty response.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      onData(data);
    }
  }
  const last = buffer.trim();
  if (last.startsWith('data:') && last.slice(5).trim() && last.slice(5).trim() !== '[DONE]') onData(last.slice(5).trim());
}

// ---------------------------------------------------------------------------
// OpenRouter sign-in (OAuth PKCE)

const VERIFIER_KEY = 'cim.openrouter.verifier';

export function appUrl(): string {
  return window.location.origin + window.location.pathname;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Send the user to OpenRouter to approve access; they come back with ?code=... */
export async function startOpenRouterSignIn(): Promise<void> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({ callback_url: appUrl(), code_challenge: challenge, code_challenge_method: 'S256' });
  window.location.assign(`https://openrouter.ai/auth?${params}`);
}

let pendingSignIn: Promise<string | null> | null = null;

/** If we just came back from OpenRouter, swap the code for a key. Returns null otherwise. Runs once per page load. */
export function finishOpenRouterSignIn(): Promise<string | null> {
  pendingSignIn ??= exchangeOpenRouterCode();
  return pendingSignIn;
}

async function exchangeOpenRouterCode(): Promise<string | null> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return null;
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  let verifier: string | null = null;
  try {
    verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
  } catch {
    verifier = null;
  }
  if (!verifier) throw new AiError('The OpenRouter sign-in expired. Please try again.');
  const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: 'S256' }),
  });
  if (!response.ok) throw await httpError(response);
  const data = await response.json();
  if (!data.key) throw new AiError('OpenRouter did not return a key. Please try again.');
  return data.key as string;
}

// ---------------------------------------------------------------------------
// Errors

async function getJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers }).catch((error) => {
    throw friendly(error);
  });
  if (!response.ok) throw await httpError(response);
  return response.json();
}

async function httpError(response: Response): Promise<AiError> {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? body?.message ?? '';
  } catch {
    detail = '';
  }
  return new AiError(messageFor(response.status, detail));
}

function messageFor(status: number | undefined, detail: string): string {
  if (status === 401 || status === 403) return 'The key was rejected. Check that you copied the whole key and that it is still active.';
  if (status === 402) return 'Your account is out of credit. Add credit with the provider, then try again.';
  if (status === 404) return 'That model is not available on your account. Pick another model in AI settings.';
  if (status === 429) return 'Too many requests or not enough credit right now. Wait a moment, or check your usage limits.';
  if (status && status >= 500) return 'The AI provider is having trouble right now. Try again in a minute.';
  return detail || 'Something went wrong talking to the AI provider.';
}

function friendly(error: unknown): Error {
  if (error instanceof AiError) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return error;
  const e = error as { status?: number; message?: string; name?: string };
  if (e?.name === 'APIUserAbortError' || e?.name === 'AbortError') return error as Error;
  if (typeof e?.status === 'number') return new AiError(messageFor(e.status, e.message ?? ''));
  if (error instanceof TypeError) return new AiError('Could not reach the AI provider. Check your internet connection.');
  return new AiError(e?.message || 'Something went wrong talking to the AI provider.');
}

export function isAbort(error: unknown): boolean {
  const e = error as { name?: string };
  return e?.name === 'AbortError' || e?.name === 'APIUserAbortError';
}
