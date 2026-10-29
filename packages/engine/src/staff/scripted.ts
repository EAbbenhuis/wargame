// Scripted staf: antwoordt zonder netwerk, op basis van een eenvoudige analyse van wat de
// speler ziet. Kiest het commando waarvan de meeste trefwoorden in de vraag staan.
import type { PlayerView } from '../view.ts';
import { STAFF_COMMANDS } from './commands/index.ts';
import type { StaffAdvisor, StaffCommand, StaffReply } from './types.ts';

export function matchCommand(
  question: string,
  commands: StaffCommand[] = STAFF_COMMANDS,
): StaffCommand {
  const q = question.toLowerCase();
  let best: StaffCommand | undefined;
  let bestScore = 0;
  for (const command of commands) {
    const score = command.keywords.filter((k) => q.includes(k)).length;
    if (score > bestScore) {
      best = command;
      bestScore = score;
    }
  }
  return best ?? commands.find((c) => c.id === 'help') ?? commands[0]!;
}

export function askScripted(question: string, view: PlayerView): StaffReply {
  const command = matchCommand(question);
  return { ...command.run(view, question), source: 'scripted', command: command.id };
}

export const scriptedAdvisor: StaffAdvisor = {
  id: 'scripted',
  name: 'Staf (zonder taalmodel)',
  ask: async (question, view) => askScripted(question, view),
};
