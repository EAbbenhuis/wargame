// Berichten voor het taalmodel (OpenRouter-modus) en het lezen van het antwoord.
//
// Het model krijgt ALLEEN een samenvatting van het spelersbeeld: eigen eenheden, vijanden die
// nu zichtbaar zijn, en herinneringen aan vijanden die uit zicht zijn. Geen verborgen eenheden,
// geen seed. Zijn voorstellen komen terug als intenties die de engine controleert.

import { axialToOffset, offsetToAxial } from '../hex/hex.ts';
import { unitTypeOf } from '../rules/map.ts';
import type { OrderIntent } from '../types.ts';
import type { PlayerView } from '../view.ts';
import type { StaffProposal } from './types.ts';

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export const STAFF_SYSTEM_PROMPT = `Je bent de stafofficier (S3, operaties) van een brigadecommandant in een fictief wargame.
Je adviseert in het Nederlands, kort en concreet (maximaal 6 zinnen), in de toon van een stafofficier.
Beide partijen geven tegelijk bevelen; daarna worden alle bevelen tegelijk uitgevoerd.
Je kent alleen wat de commandant ziet. Verzin geen vijandelijke eenheden.

Spelregels in het kort:
- Coördinaten zijn [kolom, rij]. Oneven rijen schuiven een halve hex naar rechts.
- Elke eenheid heeft bewegingspunten; terrein kost punten. Pantser en wielvoertuigen kunnen niet door een moeras, en niet door een rivier (alleen over een brug).
- Wie naast een vijand komt, stopt. Aanvallen kan alleen op een zichtbare vijand, vanaf een buurhex.
- Artillerie vuurt op een zichtbare hex binnen bereik, vóór alle beweging.
- Een doel is van wie er aan het eind van de beurt op staat.

Antwoord ALTIJD als JSON, zonder andere tekst:
{"antwoord": "<advies in gewone taal>",
 "voorstellen": [
   {"eenheid": "<id van een eigen eenheid>", "actie": "bewegen", "naar": [kolom, rij], "reden": "<kort>"},
   {"eenheid": "<id>", "actie": "aanvallen", "doelwit": "<id van een zichtbare vijand>", "reden": "<kort>"},
   {"eenheid": "<id>", "actie": "vuren", "naar": [kolom, rij], "reden": "<kort>"},
   {"eenheid": "<id>", "actie": "verdedigen", "reden": "<kort>"}
 ]}
Stel alleen zetten voor die binnen het bereik van de eenheid liggen. "voorstellen" mag leeg zijn.`;

const pos = (hex: { q: number; r: number }) => {
  const { col, row } = axialToOffset(hex);
  return [col, row];
};

/** Samenvatting van het spelersbeeld als compacte tekst. Bevat niets achter de fog of war. */
export function summarizeForModel(view: PlayerView): string {
  const legend = Object.values(view.catalog.terrains)
    .map((t) => `${t.symbol}=${t.name.toLowerCase()}`)
    .join(' ');
  const rows: string[] = [];
  const bySymbol = new Map(Object.values(view.catalog.terrains).map((t) => [t.id, t.symbol]));
  for (let row = 0; row < view.map.rows; row++) {
    let line = '';
    for (let col = 0; col < view.map.cols; col++)
      line += bySymbol.get(view.map.terrain[row * view.map.cols + col]!) ?? '?';
    rows.push(`${String(row).padStart(2, ' ')} ${line}`);
  }
  const own = view.ownUnits.map((u) => {
    const t = unitTypeOf(view.catalog, u);
    return {
      id: u.id,
      naam: u.name,
      type: t.name,
      positie: pos(u.hex),
      sterkte: `${u.strength}/${t.maxStrength}`,
      bewegingspunten: t.movement,
      ...(t.fireRange > 0 ? { vuurbereik: t.fireRange } : {}),
    };
  });
  const enemies = view.enemies.map((e) => ({
    id: e.id,
    type: view.catalog.unitTypes[e.type]?.name ?? e.type,
    positie: pos(e.hex),
    sterkte: e.strength,
  }));
  const memory = view.lastSeen.map((s) => ({
    type: view.catalog.unitTypes[s.type]?.name ?? s.type,
    positie: pos(s.hex),
    beurt: s.turn,
  }));
  const objectives = view.objectives.map((o) => ({
    id: o.id,
    naam: o.name,
    positie: pos(o.hex),
    bezitter: o.controller === view.side ? 'wij' : o.controller ? 'vijand' : 'niemand',
    waarde: o.value,
  }));
  return [
    `Beurt ${view.turn} van ${view.maxTurns}. Opdracht: ${view.briefing}`,
    `Kaart (${legend}), kolommen 0-${view.map.cols - 1} van links naar rechts:`,
    ...rows,
    `Doelen: ${JSON.stringify(objectives)}`,
    `Eigen eenheden: ${JSON.stringify(own)}`,
    `Zichtbare vijanden: ${JSON.stringify(enemies)}`,
    `Eerder gezien (positie kan veranderd zijn): ${JSON.stringify(memory)}`,
  ].join('\n');
}

