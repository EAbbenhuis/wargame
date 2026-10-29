// Gesprek met de staf (interface-toestand). De voorstellen worden met de engine gecontroleerd.
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { checkProposals, type CheckedProposal } from '@wargame/engine';
import { currentView, gameStore } from '../store/gameStore.ts';
import { advisorFor, type StaffMode } from './advisors.ts';

export interface StaffMessage {
  id: number;
  from: 'player' | 'staff';
  text: string;
  turn: number;
  proposals: CheckedProposal[];
  applied?: boolean;
  source?: 'scripted' | 'openrouter';
  error?: boolean;
}

interface StaffState {
  mode: StaffMode;
  busy: boolean;
  messages: StaffMessage[];
  /** Voorstellen van dit bericht worden op de kaart getoond. */
  highlighted: number | null;
  setMode: (mode: StaffMode) => void;
  ask: (question: string) => Promise<void>;
  apply: (messageId: number) => number;
  highlight: (messageId: number | null) => void;
  reset: () => void;
}

let nextId = 1;

export const staffStore = createStore<StaffState>()((set, get) => ({
  mode: 'scripted',
  busy: false,
  messages: [],
  highlighted: null,

  setMode: (mode) => set({ mode }),

  ask: async (question) => {
    const view = currentView(gameStore.getState());
    if (!view || !question.trim()) return;
    const asked: StaffMessage = {
      id: nextId++,
      from: 'player',
      text: question,
      turn: view.turn,
      proposals: [],
    };
    set({ messages: [...get().messages, asked], busy: true });
    try {
      // Fog of war geldt altijd voor de staf, ook als het debugmenu hem uitzet.
      const fair = currentView({ ...gameStore.getState(), fogOff: false })!;
      const reply = await advisorFor(get().mode).ask(question, fair);
      const checked = checkProposals(fair, reply.proposals);
      const answer: StaffMessage = {
        id: nextId++,
        from: 'staff',
        text: reply.text,
        turn: view.turn,
        proposals: checked,
        source: reply.source,
      };
      set({
        messages: [...get().messages, answer],
        highlighted: checked.length > 0 ? answer.id : get().highlighted,
      });
    } catch (error) {
      const text =
        (error instanceof Error ? error.message : String(error)) +
        ' Tip: zet de staf op "zonder taalmodel", dan werkt alles zonder netwerk.';
      set({
        messages: [
          ...get().messages,
          { id: nextId++, from: 'staff', text, turn: view.turn, proposals: [], error: true },
        ],
      });
    } finally {
      set({ busy: false });
    }
  },

  // Neem de geldige voorstellen over als orders. De engine controleert ze nogmaals.
  apply: (messageId) => {
    const message = get().messages.find((m) => m.id === messageId);
    if (!message) return 0;
    let applied = 0;
    for (const p of message.proposals) {
      if (p.valid && gameStore.getState().setOrder(p.intent.unitId, p.order)) applied += 1;
    }
    set({
      messages: get().messages.map((m) => (m.id === messageId ? { ...m, applied: true } : m)),
      highlighted: null,
    });
    return applied;
  },

  highlight: (messageId) => set({ highlighted: messageId }),
  reset: () => set({ messages: [], highlighted: null, busy: false }),
}));

export function useStaff<T>(selector: (state: StaffState) => T): T {
  return useStore(staffStore, selector);
}
