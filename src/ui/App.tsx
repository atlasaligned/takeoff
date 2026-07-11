import { useMemo, useState } from 'react';
import { BAL, clamp } from '../engine/balance';
import { suggestActions } from '../engine/advisor';
import { flagship, runWeeksLeft, bandWidth } from '../engine/model';
import { runwayWeeks } from '../engine/finance';
import { jailbreakChance } from '../engine/jailbreak';
import { weekToDate } from '../engine/balance';
import { LAB_SEEDS } from '../engine/init';
import type { LabId } from '../engine/types';
import { GameCtx, hasSave, useGameController, useGame, useSt, type TabId } from './useGame';
import { LabMark, LAB_FLAVOR } from './labMarks';
import { Icon, IconDefs } from './icons';
import { fmtCompact, fmtMoney, fmtWeeks } from './format';
import { OverviewTab } from './tabs/Overview';
import { ModelsTab } from './tabs/Models';
import { ComputeTab } from './tabs/Compute';
import { ResearchTab } from './tabs/Research';
import { DiplomacyTab } from './tabs/Diplomacy';
import { PeopleTab } from './tabs/People';
import { FinanceTab } from './tabs/Finance';
import { RivalsTab } from './tabs/Rivals';
import { WorldTab } from './tabs/World';
import { FeedTab } from './tabs/Feed';
import { EventModal, NoticeModal } from './EventModal';

export default function App() {
  const game = useGameController();
  return (
    <GameCtx.Provider value={game}>
      <IconDefs />
      {game.state ? <GameScreen /> : <StartScreen />}
      {game.toast && <div className={`toast${game.toast.err ? ' err' : ''}`}>{game.toast.msg}</div>}
    </GameCtx.Provider>
  );
}

// ---------------------------------------------------------------- start