export function buildStaffMessages(view: PlayerView, question: string): ChatMessage[] {
  return [
    { role: 'system', content: STAFF_SYSTEM_PROMPT },
    { role: 'user', content: `${summarizeForModel(view)}\n\nVraag van de commandant: ${question}` },
  ];
}

export interface ParsedStaffResponse {
  text: string;
  proposals: StaffProposal[];
  /** Problemen bij het lezen (bijvoorbeeld een voorstel zonder eenheid). */
  warnings: string[];
}

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : content;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

const isCoord = (v: unknown): v is [number, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => typeof n === 'number' && Number.isInteger(n));

/** Lees het antwoord van het model. Nooit een uitzondering: bij onzin komt er gewoon tekst terug. */
export function parseStaffResponse(content: string): ParsedStaffResponse {
  const data = extractJson(content) as { antwoord?: unknown; voorstellen?: unknown } | null;
  if (!data || typeof data !== 'object') {
    return {
      text: content.trim(),
      proposals: [],
      warnings: [
        'Het antwoord van het model was geen geldige JSON; alleen de tekst wordt getoond.',
      ],
    };
  }
  const text = typeof data.antwoord === 'string' ? data.antwoord : '';
  const warnings: string[] = [];
  const proposals: StaffProposal[] = [];
  const list = Array.isArray(data.voorstellen) ? data.voorstellen : [];
  for (const raw of list) {
    const p = raw as Record<string, unknown>;
    const unitId = typeof p.eenheid === 'string' ? p.eenheid : '';
    const reason = typeof p.reden === 'string' ? p.reden : '';
    let intent: OrderIntent | null = null;
    if (!unitId) {
      warnings.push('Een voorstel zonder eenheid is overgeslagen.');
      continue;
    }
    switch (p.actie) {
      case 'bewegen':
        if (isCoord(p.naar))
          intent = { kind: 'move', unitId, to: offsetToAxial({ col: p.naar[0], row: p.naar[1] }) };
        break;
      case 'vuren':
        if (isCoord(p.naar))
          intent = {
            kind: 'fire',
            unitId,
            target: offsetToAxial({ col: p.naar[0], row: p.naar[1] }),
          };
        break;
      case 'aanvallen':
        if (typeof p.doelwit === 'string') intent = { kind: 'attack', unitId, targetId: p.doelwit };
        break;
      case 'verdedigen':
        intent = { kind: 'defend', unitId };
        break;
    }
    if (intent) proposals.push({ intent, reason });
    else warnings.push(`Voorstel voor ${unitId} kon niet gelezen worden.`);
  }
  return { text: text || 'De staf gaf geen toelichting.', proposals, warnings };
}
