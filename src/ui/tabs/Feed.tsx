import { useMemo, useState } from 'react';
import type { FeedItem } from '../../engine/types';
import { fmtDate } from '../format';
import { Icon } from '../icons';
import { useGame, useSt, type TabId } from '../useGame';

type Filter = 'all' | 'warning' | 'info' | 'ticker';

export function FeedTab() {
  const game = useGame();
  const st = useSt();
  const [filter, setFilter] = useState<Filter>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const feed = st.feed.filter((f) => !dismissed.has(f.id)).filter((f) => filter === 'all' || f.kind === filter);

  // group consecutive ticker items by week
  const grouped = useMemo(() => {
    const out: (FeedItem | { ticker: FeedItem[]; week: number; id: string })[] = [];
    for (const item of feed.slice(0, 60)) {
      if (item.kind === 'ticker') {
        const last = out[out.length - 1];
        if (last && 'ticker' in last && last.week === item.week) last.ticker.push(item);
        else out.push({ ticker: [item], week: item.week, id: `tg-${item.id}` });
      } else {
        out.push(item);
      }
    }
    return out;
  }, [feed]);

  const kindIcon = (k: FeedItem['kind']) => (k === 'warning' ? 'i-warn' : 'i-info');

  return (
    <div className="feedtab">
      <div className="panel">
        <div className="hd">
          <h2>
            <Icon id="i-tray" />
            Feed
          </h2>
        </div>
        <div className="bd">
          <div className="feedfilter">
            {(['all', 'warning', 'info', 'ticker'] as Filter[]).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'warning' ? 'Warnings' : f === 'info' ? 'Log' : 'World'}
              </button>
            ))}
          </div>

          {grouped.map((item) =>
            'ticker' in item ? (
              <TickerGroup key={item.id} week={item.week} items={item.ticker} />
            ) : (
              <div
                key={item.id}
                className={`fcard ${item.kind === 'warning' ? 'warning' : 'info'}`}
                onClick={item.goto ? () => game.goTab(item.goto as TabId) : undefined}
                style={item.goto ? undefined : { cursor: 'default' }}
              >
                <button
                  className="x"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDismissed((d) => new Set(d).add(item.id));
                  }}
                >
                  ✕
                </button>
                <div className="when">
                  <Icon id={kindIcon(item.kind)} />
                  WEEK {item.week} · {fmtDate(item.week)}
                </div>
                <div className="what">{item.title}</div>
                <div className="fx">{item.body}</div>
                {item.goto && <span className="go">{item.goto.toUpperCase()} →</span>}
              </div>
            ),
          )}
          {grouped.length === 0 && <div className="note">Empty.</div>}
        </div>
      </div>
    </div>
  );
}

function TickerGroup({ week, items }: { week: number; items: FeedItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`tgroup${open ? ' open' : ''}`}>
      <button onClick={() => setOpen(!open)}>
        <span className="l">
          <Icon id="i-globe" />
          WEEK {week} · {items.length} world item{items.length > 1 ? 's' : ''}
        </span>
        <span className="caret">▾</span>
      </button>
      <div className="items">
        {items.map((i) => (
          <div key={i.id}>
            <span>{i.tag ?? 'WORLD'}</span>
            {i.title} — {i.body}
          </div>
        ))}
      </div>
    </div>
  );
}
