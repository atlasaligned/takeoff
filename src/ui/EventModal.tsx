import { respondToEvent } from '../engine/actions';
import { fmtDate } from './format';
import { Icon } from './icons';
import { useGame, useSt, type TabId } from './useGame';

export function EventModal() {
  const game = useGame();
  const st = useSt();
  const ev = st.pendingEvents[0];
  if (!ev) return null;
  return (
    <div className="overlay on">
      <div className="modal" role="dialog" aria-modal="true">
        <div className="mh">
          <div className="paused">
            <Icon id="i-alert" />
            Game paused — response required
          </div>
          <h2>{ev.title}</h2>
        </div>
        <div className="mb">
          <p>{ev.body}</p>
          {ev.choices.map((c) => (
            <button key={c.id} className="choice" onClick={() => game.act((s) => respondToEvent(s, c.id))}>
              <div className="t">{c.label}</div>
              <div className="c">{c.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Pause-and-acknowledge report for important outcomes (notice-flagged feed items). */
export function NoticeModal() {
  const game = useGame();
  const n = game.notices[0];
  if (!n) return null;
  const warn = n.kind === 'warning';
  return (
    <div className="overlay on">
      <div className={`modal notice${warn ? ' warn' : ''}`} role="dialog" aria-modal="true">
        <div className="mh">
          <div className="paused">
            <Icon id={warn ? 'i-warn' : 'i-info'} />
            Week {n.week} · {fmtDate(n.week)} — {warn ? 'incident report' : 'status report'}
          </div>
          <h2>{n.title}</h2>
        </div>
        <div className="mb">
          <p>{n.body}</p>
          <div className="btnrow">
            <button className="btn primary" autoFocus onClick={game.dismissNotice}>
              Continue{game.notices.length > 1 ? ` (${game.notices.length - 1} more)` : ''}
            </button>
            {n.goto && (
              <button
                className="btn"
                onClick={() => {
                  game.goTab(n.goto as TabId);
                  game.dismissNotice();
                }}
              >
                {n.goto} →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
