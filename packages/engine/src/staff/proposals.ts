// Voorstellen van de staf controleren. Elk voorstel gaat door intentToOrder (en daarmee
// validateOrder). Ongeldige voorstellen krijgen een reden die de speler te zien krijgt.
import { hexKey } from '../hex/hex.ts';
import { intentToOrder } from '../rules/orders.ts';
import type { Order } from '../types.ts';
import type { PlayerView } from '../view.ts';
import type { StaffProposal } from './types.ts';

export type CheckedProposal = StaffProposal &
  (
    | { valid: true; order: Order; error?: undefined }
    | { valid: false; error: string; order?: undefined }
  );

export function checkProposals(view: PlayerView, proposals: StaffProposal[]): CheckedProposal[] {
  const destinations = new Set<string>();
  const units = new Set<string>();
  return proposals.map((proposal) => {
    if (units.has(proposal.intent.unitId)) {
      return {
        ...proposal,
        valid: false,
        error: 'Deze eenheid heeft in dit plan al een andere order.',
      };
    }
    const result = intentToOrder(view, proposal.intent);
    if (!result.ok) return { ...proposal, valid: false, error: result.error };
    const order = result.order;
    const end = order.kind === 'move' || order.kind === 'attack' ? order.path.at(-1) : undefined;
    if (end) {
      if (destinations.has(hexKey(end))) {
        return {
          ...proposal,
          valid: false,
          error: 'Twee eenheden in dit plan willen naar dezelfde hex.',
        };
      }
      destinations.add(hexKey(end));
    }
    units.add(proposal.intent.unitId);
    return { ...proposal, valid: true, order };
  });
}
