/**
 * One SVG glyph per research node, keyed by node id. Pure presentation — no
 * engine imports. Each value is the inner markup of a 0 0 24 24 viewBox,
 * stroked with currentColor (see the .ric rule in styles.css).
 */
const ICONS: Record<string, string> = {
  // ---- capabilities
  chinchilla: '<circle cx="8" cy="15" r="3"/><circle cx="16" cy="10" r="5"/>',
  'synthetic-data': '<path d="M6 9a6 6 0 0 1 11-2"/><path d="M18 15a6 6 0 0 1-11 2"/><path d="M17 3v4h-4"/><path d="M7 21v-4h4"/>',
  'chain-of-thought': '<path d="M4 11a7 5 0 1 1 12 3.5L16 20l-4-2.2A7 5 0 0 1 4 11z"/><circle cx="8" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="11" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="14" cy="11" r=".7" fill="currentColor" stroke="none"/>',
  'instruction-tuning': '<path d="M5 5h10M5 10h10M5 15h6"/><path d="M14 16l2 2 4-5"/>',
  'kernel-opt': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  moe: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v3M12 10l-7 7M12 10v7M12 10l7 7"/>',
  'test-time-compute': '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l4 2"/>',
  'long-horizon-agents': '<path d="M3 18h5l3-7 3 7h2"/><path d="M17 12V4l4 2-4 2"/>',
  ida: '<path d="M12 4a8 8 0 1 1-7.5 5.3"/><path d="M12 9a3 3 0 1 0 3 3"/><path d="M4 4v4h4"/>',
  'rl-environments': '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  'automated-researcher': '<rect x="5" y="7" width="14" height="11" rx="2"/><circle cx="9.5" cy="12.5" r="1.4"/><circle cx="14.5" cy="12.5" r="1.4"/><path d="M12 4v3M8 18v2M16 18v2"/>',
  neuralese: '<circle cx="12" cy="12" r="8"/><path d="M8 8.5c2.5 2 5.5 2 8 0M8 15.5c2.5-2 5.5-2 8 0M12 4v16"/>',
  'data-efficient': '<path d="M12 4c4.5 5 6.5 7.3 6.5 10.3a6.5 6.5 0 0 1-13 0C5.5 11.3 7.5 9 12 4z"/><path d="M12 10v6"/>',
  rsi: '<path d="M7.5 17.5a5 5 0 0 1 0-11h6"/><path d="M16.5 6.5a5 5 0 0 1 0 11h-6"/><path d="M13 3.5l3 3-3 3M11 20.5l-3-3 3-3"/>',
  'arch-redesign': '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 9h16M9 9v11"/><path d="M13.5 12.5l4 4M17.5 12.5l-4 4"/>',
  'intelligence-explosion': '<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4"/><circle cx="12" cy="12" r="2.2"/>',

  // ---- alignment
  constitutional: '<path d="M6 4h9l3 3v13H6z"/><path d="M15 4v3h3"/><path d="M9 10h6M9 13h6M9 16h4"/>',
  honesty: '<path d="M12 20S4 14 4 8.8A3.8 3.8 0 0 1 12 6a3.8 3.8 0 0 1 8 2.8C20 14 12 20 12 20z"/>',
  'evals-redteam': '<circle cx="10" cy="10" r="5.5"/><path d="M14 14l6 6"/>',
  'chain-of-thought-monitoring': '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  'interpretability-probes': '<path d="M3 12h4l2-6 3 12 2.5-8 1.5 2h5"/>',
  deliberative: '<path d="M12 4v16M6 20h12"/><path d="M6 8h12"/><path d="M6 8l-2.5 5a2.5 2.5 0 0 0 5 0z"/><path d="M18 8l-2.5 5a2.5 2.5 0 0 0 5 0z"/>',
  'scalable-oversight': '<path d="M12 4l8 15H4z"/><path d="M8.2 18l3.8-7 3.8 7"/>',
  'mech-interp': '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="19" r="2"/><path d="M8 6h8M7.2 8l4 9M16.8 8l-4 9"/>',
  'model-organisms': '<circle cx="12" cy="12" r="8"/><circle cx="10" cy="10" r="1.4"/><circle cx="15" cy="13" r="1.1"/><circle cx="9.5" cy="15" r="1"/>',
  debate: '<path d="M3 6h8v6H6l-3 3z"/><path d="M21 9h-6v5.5L11.5 11"/>',
  'weak-to-strong': '<path d="M5 16l2.5-3 2.5 3"/><path d="M7.5 13v7"/><path d="M14 8l3.5-4 3.5 4"/><path d="M17.5 4v16"/>',
  'glass-box': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  'ai-control': '<rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>',
  corrigibility: '<path d="M12 3v8"/><path d="M6.5 6.5a8 8 0 1 0 11 0"/>',
  'value-learning': '<circle cx="12" cy="12" r="8"/><path d="M12 12l5-5-2.5 7.5L7 17l2.5-7.5z"/>',
  'provable-alignment': '<circle cx="12" cy="12" r="8"/><path d="M8 12l3 3 5-6"/>',

  // ---- bio
  'protein-structure': '<path d="M8 4c8 3-8 5 0 8s-8 5 0 8"/><path d="M16 4c-8 3 8 5 0 8s8 5 0 8"/>',
  'genomic-model': '<path d="M8 4c0 4 8 4 8 8s-8 4-8 8"/><path d="M16 4c0 4-8 4-8 8s8 4 8 8"/><path d="M9.5 8h5M9.5 16h5"/>',
  'molecular-property': '<circle cx="6" cy="12" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="14" cy="17" r="2"/><path d="M8 12l8-4M8 13l5 3.5"/>',
  'programmable-proteins': '<circle cx="9" cy="9" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="16" r="2"/><path d="M11 9.5l4 2M15 13.5l-4 1.6M9.5 11v3"/>',
  'drug-discovery': '<rect x="4" y="9" width="16" height="6" rx="3" transform="rotate(-32 12 12)"/><path d="M8.3 8.2l6.4 8.4"/>',
  'self-driving-labs': '<path d="M5 20h7M8 20v-6l6-4"/><rect x="12" y="4" width="5" height="5" rx="1"/><circle cx="8" cy="14" r="1.6"/>',
  'universal-vaccines': '<path d="M4 20l5-5"/><path d="M8 11l5 5M11 8l5 5-2.5 2.5-5-5z"/><path d="M15 4l5 5M14.5 6.5l3 3"/>',
  'gene-therapy': '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
  'whole-cell-sim': '<rect x="3" y="4" width="18" height="13" rx="1"/><circle cx="12" cy="10.5" r="3.5"/><circle cx="12" cy="10.5" r="1"/><path d="M9 20h6M12 17v3"/>',
  longevity: '<path d="M4 12a4 4 0 0 1 8 0 4 4 0 1 0 8 0 4 4 0 0 1-8 0 4 4 0 1 0-8 0z"/>',
  'de-novo-bio': '<path d="M8 4c0 4 8 4 8 8s-8 4-8 8M16 4c0 4-8 4-8 8s8 4 8 8"/><path d="M18.5 3l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',

  // ---- compute
  'custom-silicon': '<rect x="7" y="7" width="10" height="10" rx="1"/><rect x="10" y="10" width="4" height="4"/><path d="M10 7V4M14 7V4M10 20v-3M14 20v-3M7 10H4M7 14H4M20 10h-3M20 14h-3"/>',
  'grid-power': '<path d="M13 3L5 13h5l-1 8 8-11h-5z"/>',
  'dark-factories': '<path d="M4 20V11l5 3V11l5 3V6l6 4v10z"/><path d="M8 20v-3M13 20v-3"/>',
  'advanced-packaging': '<rect x="5" y="6" width="14" height="4" rx="1"/><rect x="5" y="12" width="14" height="4" rx="1"/><path d="M9 6V4M15 6V4M9 18v-2M15 18v-2"/>',
  'on-chip-attestation': '<rect x="6" y="6" width="12" height="12" rx="1"/><rect x="10" y="11.5" width="4" height="3.5"/><path d="M10.5 11.5v-1a1.5 1.5 0 0 1 3 0v1"/><path d="M9 6V4M15 6V4M9 20v-2M15 20v-2"/>',
  smr: '<circle cx="12" cy="12" r="1.8"/><ellipse cx="12" cy="12" rx="8" ry="3"/><ellipse cx="12" cy="12" rx="8" ry="3" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="8" ry="3" transform="rotate(120 12 12)"/>',
  'self-replicating-factories': '<path d="M3 20v-6l4 2v-2l4 2v-2"/><path d="M14 20V9l6 4v7z"/><path d="M17 20v-3"/>',
  photonic: '<path d="M4 18L11 5l3.5 8z"/><path d="M14.5 13h6M14.5 16l5 2M14.5 10l5-2"/>',
  'hardware-governance': '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 12l2 2 4-4"/><path d="M9 6V4M15 6V4M9 20v-2M15 20v-2"/>',
  fusion: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 7l1.5 3.2 3.5.5-2.6 2.4.6 3.4-3-1.7-3 1.7.6-3.4L8 10.7l3.5-.5z"/>',
  apm: '<circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="20" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="19" cy="8" r="1.5"/><circle cx="5" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/><path d="M12 5.5v5M12 13.5v5M6.3 8.9l4.4 2.2M17.7 8.9l-4.4 2.2M6.3 15.1l4.4-2.2M17.7 15.1l-4.4-2.2"/>',

  // ---- warfare
  'drone-swarms': '<circle cx="12" cy="12" r="2"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M6.5 6.5l4 4M17.5 6.5l-4 4M6.5 17.5l4-4M17.5 17.5l-4-4"/>',
  'sensor-fusion': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-5"/>',
  'electronic-warfare': '<circle cx="12" cy="12" r="1.5"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  hypersonic: '<path d="M20 4c-6 .5-10 3-13 9l4 4c6-3 8.5-7 9-13z"/><path d="M11 17l-4-4-3 6z"/><circle cx="15" cy="9" r="1.3"/>',
  'transparent-oceans': '<path d="M4 13a4 4 0 0 1 8 0h4a2 2 0 0 1 0 4H8a4 4 0 0 1-4-4z"/><path d="M10 9v4"/><path d="M3 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  'battle-network': '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="4" r="1.6"/><circle cx="4" cy="18" r="1.6"/><circle cx="20" cy="18" r="1.6"/><path d="M12 6v4M11 13.2l-6 3.4M13 13.2l6 3.4"/>',
  'missile-defense': '<path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z"/><path d="M12 16V9M9.5 11.5L12 9l2.5 2.5"/>',
  'autonomous-c2': '<rect x="7" y="4" width="10" height="8" rx="2"/><circle cx="10" cy="8" r="1"/><circle cx="14" cy="8" r="1"/><path d="M12 12v3M8 15h8M8 20v-5M16 20v-5M12 20v-5"/>',
  'deterrence-collapse': '<path d="M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6z"/><path d="M13 4l-2.5 7 3.5 1.5-3 6.5"/>',
  'strategic-monopoly': '<path d="M3 8l3.5 9h11L21 8l-4.5 3.5L12 4 7.5 11.5z"/><path d="M6.5 20h11"/>',
  'first-strike': '<path d="M6 9a6 3 0 0 1 12 0c0 2-2.2 2-3.2 3H9.2C8.2 11 6 11 6 9z"/><path d="M10 12v8M14 12v8M9 20h6"/>',

  // ---- diplomacy treaties
  'transparency-pledge': '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M5.6 18.4l1.8-1.8"/>',
  'incident-reporting': '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9.5 4h5v2h-5z"/><path d="M12 9v4M12 16v.2"/>',
  'responsible-scaling': '<path d="M5 17a7 7 0 1 1 14 0"/><path d="M12 17l4.5-4.5"/><path d="M4 20h16"/>',
  'joint-safety-institute': '<path d="M4 20h16M4 10l8-6 8 6M6 10v10M18 10v10M10 20v-6h4v6"/>',
  'crisis-hotline': '<path d="M6 4h3.5l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
  'frontier-registry': '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  'hardware-verified-compute': '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9.5 12l2 2 3.5-4"/><path d="M9 6V4M15 6V4M9 20v-2M15 20v-2M6 9.5H4M6 14.5H4M20 9.5h-2M20 14.5h-2"/>',
  'mutual-inspection': '<circle cx="8.5" cy="8.5" r="3.5"/><path d="M11 11l2.5 2.5"/><circle cx="15.5" cy="15.5" r="3.5"/><path d="M13 13l-2.4-2.4"/>',
  'compute-cap-treaty': '<path d="M4 6.5h16"/><rect x="8" y="11" width="8" height="8" rx="1"/><path d="M10 11V9M14 11V9M8 15h8"/>',
  'global-pause': '<circle cx="12" cy="12" r="8"/><path d="M10 8.5v7M14 8.5v7"/>',
};

const FALLBACK = '<circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16v.2"/>';

export function ResearchIcon({ id, className = 'ric' }: { id: string; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[id] ?? FALLBACK }} />;
}
