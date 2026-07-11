import { BAL } from './balance';
import type { FeedKind, GameState } from './types';

export function pushFeed(state: GameState, kind: FeedKind, title: string, body: string, opts?: { goto?: string; tag?: string; notice?: boolean }): void {
  state.feed.unshift({
    id: `f${state.feedCounter++}`,
    week: state.week,
    kind,
    title,
    body,
    goto: opts?.goto,
    tag: opts?.tag,
    notice: opts?.notice,
  });
  if (state.feed.length > BAL.FEED_MAX) state.feed.length = BAL.FEED_MAX;
}
