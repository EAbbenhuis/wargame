import { describe, expect, it } from 'vitest';
import { describeEvent } from './describe.ts';
import type { GameEvent } from '../types.ts';

describe('gebeurtenissen in gewone taal', () => {
  const name = (id: string) => ({ a: 'Eskadron Delta', d: 'Bataljon Wolf' })[id] ?? id;

  it('beschrijft een gevecht met uitleg over kolom en worp', () => {
    const event: GameEvent = {
      type: 'combat',
      attackerId: 'a',
      defenderId: 'd',
      attackerSide: 'blue',
      attack: 7,
      defense: 7.5,
      column: '1:1',
      roll: 5,
      attackerLoss: 1,
      defenderLoss: 3,
      retreat: false,
      notes: ['bos: verdediging x1,5'],
    };
    const text = describeEvent(event, name);
    expect(text).toContain('Eskadron Delta valt Bataljon Wolf aan');
    expect(text).toContain('7 tegen 7,5');
    expect(text).toContain('kolom 1:1');
    expect(text).toContain('Bataljon Wolf verliest 3');
  });

  it('beschrijft de inname van een doel', () => {
    const text = describeEvent(
      { type: 'captured', objectiveId: 'A', side: 'blue', from: 'red' },
      name,
      () => 'Grensbrug',
    );
    expect(text).toBe('Blauw neemt Grensbrug in (was van Rood).');
  });
});
