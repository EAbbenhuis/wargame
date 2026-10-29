// Alle commando's van de scripted staf. Volgorde telt bij gelijke score: eerder = voorrang.
// Uitbreidingspunt "nieuw staf-commando": maak een bestand naast deze, en zet het in de lijst.
import type { StaffCommand } from '../types.ts';
import { attack } from './attack.ts';
import { defend } from './defend.ts';
import { helpCommand } from './help.ts';
import { plan } from './plan.ts';
import { recon } from './recon.ts';
import { situation } from './situation.ts';
import { threat } from './threat.ts';
import { weakest } from './weakest.ts';

export const STAFF_COMMANDS: StaffCommand[] = [];
STAFF_COMMANDS.push(
  plan,
  weakest,
  attack,
  defend,
  recon,
  threat,
  situation,
  helpCommand(() => STAFF_COMMANDS),
);
