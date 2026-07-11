import type { LabId } from '../engine/types';

/** Start-screen flavor per lab. Doctrine is derived from the LAB_SEEDS profile
    numbers; the tag flags the recommended start and the export-controlled runs. */
export const LAB_FLAVOR: Record<LabId, { doctrine: string; tag?: { text: string; tone: 'good' | 'warn' } }> = {
  helios: {
    doctrine: 'The balanced incumbent. Solid compute, a real safety bench, and enough credibility to play it either way.',
    tag: { text: 'recommended', tone: 'good' },
  },
  axiom: {
    doctrine: 'Scale first, ask later. The deepest chip reserve in the race and the thinnest safety margin.',
  },
  tianshu: {
    doctrine: 'State-backed ascent. Beijing listens when you talk, but export controls choke your silicon.',
    tag: { text: 'hard', tone: 'warn' },
  },
  qingfeng: {
    doctrine: 'Sells everything it trains. Lean, commercial, and starting from a long way behind the frontier.',
    tag: { text: 'hard', tone: 'warn' },
  },
};

/** Geometric logo marks, one per lab, drawn in the lab's engine identity color.
    helios: sun over a runway horizon · axiom: nested delta · tianshu: the Big
    Dipper with its pivot star (天枢) flared · qingfeng: clear wind. */
export function LabMark({ id, color }: { id: LabId; color: string }) {
  const common = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'square' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'helios':
      return (
        <svg {...common}>
          <path d="M11.5 30a12.5 12.5 0 0 1 25 0" fill={color} stroke="none" />
          <path d="M4 30h40" />
          <path d="M24 8.5v5M10.6 14.1l3.5 3.5M37.4 14.1l-3.5 3.5" />
          <path d="M9 36.5h30M15 42h18" />
        </svg>
      );
    case 'axiom':
      return (
        <svg {...common}>
          <path d="M24 5 43 41H5Z" />
          <path d="M24 18 33.5 36h-19Z" fill={color} stroke="none" />
        </svg>
      );
    case 'tianshu':
      return (
        <svg {...common} strokeWidth={1.5}>
          <path d="M6 13 14 17.5 20 21.5 26 25.5 37 22.5 42 34 29 36.5 26 25.5" />
          <circle cx="6" cy="13" r="1.8" fill={color} stroke="none" />
          <circle cx="14" cy="17.5" r="1.8" fill={color} stroke="none" />
          <circle cx="20" cy="21.5" r="1.8" fill={color} stroke="none" />
          <circle cx="26" cy="25.5" r="1.8" fill={color} stroke="none" />
          <circle cx="42" cy="34" r="1.8" fill={color} stroke="none" />
          <circle cx="29" cy="36.5" r="1.8" fill={color} stroke="none" />
          <circle cx="37" cy="22.5" r="5" />
          <circle cx="37" cy="22.5" r="2" fill={color} stroke="none" />
        </svg>
      );
    case 'qingfeng':
      return (
        <svg {...common}>
          <path d="M5 15h21a4.5 4.5 0 1 0-4.5-4.5" />
          <path d="M5 24h32a4.5 4.5 0 1 1-4.5 4.5" />
          <path d="M5 33h17a4 4 0 1 1-4 4" />
        </svg>
      );
  }
}
