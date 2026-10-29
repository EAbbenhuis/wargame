import type { StaffCommand } from '../types.ts';

// Wordt gebruikt als geen ander commando past. Lijst wordt ingevuld door index.ts.
export function helpCommand(all: () => StaffCommand[]): StaffCommand {
  return {
    id: 'help',
    title: 'Wat kan de staf?',
    example: 'Wat kun je allemaal?',
    keywords: ['help', 'wat kun', 'wat kan', 'commando'],
    run() {
      const list = all()
        .filter((c) => c.id !== 'help')
        .map((c) => `"${c.example}"`)
        .join(', ');
      return {
        text: `Ik ben de (eenvoudige) staf zonder taalmodel. U kunt mij bijvoorbeeld vragen: ${list}`,
        proposals: [],
      };
    },
  };
}
