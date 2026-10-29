// De twee staf-modi achter dezelfde interface (StaffAdvisor uit de engine).
//  - scripted:   draait in de browser, zonder netwerk. Standaard.
//  - openrouter: stuurt een samenvatting van het spelersbeeld via ons eigen servertje
//                (packages/server) naar een taalmodel. De API-sleutel staat alleen op de server.
import {
  buildStaffMessages,
  parseStaffResponse,
  scriptedAdvisor,
  type StaffAdvisor,
} from '@wargame/engine';

export type StaffMode = 'scripted' | 'openrouter';

export const openRouterAdvisor: StaffAdvisor = {
  id: 'openrouter',
  name: 'Staf met taalmodel (OpenRouter)',
  async ask(question, view) {
    const response = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: buildStaffMessages(view, question) }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `De staf-server gaf fout ${response.status}.`);
    }
    const { content } = (await response.json()) as { content: string };
    const parsed = parseStaffResponse(content);
    const warning = parsed.warnings.length > 0 ? `\n\n(${parsed.warnings.join(' ')})` : '';
    return { text: parsed.text + warning, proposals: parsed.proposals, source: 'openrouter' };
  },
};

export function advisorFor(mode: StaffMode): StaffAdvisor {
  return mode === 'openrouter' ? openRouterAdvisor : scriptedAdvisor;
}

export interface ServerHealth {
  ok: boolean;
  hasKey: boolean;
  model: string;
}

/** Draait de staf-server, en heeft hij een sleutel? */
export async function checkServer(): Promise<ServerHealth | null> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) return null;
    return (await response.json()) as ServerHealth;
  } catch {
    return null;
  }
}
