import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiError, generate, pickDefaultModel, readSse } from './ai';

const sse = (events: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        // Split mid-event to prove chunk boundaries are handled.
        const body = events.map((e) => `data: ${e}\n\n`).join('');
        controller.enqueue(encoder.encode(body.slice(0, 17)));
        controller.enqueue(encoder.encode(body.slice(17)));
        controller.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );

afterEach(() => vi.unstubAllGlobals());

describe('pickDefaultModel', () => {
  it('prefers the exact default, then the newest match, skipping fast/batch variants', () => {
    expect(pickDefaultModel('anthropic', ['claude-haiku-4-5', 'claude-opus-5-5', 'claude-sonnet-5-5'])).toBe('claude-opus-5-5');
    expect(pickDefaultModel('anthropic', ['claude-opus-4-8', 'claude-opus-5', 'claude-sonnet-5-5'])).toBe('claude-opus-5');
    expect(
      pickDefaultModel('openrouter', ['openai/gpt-6', 'anthropic/claude-opus-4.8', 'anthropic/claude-opus-5', 'anthropic/claude-opus-5:batch', 'anthropic/claude-opus-5-fast']),
    ).toBe('anthropic/claude-opus-5');
    expect(pickDefaultModel('gemini', ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'])).toBe('gemini-3.8-flash');
    expect(pickDefaultModel('openai', ['gpt-5.6-sol', 'gpt-6-luna', 'o4'])).toBe('gpt-6-luna');
  });
});

describe('readSse', () => {
  it('reassembles events split across chunks and ignores [DONE]', async () => {
    const seen: string[] = [];
    await readSse(sse(['{"a":1}', '{"a":2}', '[DONE]']), (d) => seen.push(d));
    expect(seen).toEqual(['{"a":1}', '{"a":2}']);
  });
});

describe('generate', () => {
  const base = { key: 'k', model: 'm', system: 'sys', prompt: 'write' };

  it('streams from OpenAI-compatible APIs (OpenAI and OpenRouter)', async () => {
    const fetchMock = vi.fn(async () =>
      sse(['{"choices":[{"delta":{"content":"Hook: "}}]}', '{"choices":[{"delta":{"content":"Halal ✓"}}]}', '[DONE]']),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { origin: 'https://projek-cca.github.io', pathname: '/content-system/' } });
    const deltas: string[] = [];
    const text = await generate({ ...base, provider: 'openrouter', onText: (d) => deltas.push(d) });
    expect(text).toBe('Hook: Halal ✓');
    expect(deltas).toEqual(['Hook: ', 'Halal ✓']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k');
    expect(JSON.parse(init.body as string).messages[0]).toEqual({ role: 'system', content: 'sys' });
  });

  it('streams from Gemini', async () => {
    const fetchMock = vi.fn(async () => sse(['{"candidates":[{"content":{"parts":[{"text":"Sedap!"}]}}]}']));
    vi.stubGlobal('fetch', fetchMock);
    const text = await generate({ ...base, provider: 'gemini', model: 'gemini-3.8-flash', onText: () => {} });
    expect(text).toBe('Sedap!');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-3.8-flash:streamGenerateContent?alt=sse');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('k');
  });

  it('explains a rejected key in plain words', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 })));
    await expect(generate({ ...base, provider: 'openai', onText: () => {} })).rejects.toThrow(AiError);
    await expect(generate({ ...base, provider: 'openai', onText: () => {} })).rejects.toThrow(/key was rejected/);
  });
});
