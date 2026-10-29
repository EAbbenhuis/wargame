// De AI-staf: gedeelde interface voor de 'scripted' staf (zonder netwerk) en de
// 'openrouter' staf (taalmodel via de server). Beide geven hetzelfde soort antwoord:
// tekst plus voorstellen. Voorstellen zijn intenties die de engine controleert
// voordat de speler ze kan overnemen. De staf kan dus nooit een onmogelijke zet laten uitvoeren.

import type { OrderIntent } from '../types.ts';
import type { PlayerView } from '../view.ts';

export interface StaffProposal {
  intent: OrderIntent;
  /** Waarom de staf dit voorstelt, in gewone taal. */
  reason: string;
}

export interface StaffReply {
  text: string;
  proposals: StaffProposal[];
  source: 'scripted' | 'openrouter';
  /** Welk staf-commando antwoordde (alleen scripted). */
  command?: string;
}

export interface StaffAdvisor {
  id: string;
  name: string;
  ask(question: string, view: PlayerView): Promise<StaffReply>;
}

/**
 * Een staf-commando voor de scripted staf.
 * Uitbreidingspunt "nieuw staf-commando": maak een bestand in ./commands/ en zet het in
 * de lijst in ./commands/index.ts.
 */
export interface StaffCommand {
  id: string;
  /** Korte titel, getoond als knop in het stafpaneel. */
  title: string;
  /** Voorbeeldvraag die de knop stelt. */
  example: string;
  /** Woorden waaraan de staf herkent dat deze vraag voor dit commando is. */
  keywords: string[];
  run(view: PlayerView, question: string): Omit<StaffReply, 'source' | 'command'>;
}
