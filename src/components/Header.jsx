import React from 'react'

function IconButton({ label, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="h-9 w-9 rounded-full border border-white/10 text-white/90 hover:bg-white/10 transition flex items-center justify-center"
    >
      {children}
    </button>
  )
}

export default function Header({ lastUpdated, mode = 'MOCK' }) {
  const date = lastUpdated ? new Date(lastUpdated) : new Date()
  const updated = date.toLocaleString('en-SG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    day: '2-digit', month: 'short', year: 'numeric'
  })

  return (
    <header className="h-[58px] shrink-0 bg-[#031329] text-white px-5 flex items-center justify-between border-b border-white/10 shadow-sm z-50">
      <div className="flex items-center gap-5 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M4 9h24M16 4v22M8 13l8-9 8 9M7 26h18" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[22px] font-extrabold tracking-wide">TMPRM</span>
        </div>
        <div className="h-6 w-px bg-white/20 hidden sm:block" />
        <h1 className="font-semibold text-[17px] tracking-tight truncate">Tuas Mega Port Resilience Monitor</h1>
      </div>

      <div className="flex items-center gap-2.5 ml-4">
        <span className="hidden sm:inline-flex items-center h-8 px-3 rounded-md bg-blue-500/15 text-sky-300 text-xs font-bold tracking-wide border border-blue-400/10">
          {mode} MODE
        </span>
        <span className="hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-md border border-white/20 text-xs text-white/85">
          All data is simulated
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
        </span>
        <div className="hidden xl:flex items-center gap-2 text-xs text-white/85 ml-3 pr-3 border-r border-white/20 whitespace-nowrap">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span>Last updated: {updated}</span>
        </div>
        <IconButton label="Notifications">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
        </IconButton>
        <IconButton label="User profile">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>
        </IconButton>
      </div>
    </header>
  )
}
