/** Icon sprite lifted from the UI mock. */
const SPRITE = `<defs>
<symbol id="i-tray" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 13.5h5l1.8 3h3.4l1.8-3h5"/></symbol>
<symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 13.5l9 5 9-5"/><path d="M3 17.5l9 5 9-5"/></symbol>
<symbol id="i-archive" viewBox="0 0 24 24"><rect x="3.5" y="4" width="17" height="5" rx="1"/><path d="M5.5 9v11h13V9"/><path d="M10 13h4"/></symbol>
<symbol id="i-flask" viewBox="0 0 24 24"><path d="M9.5 3h5M10.5 3v6L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L13.5 9V3"/><path d="M7.5 15h9"/></symbol>
<symbol id="i-flag" viewBox="0 0 24 24"><path d="M6 21V4"/><path d="M6 5c2-1.4 4.5-1.4 6.5 0s4.5 1.4 5.5.4v8c-1 1-3.5 1-5.5-.4s-4.5-1.4-6.5 0"/></symbol>
<symbol id="i-person" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></symbol>
<symbol id="i-dollar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M15 9c-.7-1.2-4.8-1.6-5 .8-.2 2.2 5.2 1.4 5 3.8-.2 2.2-4.3 2-5.2.6"/><path d="M12 6.5V8M12 16v1.5"/></symbol>
<symbol id="i-radar" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l5.5-6.5"/></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c-3.2 2.7-3.2 14.3 0 17M12 3.5c3.2 2.7 3.2 14.3 0 17"/></symbol>
<symbol id="i-chipset" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><rect x="10.2" y="10.2" width="3.6" height="3.6"/><path d="M9 6.5v-3M15 6.5v-3M9 20.5v-3M15 20.5v-3M6.5 9h-3M6.5 15h-3M20.5 9h-3M20.5 15h-3"/></symbol>
<symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.7-3.2 8-7.5 9.5-4.3-1.5-7.5-4.8-7.5-9.5V6z"/></symbol>
<symbol id="i-landmark" viewBox="0 0 24 24"><path d="M4 21h16M5.5 18h13M7.5 18v-6.5M12 18v-6.5M16.5 18v-6.5M4 11.5h16L12 4z"/></symbol>
<symbol id="i-people" viewBox="0 0 24 24"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 20c0-3 2.3-5 5.5-5s5.5 2 5.5 5"/><circle cx="16.5" cy="9.5" r="2.3"/><path d="M16.5 15c2.5.3 4 2 4 4.5"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/></symbol>
<symbol id="i-lockopen" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="1.5"/><path d="M8 11V7.5a4 4 0 0 1 7.4-2.1"/><path d="M12 14.5V17"/></symbol>
<symbol id="i-gauge" viewBox="0 0 24 24"><path d="M4.5 16.5a7.5 7.5 0 1 1 15 0"/><path d="M12 16.5L15.8 11"/><path d="M4 20h16"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2z"/><path d="M12 8v5"/><path d="M12 16.4v.2"/></symbol>
<symbol id="i-warn" viewBox="0 0 24 24"><path d="M12 4L22 20H2z"/><path d="M12 10.5v4"/><path d="M12 17.2v.2"/></symbol>
<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8V8"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M3.5 20.5h17"/><path d="M4 16.5l5-4 4 2 7-8.5"/><path d="M15.5 6H20v4.5"/></symbol>
<symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="9" cy="7" r="1.9" fill="currentColor"/><circle cx="15" cy="12" r="1.9" fill="currentColor"/><circle cx="7" cy="17" r="1.9" fill="currentColor"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 3.5c.8 3.8-4.5 5.7-4.5 10a4.5 4.5 0 0 0 9 0c0-1.9-.8-3.3-1.8-4.4-.1 1.3-.7 2-1.5 2.4C13.8 9.3 13.6 6 12 3.5z"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M14.5 3.5V8H19"/><path d="M9 12h6M9 15.5h6"/></symbol>
<symbol id="i-package" viewBox="0 0 24 24"><path d="M12 3l8 4.2v9.6L12 21l-8-4.2V7.2z"/><path d="M4 7.2l8 4.2 8-4.2"/><path d="M12 11.4V21"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/></symbol>
<symbol id="i-userplus" viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.2"/><path d="M4 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M17.5 7.5h5M20 5v5"/></symbol>
<symbol id="i-zap" viewBox="0 0 24 24"><path d="M13 3L5.5 13.5H11L9.5 21 17 10.5h-5.5z"/></symbol>
<symbol id="i-tag" viewBox="0 0 24 24"><path d="M3.5 10.5v-7h7L21 14l-7 7z"/><circle cx="7.5" cy="7.5" r="1.3"/></symbol>
</defs>`;

export function IconDefs() {
  return <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: SPRITE }} />;
}

export function Icon({ id, className = 'ic' }: { id: string; className?: string }) {
  return (
    <svg className={className}>
      <use href={`#${id}`} />
    </svg>
  );
}
