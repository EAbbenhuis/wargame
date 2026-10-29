// Staf-server: een klein doorgeefluik naar OpenRouter voor de AI-staf.
//
// Waarom een server? Zo staat de API-sleutel alleen hier (in .env), nooit in de browser.
// De server bedenkt zelf niets: de browser stuurt de berichten (gemaakt door de engine uit het
// spelersbeeld, dus zonder informatie achter de fog of war), de server stuurt ze door en geeft
// de tekst van het model terug. De engine in de browser controleert de voorstellen daarna.

import express, { type Request, type Response } from 'express';

export interface AppOptions {
  apiKey: string | undefined;
  model: string;
  fetchImpl?: typeof fetch;
  maxRequestsPerMinute?: number;
  timeoutMs?: number;
  /** Alleen voor tests: ander adres dan openrouter.ai (bijvoorbeeld een nep-model). */
  upstreamUrl?: string;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_MESSAGES = 4;
const MAX_CHARS = 40_000;

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

function validMessages(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const m of value) {
    if (typeof m !== 'object' || m === null) return false;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'system' && role !== 'user') || typeof content !== 'string') return false;
    total += content.length;
  }
  return total <= MAX_CHARS;
}

export function createApp(options: AppOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const limit = options.maxRequestsPerMinute ?? 30;
  const app = express();
  app.use(express.json({ limit: '200kb' }));

  // Eenvoudige rem tegen per ongeluk eindeloos vragen (kosten!).
  let windowStart = Date.now();
  let count = 0;

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, hasKey: Boolean(options.apiKey), model: options.model });
  });

  app.post('/api/staff', async (req: Request, res: Response) => {
    const messages: unknown = (req.body as { messages?: unknown } | undefined)?.messages;
    if (!validMessages(messages)) {
      res.status(400).json({
        error: 'Ongeldig verzoek: verwacht { messages: [{ role, content }] }, niet te lang.',
      });
      return;
    }
    if (!options.apiKey) {
      res
        .status(503)
        .json({ error: 'Geen OPENROUTER_API_KEY ingesteld op de server (zie .env.example).' });
      return;
    }
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      count = 0;
    }
    if (++count > limit) {
      res.status(429).json({
        error: `Te veel vragen aan de staf (maximaal ${limit} per minuut). Even wachten.`,
      });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
    try {
      const upstream = await fetchImpl(options.upstreamUrl ?? OPENROUTER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Wargame AI-staf',
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: 0.3,
          max_tokens: 900,
          response_format: { type: 'json_object' },
        }),
      });
      if (!upstream.ok) {
        res.status(502).json({
          error: `OpenRouter gaf fout ${upstream.status}. Controleer sleutel, tegoed en model.`,
        });
        return;
      }
      const data = (await upstream.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        res.status(502).json({ error: 'OpenRouter gaf een leeg antwoord.' });
        return;
      }
      res.json({ content, model: options.model });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      res.status(502).json({
        error: aborted
          ? 'De staf deed er te lang over (time-out).'
          : 'Kon OpenRouter niet bereiken.',
      });
    } finally {
      clearTimeout(timer);
    }
  });

  return app;
}
