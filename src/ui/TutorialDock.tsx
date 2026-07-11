import { useEffect, useRef, useState } from 'react';
import { TUTORIAL_STEPS } from './tutorial';
import { useGame, useSt } from './useGame';

/**
 * Drives the guided tutorial in two modes per step: a centered briefing modal
 * (dimmed backdrop, same language as event modals) to read, then — after
 * "Got it" — a slim bottom-center task strip so the board is fully visible
 * while the player clicks the highlighted target. While mounted, the shell is
 * pointer-locked (body.tut-lock) and only the step's data-tut targets are
 * re-enabled. Steps auto-advance when `done` sees the action in GameState,
 * which pops the next briefing.
 */
export function TutorialDock() {
  const game = useGame();
  const st = useSt();
  const [idx, setIdx] = useState(0);
  /** briefing = centered modal; false = minimized task strip */
  const [briefing, setBriefing] = useState(true);
  /** week the current step started at — for the "let N weeks run" step */
  const enteredWeek = useRef(st.week);

  const step = TUTORIAL_STEPS[Math.min(idx, TUTORIAL_STEPS.length - 1)];
  const onTab = game.tab === step.tab;
  const last = idx >= TUTORIAL_STEPS.length - 1;

  // StrictMode-safe advance: double-invoked effects bump at most once
  const advance = () => {
    enteredWeek.current = st.week;
    setBriefing(true);
    setIdx((i) => (i === idx ? i + 1 : i));
  };

  // steps that want the clock stopped pin it to 0
  useEffect(() => {
    if (step.pauseOnEnter && game.speed !== 0) game.setSpeed(0);
  });

  // auto-advance once the step's action lands in the state
  useEffect(() => {
    if (step.done && onTab && step.done(st, { speed: game.speed, enteredWeek: enteredWeek.current })) advance();
  });

  // lock the shell while the tutorial is up
  useEffect(() => {
    document.body.classList.add('tut-lock');
    return () => {
      document.body.classList.remove('tut-lock');
      document.querySelectorAll('.tut-allow').forEach((el) => el.classList.remove('tut-allow'));
    };
  }, []);

  // re-enable + highlight the step's targets — or the nav button that leads to them.
  // Re-applied every render: React re-writes className on the nodes it updates.
  useEffect(() => {
    const selectors = onTab ? (step.allow ?? []) : [`nav button[data-tab="${step.tab}"]`];
    document.querySelectorAll('.tut-allow').forEach((el) => el.classList.remove('tut-allow'));
    for (const sel of selectors) document.querySelectorAll(sel).forEach((el) => el.classList.add('tut-allow'));
  });

  const stepNo = `TUTORIAL · STEP ${Math.min(idx + 1, TUTORIAL_STEPS.length)}/${TUTORIAL_STEPS.length}`;
  const task = onTab ? step.task : `Open the ${step.tab.toUpperCase()} tab.`;
  // Next-button steps advance straight from the briefing once already in place;
  // action steps (and off-tab Next steps) collapse to the strip first.
  const readyToAdvance = !step.done && onTab;

  if (briefing) {
    return (
      <div className="overlay on">
        <div className="modal tutorial" role="dialog" aria-modal="true">
          <div className="mh">
            <div className="paused">{stepNo}</div>
            <h2>{step.title}</h2>
          </div>
          <div className="mb">
            <p>{step.body}</p>
            {task && !readyToAdvance && <div className="tuttask">{task}</div>}
            <div className="btnrow">
              {readyToAdvance ? (
                <button className="btn primary" autoFocus onClick={() => (last ? game.quitToMenu() : advance())}>
                  {last ? 'End tutorial' : 'Next'}
                </button>
              ) : (
                <button className="btn primary" autoFocus onClick={() => setBriefing(false)}>
                  Got it — show me
                </button>
              )}
              <button className="btn" onClick={() => game.quitToMenu()}>
                Exit tutorial
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside className="tutstrip" role="complementary" aria-label="tutorial task">
      <span className="stepno">{Math.min(idx + 1, TUTORIAL_STEPS.length)}/{TUTORIAL_STEPS.length}</span>
      <span className="tk">{task ?? step.title}</span>
      {readyToAdvance && (
        <button className="btn sm primary" onClick={() => (last ? game.quitToMenu() : advance())}>
          {last ? 'End tutorial' : 'Next'}
        </button>
      )}
      <button className="tb2" title="Reopen the step briefing" onClick={() => setBriefing(true)}>
        details
      </button>
      <button className="tb2" title="Exit the tutorial" onClick={() => game.quitToMenu()}>
        exit ✕
      </button>
    </aside>
  );
}
