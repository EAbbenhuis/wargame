// Start de staf-server. Leest .env (in deze map of in de hoofdmap van de repo).
//   OPENROUTER_API_KEY  sleutel van openrouter.ai (nooit committen!)
//   OPENROUTER_MODEL    welk model; standaard een goedkoop maar capabel model
//   STAFF_PORT          poort, standaard 8787
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from './app.ts';

export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

for (const file of [resolve('.env'), resolve('../../.env')]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const port = Number(process.env.STAFF_PORT ?? 8787);
const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const apiKey = process.env.OPENROUTER_API_KEY || undefined;

createApp({ apiKey, model, upstreamUrl: process.env.OPENROUTER_URL || undefined }).listen(
  port,
  () => {
    console.log(
      `Staf-server op http://localhost:${port} · model ${model} · ` +
        (apiKey
          ? 'sleutel gevonden'
          : 'GEEN sleutel: de staf met taalmodel staat uit, de rest werkt gewoon'),
    );
  },
);
