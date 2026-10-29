import { describe, expect, it } from 'vitest';
import { autoPlayUntil } from './ai/autoplay.ts';
import { buildAfterActionReport } from './aar.ts';
import { createGame } from './game.ts';

describe('after-action report', () => {
  it('bouwt na een volledig spel een verslag op met kantelpunten en een tijdlijn per beurt', () => {
    const state = autoPlayUntil(createGame({ scenario: 'grensbrug', seed: 3 }), 99);
    expect(state.phase).toBe('ended');
    const report = buildAfterActionReport(state);
    expect(report.timeline).toHaveLength(state.history.length);
    expect(report.turningPoints.length).toBeGreaterThan(0);
    expect(report.turningPoints.length).toBeLessThanOrEqual(6);
    expect(report.summary).toBe(state.outcome!.summary);
    expect(report.lessons.length).toBeGreaterThan(0);
    expect(['Opdracht volbracht', 'Opdracht mislukt', 'Onbeslist']).toContain(report.headline);
  });

  it('is deterministisch', () => {
    const play = () =>
      buildAfterActionReport(autoPlayUntil(createGame({ scenario: 'grensbrug', seed: 4 }), 99));
    expect(play()).toEqual(play());
  });
});