function StartScreen() {
  const game = useGame();
  const [lab, setLab] = useState<LabId>('helios');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  const [hints, setHints] = useState(true);
  const canContinue = useMemo(() => hasSave(), []);
  return (
    <div className="startscreen">
      <h1>
        TAKE<span className="ol">OFF</span>
      </h1>
      <p className="blurb">
        Run one of four frontier AI labs. Reach capability 100 with a model aligned enough to survive its own success, or talk the world into a
        verified global pause. Everything else is a way to lose: bankruptcy, the board, your government, other people's models.
      </p>
      <div className="pickhead">Select your lab</div>
      <div className="labgrid">
        {LAB_SEEDS.map((s) => {
          const flavor = LAB_FLAVOR[s.id];
          return (
            <button key={s.id} className={`labcard${lab === s.id ? ' sel' : ''}`} onClick={() => setLab(s.id)}>
              <div className="labtop">
                <LabMark id={s.id} color={s.color} />
                {flavor.tag && <span className={`labtag ${flavor.tag.tone}`}>{flavor.tag.text}</span>}
              </div>
              <h3>{s.name}</h3>
              <div className="where">{s.hq}</div>
              <p className="doctrine">{flavor.doctrine}</p>
              <div className="lstats">
                <div>
                  <span className="k">Capability</span>
                  <span className="v">{s.startCap}</span>
                </div>
                <div>
                  <span className="k">Chips</span>
                  <span className="v">{fmtCompact(s.chips)}</span>
                </div>
                <div>
                  <span className="k">Cash</span>
                  <span className="v">{fmtMoney(s.cash)}</span>
                </div>
              </div>
              <div className="traits">
                {(['aggression', 'safety', 'commerce'] as const).map((t) => (
                  <div key={t} className="trait">
                    <span className="k">{t}</span>
                    <span className="ticks">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <i key={i} className={i <= Math.round(s.profile[t] * 5) ? 'on' : ''} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="labfoot">{lab === s.id ? '▶ Selected' : 'Select'}</div>
            </button>
          );
        })}
      </div>
      <div className="launchbar">
        <label className="hintcheck">
          <input type="checkbox" checked={hints} onChange={(e) => setHints(e.target.checked)} />
          Advisor hints: suggests a sensible next action (recommended for new players)
        </label>
        <div className="seedbox">
          <span className="pill-note">seed</span>
          <input value={seed} onChange={(e) => setSeed(Number(e.target.value.replace(/\D/g, '')) || 0)} />
        </div>
        <div className="launchbtns">
          {canContinue && (
            <button className="btn" onClick={() => game.load()}>
              Continue saved game
            </button>
          )}
          <button className="btn primary" onClick={() => game.start(lab, seed, hints)}>
            New game
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- game shell

export function GameScreen() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const m = flagship(player);

  const frontier = Math.max(...Object.values(st.labs).map((l) => (l.alive ? (flagship(l)?.capability ?? 0) : 0)));
  const leader = Object.values(st.labs)
    .filter((l) => l.alive)
    .reduce((a, b) => ((flagship(a)?.capability ?? 0) >= (flagship(b)?.capability ?? 0) ? a : b));

  const net = player.weeklyRevenue - player.weeklyCosts;
  const runway = runwayWeeks(player);
  const date = weekToDate(st.week);
  const jb = jailbreakChance(st, player);
  const pending = st.pendingEvents.length > 0;

  const speedBtn = (s: number, label: string) => (
    <button
      key={s}
      id={s === 0 ? 'sp-pause' : undefined}
      className={game.speed === s ? (s === 0 ? 'paused-on' : 'on') : ''}
      onClick={() => game.setSpeed(s)}
    >
      {label}
    </button>
  );

  const chip = (opts: { icon: string; k: string; v: string; cls?: string; color?: string; tab: TabId }) => (
    <div className={`sc${opts.cls ? ` ${opts.cls}` : ''}`} onClick={() => game.goTab(opts.tab)}>
      <Icon id={opts.icon} />
      <span className="k">{opts.k}</span>
      <span className="v" style={opts.color ? { color: opts.color } : undefined}>
        {opts.v}
      </span>
    </div>
  );

  const bandTxt = m ? `${m.alignmentLo.toFixed(0)}–${m.alignmentHi.toFixed(0)}` : '—';
  const trustCls = (t: number) => (t < 25 ? 'alert' : t < 38 ? 'warn' : '');

  const TABS: { id: TabId; icon: string; label: string }[] = [
    { id: 'overview', icon: 'i-tray', label: 'Overview' },
    { id: 'models', icon: 'i-layers', label: 'Models' },
    { id: 'compute', icon: 'i-chipset', label: 'Compute' },
    { id: 'research', icon: 'i-flask', label: 'Research' },
    { id: 'diplomacy', icon: 'i-flag', label: 'Diplomacy' },
    { id: 'people', icon: 'i-person', label: 'People' },
    { id: 'finance', icon: 'i-dollar', label: 'Finance' },
    { id: 'rivals', icon: 'i-radar', label: 'Rivals' },
    { id: 'world', icon: 'i-globe', label: 'World' },
    { id: 'feed', icon: 'i-tray', label: 'Feed' },
  ];

  return (
    <>
      <div className="frontier">
        <span className="lbl">FRONTIER PROXIMITY</span>
        <div className="track">
          <div className="fill" style={{ width: `${clamp(frontier, 0, 100)}%` }} />
        </div>
        <span className="val">{frontier.toFixed(1)}&thinsp;/&thinsp;100</span>
        <span className="who">leader: {leader.shortName} ({leader.country.toUpperCase()})</span>
      </div>

      <header>
        <div className="brand">
          <svg className="logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M4 27h24" stroke="#e9e7e2" strokeWidth="2" strokeLinecap="round" />
            <path d="M6 24C12 23 19.5 17.5 24.5 7.5" stroke="#ff2a2a" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M19 8.5l5.5-1-1 5.5" stroke="#ff2a2a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <h1>{player.name.toUpperCase()}</h1>
            <div className="sub">{player.hq}</div>
          </div>
        </div>
        <div className="clock">
          <div>
            <div className="date">{date.label}</div>
            <div className="week">WEEK {st.week}</div>
          </div>
          <div className="speed">
            {speedBtn(0, '❚❚')}
            {speedBtn(1, '1×')}
            {speedBtn(2, '2×')}
            {speedBtn(4, '4×')}
          </div>
        </div>
        <div className="standings" onClick={() => game.goTab('rivals')} style={{ cursor: 'pointer' }} title="The race — see Rivals">
          {Object.values(st.labs)
            .slice()
            .sort((a, b) => (flagship(b)?.capability ?? 0) - (flagship(a)?.capability ?? 0))
            .map((l) => (
              <span key={l.id} className={`lb${l.id === st.playerLab ? ' you' : ''}${l.alive ? '' : ' dead'}`}>
                <span className="n" style={{ color: l.color }}>
                  {l.shortName}
                  {l.id === st.playerLab ? ' (YOU)' : ''}
                </span>
                <span className="c">{l.alive ? (flagship(l)?.capability ?? 0).toFixed(1) : '—'}</span>
              </span>
            ))}
        </div>
        <div className="hmetrics">
          <div className="hm big">
            <div className="k">Cash</div>
            <div className={`v${player.cash < 0 ? ' neg' : ''}`}>{fmtMoney(player.cash)}</div>
          </div>
          <div className="hm">
            <div className="k">Net / wk</div>
            <div className={`v${net < 0 ? ' neg' : ''}`}>{fmtMoney(net)}</div>
          </div>
          <div className="hm big">
            <div className="k">Runway</div>
            <div className={`v${runway < 15 ? ' neg' : runway < 30 ? ' warn' : ''}`}>{Number.isFinite(runway) ? fmtWeeks(runway) : '∞'}</div>
          </div>
          <div className="hm">
            <div className="k">Valuation</div>
            <div className="v">{fmtMoney(player.valuation)}</div>
          </div>
          <div className="hm">
            <div className="k">Compute</div>
            <div className="v">
              {fmtCompact(player.chips)} <small>chips</small>
            </div>
          </div>
        </div>
      </header>

      <div className="statebar">
        {chip({ icon: 'i-chipset', k: 'Capability', v: m ? m.capability.toFixed(1) : '—', color: 'var(--cap)', tab: 'models' })}
        {chip({
          icon: 'i-target',
          k: 'Alignment',
          v: bandTxt,
          color: '#7cc79a',
          cls: m && bandWidth(m) > 40 ? 'warn' : '',
          tab: 'models',
        })}
        {chip({ icon: 'i-shield', k: 'Robustness', v: m ? m.robustness.toFixed(0) : '—', cls: m && m.robustness < 40 ? 'warn' : '', tab: 'models' })}
        {chip({ icon: 'i-landmark', k: 'Govt trust', v: player.govTrust.toFixed(0), cls: trustCls(player.govTrust), tab: 'world' })}
        {chip({ icon: 'i-people', k: 'Public trust', v: player.publicTrust.toFixed(0), cls: trustCls(player.publicTrust), tab: 'world' })}
        {chip({
          icon: 'i-grid',
          k: 'Board',
          v: `${player.boardYours}/9 · disc ${player.discontent.toFixed(0)}`,
          cls: player.boardYours <= 4 && player.discontent > 50 ? 'alert' : player.discontent > 45 || player.boardYours <= 4 ? 'warn' : '',
          tab: 'people',
        })}
        {chip({
          icon: 'i-lockopen',
          k: 'Jailbreak',
          v: `${(jb * 100).toFixed(1)}%/wk`,
          cls: jb > 0.02 ? 'alert' : jb > 0.008 ? 'warn' : '',
          tab: 'world',
        })}
        {player.revenueExpectation &&
          chip({
            icon: 'i-gauge',
            k: 'Rev. target',
            v: `${fmtMoney(player.weeklyRevenue)} of ${fmtMoney(player.revenueExpectation.target)}`,
            cls: player.weeklyRevenue < player.revenueExpectation.target ? 'warn' : '',
            tab: 'finance',
          })}
        {player.run &&
          chip({
            icon: 'i-flame',
            k: player.run.codename,
            v: `${(100 * Math.min(1, player.run.doneFlop / player.run.targetFlop)).toFixed(0)}% · ${fmtWeeks(runWeeksLeft(player, player.run))}`,
            tab: 'models',
          })}
      </div>

      {st.hintsEnabled && <HintBar />}

      <nav>
        {TABS.map((t) => (
          <button key={t.id} className={game.tab === t.id ? 'on' : ''} onClick={() => game.goTab(t.id)}>
            <Icon id={t.icon} />
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {game.tab === 'overview' && <OverviewTab />}
        {game.tab === 'models' && <ModelsTab />}
        {game.tab === 'compute' && <ComputeTab />}
        {game.tab === 'research' && <ResearchTab />}
        {game.tab === 'diplomacy' && <DiplomacyTab />}
        {game.tab === 'people' && <PeopleTab />}
        {game.tab === 'finance' && <FinanceTab />}
        {game.tab === 'rivals' && <RivalsTab />}
        {game.tab === 'world' && <WorldTab />}
        {game.tab === 'feed' && <FeedTab />}
        <div className="footer-note">
          TAKEOFF · WEEK {st.week} · {BAL.ASI_CAPABILITY} CAPABILITY ENDS IT, ONE WAY OR THE OTHER
        </div>
      </main>

      <div className="menubtn">
        <button className="btn sm" onClick={() => game.save()}>
          Save
        </button>
        <button className="btn sm" onClick={() => game.quitToMenu()}>
          Menu
        </button>
      </div>

      {pending && !st.gameOver && <EventModal />}
      {!pending && !st.gameOver && <NoticeModal />}
      {st.gameOver && <EndScreen />}
    </>
  );
}

// ---------------------------------------------------------------- advisor

function HintBar() {
  const game = useGame();
  const st = useSt();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const hints = suggestActions(st);
  // skipped hints fall to the back of the line but stay reachable by cycling
  const ordered = [...hints.filter((h) => !skipped.includes(h.id)), ...hints.filter((h) => skipped.includes(h.id))];
  const hint = ordered[0];
  if (!hint || hints[0].id === dismissedId) return null;

  const cycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    // count only skips that still match a live hint; all skipped → start the rotation over
    const liveSkips = skipped.filter((id) => hints.some((h) => h.id === id)).length;
    setSkipped(liveSkips + 1 >= hints.length ? [] : [...skipped, hint.id]);
  };
  const pos = hints.findIndex((h) => h.id === hint.id) + 1;

  return (
    <div className={`hintbar${hint.urgent ? ' urgent' : ''}`} onClick={() => game.goTab(hint.tab)} title={hint.body}>
      <span className="bulb">{hint.urgent ? '▲ ALERT' : '› ADVISOR'}</span>
      <span className="ht">{hint.title}</span>
      <span className="hb">{hint.body}</span>
      <span className="hgo">{hint.tab.toUpperCase()} →</span>
      {hints.length > 1 && (
        <button className="hnext" title="Show the next-best suggestion" onClick={cycle}>
          next ({pos}/{hints.length})
        </button>
      )}
      <button
        className="hx"
        title="Hide hints until the situation changes"
        onClick={(e) => {
          e.stopPropagation();
          setDismissedId(hints[0].id);
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- end

function EndScreen() {
  const game = useGame();
  const st = useSt();
  const go = st.gameOver!;
  const player = st.labs[st.playerLab];
  const m = flagship(player);
  return (
    <div className="endscreen">
      <div className={`endcard ${go.result}`}>
        <div className="verdict">{go.result === 'win' ? 'YOU WIN' : 'GAME OVER'}</div>
        <h1>{go.title}</h1>
        <p>{go.body}</p>
        <div className="stats">
          <div className="hm">
            <div className="k">Survived until</div>
            <div className="v" style={{ fontSize: 16 }}>
              {weekToDate(go.week).label}
            </div>
          </div>
          <div className="hm">
            <div className="k">Final capability</div>
            <div className="v" style={{ fontSize: 16 }}>
              {m ? m.capability.toFixed(1) : '—'}
            </div>
          </div>
          <div className="hm">
            <div className="k">True alignment</div>
            <div className="v" style={{ fontSize: 16 }}>
              {m ? m.alignment.toFixed(1) : '—'}
            </div>
          </div>
          <div className="hm">
            <div className="k">Valuation</div>
            <div className="v" style={{ fontSize: 16 }}>
              {fmtMoney(player.valuation)}
            </div>
          </div>
        </div>
        <div className="btnrow">
          <button className="btn primary" onClick={() => game.quitToMenu()}>
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
