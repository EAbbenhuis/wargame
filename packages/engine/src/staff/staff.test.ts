import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../game.ts';
import { offsetToAxial } from '../hex/hex.ts';
import { at, testGame, unit } from '../testing/fixtures.ts';
import { getPlayerView } from '../view.ts';
import { checkProposals } from './proposals.ts';
import { buildStaffMessages, parseStaffResponse, summarizeForModel } from './prompt.ts';
import { askScripted, matchCommand } from './scripted.ts';

const start = () => getPlayerView(createGame({ scenario: 'grensbrug', seed: 1 }), 'blue');

describe('scripted staf', () => {
  it('herkent de voorbeeldvragen', () => {
    expect(matchCommand('Waar is de vijand het zwakst?').id).toBe('zwakste-plek');
    expect(matchCommand('Maak een plan om doel B te nemen').id).toBe('plan-doel');
    expect(matchCommand('Hoe staan we ervoor?').id).toBe('situatie');
    expect(matchCommand('blablabla').id).toBe('help');
  });

  it('maakt een plan voor doel B met alleen geldige voorstellen', () => {
    const view = start();
    const reply = askScripted('Maak een plan om doel B te nemen', view);
    expect(reply.text).toContain('Kruisweide');
    expect(reply.proposals.length).toBeGreaterThan(0);
    const checked = checkProposals(view, reply.proposals);
    expect(checked.filter((c) => !c.valid)).toEqual([]);
  });

  it('noemt bij "zwakste plek" alleen vijanden die de speler ziet', () => {
    const state = testGame({
      units: [
        unit('b1', 'blue', 'recon', 1, 1),
        unit('r-zicht', 'red', 'logistics', 4, 1),
        unit('r-geheim', 'red', 'infantry', 9, 7),
      ],
    });
    state.units['r-geheim']!.name = 'Geheim Bataljon';
    const reply = askScripted('Waar is de vijand het zwakst?', getPlayerView(state, 'blue'));
    expect(reply.text).toContain('Logistiek');
    expect(reply.text).not.toContain('Geheim');
  });

  it('beantwoordt elke voorbeeldvraag zonder fouten, ook later in het spel', () => {
    const view = start();
    for (const q of [
      'Hoe staan we ervoor?',
      'Waar moeten we verkennen?',
      'Welke aanvallen hebben goede kansen?',
      'Hoe houden we onze doelen vast?',
      'Waar komt de vijand vandaan?',
      'help',
    ]) {
      const reply = askScripted(q, view);
      expect(reply.text.length).toBeGreaterThan(10);
      expect(checkProposals(view, reply.proposals).every((c) => c.valid)).toBe(true);
    }
  });
});

describe('voorstellen van de staf gaan door de engine', () => {
  it('weigert een zet buiten bereik, met een reden voor de speler', () => {
    const view = start();
    const checked = checkProposals(view, [
      {
        intent: { kind: 'move', unitId: 'b-inf-1', to: offsetToAxial({ col: 18, row: 12 }) },
        reason: 'onzin',
      },
    ]);
    expect(checked[0]!.valid).toBe(false);
    expect(checked[0]!.error).toMatch(/buiten bereik/i);
  });

  it('weigert ook via applyAction een order die verder gaat dan de eenheid kan', () => {
    const state = createGame({ scenario: 'grensbrug', seed: 1 });
    const result = applyAction(state, {
      type: 'setOrder',
      side: 'blue',
      unitId: 'b-inf-1',
      order: { kind: 'move', path: [at(6, 3), at(7, 3), at(8, 3), at(9, 3), at(10, 3)] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/buiten bereik/i);
  });

  it('weigert voorstellen voor vijandelijke of niet-bestaande eenheden en dubbele bestemmingen', () => {
    const view = start();
    const to = offsetToAxial({ col: 4, row: 5 });
    const checked = checkProposals(view, [
      { intent: { kind: 'defend', unitId: 'r-inf-1' }, reason: '' },
      { intent: { kind: 'move', unitId: 'b-inf-1', to }, reason: '' },
      { intent: { kind: 'move', unitId: 'b-arm-1', to }, reason: '' },
    ]);
    expect(checked.map((c) => c.valid)).toEqual([false, true, false]);
  });
});

describe('berichten voor het taalmodel', () => {
  it('bevatten alleen wat de speler ziet', () => {
    const state = testGame({
      units: [
        unit('b1', 'blue', 'infantry', 1, 1),
        unit('r-zicht', 'red', 'infantry', 3, 1),
        unit('r-geheim', 'red', 'armor', 9, 7),
      ],
    });
    const text = buildStaffMessages(getPlayerView(state, 'blue'), 'Wat nu?')
      .map((m) => m.content)
      .join('\n');
    expect(text).toContain('r-zicht');
    expect(text).not.toContain('r-geheim');
    expect(text).not.toMatch(/seed|rng/i);
  });

  it('bevatten de kaart, de doelen en de eigen eenheden', () => {
    const summary = summarizeForModel(start());
    expect(summary).toContain('Kruisweide');
    expect(summary).toContain('b-arm-1');
    expect(summary.split('\n').length).toBeGreaterThan(14);
  });

  it('leest een JSON-antwoord, ook in een codeblok', () => {
    const parsed = parseStaffResponse(
      '```json\n{"antwoord": "Val aan.", "voorstellen": [{"eenheid": "b-arm-1", "actie": "bewegen", "naar": [6, 5], "reden": "x"}, {"eenheid": "b-art-1", "actie": "verdedigen"}]}\n```',
    );
    expect(parsed.text).toBe('Val aan.');
    expect(parsed.proposals).toHaveLength(2);
    expect(parsed.proposals[0]!.intent).toEqual({
      kind: 'move',
      unitId: 'b-arm-1',
      to: offsetToAxial({ col: 6, row: 5 }),
    });
  });

  it('valt netjes terug op tekst als het model geen JSON geeft', () => {
    const parsed = parseStaffResponse('Ik zou aanvallen bij de brug.');
    expect(parsed.text).toBe('Ik zou aanvallen bij de brug.');
    expect(parsed.proposals).toEqual([]);
    expect(parsed.warnings.length).toBe(1);
  });

  it('slaat onleesbare voorstellen over met een waarschuwing', () => {
    const parsed = parseStaffResponse(
      '{"antwoord": "x", "voorstellen": [{"eenheid": "b1", "actie": "vliegen"}, {"actie": "bewegen"}]}',
    );
    expect(parsed.proposals).toEqual([]);
    expect(parsed.warnings).toHaveLength(2);
  });
});

describe('terreinregels voor het taalmodel', () => {
  it('komen uit de data, inclusief onbegaanbaar terrein', () => {
    const summary = summarizeForModel(start());
    expect(summary).toMatch(/Rivier: [^|]*pantser[^|]*onbegaanbaar/);
    expect(summary).toContain('Brug:');
  });
});
