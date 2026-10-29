// Balanssimulatie: laat de computer beide kanten spelen over veel seeds en tel de uitslagen.
// Draaien:  npx tsx packages/engine/scripts/balance.ts [aantal] [houding-rood] [houding-blauw]
import { autoPlayTurn } from '../src/ai/autoplay.ts';
import { createGame } from '../src/game.ts';

const runs = Number(process.argv[2] ?? 40);
const redPosture = process.argv[3] ?? 'balanced';
const bluePosture = process.argv[4] ?? 'aggressive';
const tally = { blue: 0, red: 0, draw: 0 };
const objectives: Record<string, number> = {};
let blueLost = 0;
let redLost = 0;
for (let seed = 1; seed <= runs; seed++) {
  let state = createGame({
    scenario: 'grensbrug',
    seed,
    controllers: { red: { kind: 'ai', posture: redPosture } },
  });
  while (state.phase !== 'ended') state = autoPlayTurn(state, 'blue', bluePosture);
  const winner = state.outcome!.winner;
  tally[winner ?? 'draw'] += 1;
  for (const o of state.objectives)
    if (o.controller === 'blue') objectives[o.name] = (objectives[o.name] ?? 0) + 1;
  const strength = (side: string) =>
    Object.values(state.units)
      .filter((u) => u.side === side)
      .reduce((s, u) => s + u.strength, 0);
  blueLost += state.startStrength.blue - strength('blue');
  redLost += state.startStrength.red - strength('red');
}
console.log(`rood=${redPosture} blauw=${bluePosture} runs=${runs}`, tally);
console.log('doelen in blauwe handen (aantal spellen):', objectives);
console.log(
  'gem. verlies blauw',
  (blueLost / runs).toFixed(1),
  'rood',
  (redLost / runs).toFixed(1),
);
