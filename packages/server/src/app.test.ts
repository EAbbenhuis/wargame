import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppOptions } from './app.ts';

let server: Server | undefined;

async function start(options: Partial<AppOptions>): Promise<string> {
  const app = createApp({ apiKey: undefined, model: 'test/model', ...options });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(() => {
  server?.close();
  server = undefined;
});

const messages = [
  { role: 'system', content: 'Je bent de staf.' },
  { role: 'user', content: 'Wat nu?' },
];

describe('staf-server', () => {
  it('meldt in /api/health of er een sleutel is, zonder de sleutel te tonen', async () => {
    const url = await start({ apiKey: 'sk-geheim-123' });
    const body = await (await fetch(`${url}/api/health`)).json();
    expect(body).toEqual({ ok: true, hasKey: true, model: 'test/model' });
    expect(JSON.stringify(body)).not.toContain('sk-geheim');
  });

  it('weigert netjes zonder sleutel (503)', async () => {
    const url = await start({});
    const response = await fetch(`${url}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: string }).error).toMatch(/OPENROUTER_API_KEY/);
  });

  it('weigert ongeldige verzoeken (400)', async () => {
    const url = await start({ apiKey: 'sk-x' });
    for (const body of [
      {},
      { messages: 'x' },
      { messages: [{ role: 'assistant', content: 'x' }] },
      { messages: [{ role: 'user', content: 'x'.repeat(60_000) }] },
    ]) {
      const response = await fetch(`${url}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
    }
  });

  it('stuurt het verzoek door naar OpenRouter met sleutel en model, en geeft de tekst terug', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"antwoord":"ok","voorstellen":[]}' } }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }) as typeof fetch;
    const url = await start({ apiKey: 'sk-geheim', fetchImpl: fakeFetch });
    const response = await fetch(`${url}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      content: '{"antwoord":"ok","voorstellen":[]}',
      model: 'test/model',
    });
    expect(seen!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = seen!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-geheim');
    const sent = JSON.parse(String(seen!.init.body));
    expect(sent.model).toBe('test/model');
    expect(sent.messages).toEqual(messages);
  });

  it('vertaalt een fout van OpenRouter naar een nette melding (502), zonder de sleutel te lekken', async () => {
    const fakeFetch = (async () =>
      new Response('{"error":{"message":"Invalid key sk-geheim"}}', {
        status: 401,
      })) as typeof fetch;
    const url = await start({ apiKey: 'sk-geheim', fetchImpl: fakeFetch });
    const response = await fetch(`${url}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).toMatch(/401/);
    expect(text).not.toContain('sk-geheim');
  });

  it('beperkt het aantal verzoeken per minuut', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'x' } }] }), {
        status: 200,
      })) as typeof fetch;
    const url = await start({ apiKey: 'sk', fetchImpl: fakeFetch, maxRequestsPerMinute: 2 });
    const post = () =>
      fetch(`${url}/api/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(429);
  });
});
