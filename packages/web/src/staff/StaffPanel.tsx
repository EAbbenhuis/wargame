import { useEffect, useRef, useState } from 'react';
import { STAFF_COMMANDS } from '@wargame/engine';
import { useGame } from '../store/gameStore.ts';
import { checkServer, type ServerHealth } from './advisors.ts';
import { useStaff } from './staffStore.ts';

export function StaffPanel() {
  const messages = useStaff((s) => s.messages);
  const busy = useStaff((s) => s.busy);
  const mode = useStaff((s) => s.mode);
  const setMode = useStaff((s) => s.setMode);
  const ask = useStaff((s) => s.ask);
  const apply = useStaff((s) => s.apply);
  const highlight = useStaff((s) => s.highlight);
  const highlighted = useStaff((s) => s.highlighted);
  const turn = useGame((s) => s.game?.turn ?? 0);
  const units = useGame((s) => s.game?.units);
  const unitName = (id: string) => units?.[id]?.name ?? id;
  const [question, setQuestion] = useState('');
  const [server, setServer] = useState<ServerHealth | null | undefined>(undefined);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void checkServer().then(setServer);
  }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = (q: string) => {
    if (!q.trim() || busy) return;
    void ask(q);
    setQuestion('');
  };

  const llmAvailable = server?.ok && server.hasKey;

  return (
    <section className="panel staff-panel" aria-label="AI-staf">
      <header className="panel-header">
        <h2>Staf</h2>
        <label className="mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            data-testid="staff-mode"
          >
            <option value="scripted">zonder taalmodel</option>
            <option value="openrouter" disabled={!llmAvailable}>
              met taalmodel{llmAvailable ? ` (${server!.model})` : ' (niet beschikbaar)'}
            </option>
          </select>
        </label>
      </header>
      <div className="quick">
        {STAFF_COMMANDS.filter((c) => c.id !== 'help')
          .slice(0, 6)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              onClick={() => submit(c.example)}
              disabled={busy}
            >
              {c.title}
            </button>
          ))}
      </div>
      <div className="messages" ref={listRef} data-testid="staff-messages">
        {messages.length === 0 && (
          <p className="hint">Stel de staf een vraag, of kies een knop hierboven.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`message ${m.from} ${m.error ? 'error' : ''} ${highlighted === m.id ? 'highlighted' : ''}`}
            onMouseEnter={() => m.proposals.length > 0 && highlight(m.id)}
          >
            <p>{m.text}</p>
            {m.proposals.length > 0 && (
              <>
                <ul className="proposals">
                  {m.proposals.map((p, i) => (
                    <li key={i} className={p.valid ? 'valid' : 'invalid'}>
                      <span aria-hidden>{p.valid ? '✓' : '✗'}</span>{' '}
                      <strong>{unitName(p.intent.unitId)}</strong> {p.reason}
                      {!p.valid && <em> Geweigerd: {p.error}</em>}
                    </li>
                  ))}
                </ul>
                {!m.applied && m.turn === turn && m.proposals.some((p) => p.valid) && (
                  <button
                    type="button"
                    className="apply"
                    onClick={() => apply(m.id)}
                    data-testid="staff-apply"
                  >
                    Neem {m.proposals.filter((p) => p.valid).length} voorstel(len) over
                  </button>
                )}
                {m.applied && <p className="small">Overgenomen als orders.</p>}
              </>
            )}
          </div>
        ))}
        {busy && <p className="hint">De staf denkt na…</p>}
      </div>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Bijvoorbeeld: maak een plan om doel B te nemen"
          aria-label="Vraag aan de staf"
          data-testid="staff-input"
        />
        <button type="submit" disabled={busy || !question.trim()}>
          Vraag
        </button>
      </form>
    </section>
  );
}
