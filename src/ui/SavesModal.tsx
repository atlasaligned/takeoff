import { useState } from 'react';
import { deleteSave, listSaves, type SaveMeta } from './saves';
import { fmtMoney } from './format';
import { useGame } from './useGame';

function fmtSavedAt(ms: number): string {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Save/load manager. mode 'save' (in-game) adds the name form on top;
 * mode 'load' (start screen or in-game) is list-only. Both list, load and delete.
 */
export function SavesModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const game = useGame();
  const [saves, setSaves] = useState<SaveMeta[]>(() => listSaves());
  const [name, setName] = useState(() => {
    const s = game.state;
    return s ? `${s.labs[s.playerLab].shortName} — week ${s.week}` : '';
  });
  /** slot name whose delete button is waiting for a confirming second click */
  const [armed, setArmed] = useState<string | null>(null);

  const trimmed = name.trim();
  const exists = saves.some((m) => m.name === trimmed);

  const doSave = () => {
    if (!trimmed) return;
    if (game.saveNamed(trimmed)) onClose();
  };

  const doLoad = (m: SaveMeta) => {
    if (game.loadNamed(m.name)) onClose();
  };

  const doDelete = (m: SaveMeta) => {
    if (armed !== m.name) {
      setArmed(m.name);
      return;
    }
    deleteSave(m.name);
    setSaves(listSaves());
    setArmed(null);
  };

  return (
    <div className="overlay on" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal saves" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="paused">Save slots</div>
          <h2>{mode === 'save' ? 'Save game' : 'Load game'}</h2>
        </div>
        <div className="mb">
          {mode === 'save' && (
            <div className="saveform">
              <input
                value={name}
                autoFocus
                placeholder="Save name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSave()}
              />
              <button className="btn primary" disabled={!trimmed} onClick={doSave}>
                {exists ? 'Overwrite' : 'Save'}
              </button>
            </div>
          )}
          {saves.length === 0 ? (
            <p>No saved games yet.</p>
          ) : (
            <div className="savelist">
              {saves.map((m) => {
                const sum = m.summary;
                return (
                  <div key={m.name} className="saverow">
                    <div className="meta">
                      <div className="nm">
                        {m.name}
                        {sum.gameOver && <span className={`ended ${sum.gameOver.result}`}>{sum.gameOver.result === 'win' ? 'VICTORY' : 'DEFEAT'}</span>}
                      </div>
                      <div className="info">
                        {sum.labName} · {sum.dateLabel} (week {sum.week}) · cap {sum.capability.toFixed(1)} · {fmtMoney(sum.cash)}
                      </div>
                      <div className="when">saved {fmtSavedAt(m.savedAt)}</div>
                    </div>
                    <div className="rowbtns">
                      {mode === 'save' && (
                        <button className="btn sm" title="Reuse this slot's name — saving will overwrite it" onClick={() => setName(m.name)}>
                          Use name
                        </button>
                      )}
                      <button className="btn sm" onClick={() => doLoad(m)}>
                        Load
                      </button>
                      <button className={`btn sm${armed === m.name ? ' danger' : ''}`} onClick={() => doDelete(m)} onMouseLeave={() => setArmed(null)}>
                        {armed === m.name ? 'Confirm?' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="btnrow">
            <button className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
