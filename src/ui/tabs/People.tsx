import { fireStar, poachStar } from '../../engine/actions';
import { poachCost, poachOdds, starFieldLabel } from '../../engine/people';
import type { CSuiteRole, Executive, Lab } from '../../engine/types';
import { fmtMoney } from '../format';
import { Icon } from '../icons';
import { useGame, useSt } from '../useGame';

const ROLE_LABEL: Record<CSuiteRole, string> = {
  ceo: 'CEO — you',
  coo: 'COO',
  cto: 'CTO',
  cfo: 'CFO',
  research: 'Head of Research',
  alignment: 'Head of Alignment',
  comms: 'Head of Communications',
};

function execStats(e: Executive): string {
  if (e.hostile) return 'board plant — feeds board discontent weekly, no bonus';
  switch (e.role) {
    case 'ceo':
      return `charisma ${e.charisma} · credibility ${e.credibility}`;
    case 'coo':
      return `burn −${e.opsBonus}%`;
    case 'cto':
      return `training speed +${e.trainingSpeed}% · capability +${e.capabilityBonus}%`;
    case 'cfo':
      return `raise terms +${e.financeBonus}% · burn −${Math.round(e.financeBonus / 2)}%`;
    case 'research':
      return `research speed +${e.researchBonus}% · cost −${Math.round(e.researchBonus / 2.5)}%`;
    case 'alignment':
      return `alignment work +${e.alignmentBonus}%`;
    case 'comms':
      return `public trust decay −${e.commsBonus}%`;
  }
}

export function PeopleTab() {
  const game = useGame();
  const st = useSt();
  const player = st.labs[st.playerLab];
  const roles: CSuiteRole[] = ['ceo', 'coo', 'cto', 'cfo', 'research', 'alignment', 'comms'];
  const rivals = Object.values(st.labs).filter((l) => l.alive && l.id !== st.playerLab);

  return (
    <div className="grid3">
      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-person" />
            C-suite
          </h2>
        </div>
        <div className="bd">
          {roles.map((role) => {
            const e = player.csuite[role];
            return e ? (
              <div className="person" key={role}>
                <div className="role">{ROLE_LABEL[role]}</div>
                <div className="nm">{e.name}</div>
                <div className="stats">
                  {execStats(e)} · {fmtMoney(e.salary * 52)}/yr
                </div>
              </div>
            ) : (
              <div className="person vacant" key={role}>
                <div className="role">{ROLE_LABEL[role]}</div>
                <div className="nm">VACANT</div>
                <div className="stats">no {role} bonus until filled — candidates appear as events</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="col">
        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-star" />
              Star researchers
            </h2>
            <span className="tag" style={{ color: 'var(--faint)' }}>
              {player.stars.length} on staff
            </span>
          </div>
          <div className="bd">
            {player.stars.length > 0 ? (
              <table>
                <tbody>
                  <tr>
                    <th>Name</th>
                    <th>Field</th>
                    <th>Bonus</th>
                    <th className="num">$/yr</th>
                    <th></th>
                  </tr>
                  {player.stars.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.name} <span style={{ color: 'var(--warn-text)' }}>{'★'.repeat(s.tier)}</span>
                      </td>
                      <td style={{ color: 'var(--dim)' }}>{starFieldLabel(s.field)}</td>
                      <td className="mono">+{s.bonus}%</td>
                      <td className="num">{fmtMoney(s.salary * 52)}</td>
                      <td>
                        <button className="btn sm danger" onClick={() => game.act((g) => fireStar(g.labs[g.playerLab], s.id))}>
                          Fire
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="note">No stars on staff. They appear on the market as events — or you take them from rivals.</div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="hd">
            <h2>
              <Icon id="i-grid" />
              Board
            </h2>
            <span className="tag" style={{ color: player.discontent > 45 ? 'var(--warn-text)' : 'var(--faint)' }}>
              discontent {player.discontent.toFixed(0)}
            </span>
          </div>
          <div className="bd">
            <div className="seats">
              {Array.from({ length: 9 }, (_, i) => (
                <i key={i} className={i >= player.boardYours ? 'inv' : ''} />
              ))}
            </div>
            <div className="kv">
              <span className="k">Yours / investors</span>
              <span className="v">
                {player.boardYours} / {player.boardInvestors}
              </span>
            </div>
            <div className="meter">
              <div className="row">
                <span className="k">Discontent</span>
                <span className="v">{player.discontent.toFixed(0)}</span>
              </div>
              <div className="track">
                <div className={`fill ${player.discontent > 60 ? 'bad' : player.discontent > 40 ? 'warn' : 'good'}`} style={{ width: `${player.discontent}%` }} />
              </div>
            </div>
            <div className="note">Discontent × investor seats drives board events: questions → resolutions → seat grabs → no-confidence (≤4 seats) → removal (≤3 seats, discontent 80+). Seats lost in raises never come back.</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-userplus" />
            Poaching targets
          </h2>
        </div>
        <div className="bd">
          {rivals.some((r) => r.stars.length > 0) ? (
            <table>
              <tbody>
                <tr>
                  <th>Name</th>
                  <th>Lab</th>
                  <th>Bonus</th>
                  <th className="num">Odds</th>
                  <th className="num">Fee</th>
                  <th></th>
                </tr>
                {rivals.flatMap((rival: Lab) =>
                  rival.stars.map((s) => {
                    const odds = poachOdds(st, player, s);
                    const cost = poachCost(s);
                    return (
                      <tr key={s.id}>
                        <td>
                          {s.name} <span style={{ color: 'var(--warn-text)' }}>{'★'.repeat(s.tier)}</span>
                        </td>
                        <td style={{ color: 'var(--dim)' }}>{rival.shortName}</td>
                        <td className="mono">
                          +{s.bonus}% {starFieldLabel(s.field)}
                        </td>
                        <td className="num" style={{ color: odds > 0.5 ? 'var(--good)' : 'var(--warn-text)' }}>
                          {(odds * 100).toFixed(0)}%
                        </td>
                        <td className="num">{fmtMoney(cost)}</td>
                        <td>
                          <button className="btn sm" disabled={player.cash < cost} onClick={() => game.act((g) => poachStar(g, g.labs[g.playerLab], rival.id, s.id))}>
                            Poach
                          </button>
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          ) : (
            <div className="note">Nobody worth poaching right now.</div>
          )}
          <div className="note" style={{ marginTop: 10 }}>
            The fee is paid win or lose — headhunters bill either way. Odds scale with your CEO's charisma and your public reputation.
          </div>
        </div>
      </div>
    </div>
  );
}
