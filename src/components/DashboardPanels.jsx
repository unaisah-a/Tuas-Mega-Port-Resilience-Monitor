import React from 'react'

export function BerthOccupancyPanel({ snapshot }) {
  const terminals = snapshot?.terminalOccupancy || []
  const values = terminals.length ? terminals.map(item => ({ id: item.terminalId, value: item.occupancyPercent })) : [
    { id: 'T1', value: 70 }, { id: 'T2', value: 75 }, { id: 'T3', value: 65 },
    { id: 'T4', value: 88 }, { id: 'T5', value: 73 }, { id: 'T6', value: 52 }
  ]

  return (
    <section className="dashboard-card min-w-0">
      <h3 className="dashboard-card-title">Berth Occupancy at Tuas <span className="font-normal text-slate-500">(Zoomed)</span></h3>
      <div className="flex h-[102px] mt-2">
        <div className="flex flex-col justify-between text-[10px] text-slate-500 pr-2 pb-5"><span>100%</span><span>50%</span><span>0%</span></div>
        <div className="relative flex-1 border-l border-b border-slate-200 flex items-end justify-around px-2 pb-5">
          <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-slate-200" />
          {values.map(item => (
            <div key={item.id} className="relative h-full flex-1 mx-1 flex items-end justify-center">
              <div className="w-[62%] max-w-8 rounded-t-sm bg-[#092a70] transition-all duration-500" style={{ height: `${item.value}%` }} title={`${item.id}: ${item.value}%`} />
              <span className="absolute -bottom-5 text-[10px] text-slate-600">{item.id}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ShipmentRiskPanel({ snapshot }) {
  const shipments = snapshot?.shipments || []
  const high = 2
  const medium = 3
  const low = 6
  const pharma = 2

  const items = [
    { label: 'High Risk', count: high, dot: 'bg-red-500' },
    { label: 'Medium Risk', count: medium, dot: 'bg-amber-500' },
    { label: 'Low Risk', count: low, dot: 'bg-green-500' },
    { label: 'Cold-chain Pharma', count: pharma, dot: 'bg-blue-500', snow: true }
  ]

  return (
    <section className="dashboard-card min-w-0">
      <h3 className="dashboard-card-title">Shipment Risk Board <span className="font-normal text-slate-500">({shipments.length || 12} Shipments)</span></h3>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {items.map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between bg-white">
            <span className="flex items-center gap-2 text-[11px] text-slate-700 min-w-0">
              {item.snow ? <span className="text-blue-600 text-lg leading-none">❄</span> : <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${item.dot}`} />}
              <span className="truncate">{item.label}</span>
            </span>
            <strong className="text-[18px] text-[#092a70]">{item.count}</strong>
          </div>
        ))}
      </div>
    </section>
  )
}

export function RouteRiskPanel({ snapshot, stormActive }) {
  const routes = snapshot?.routes || []
  const items = [
    { name: 'Malacca Strait', risk: stormActive ? 'Severe Risk' : 'High Risk', color: stormActive ? 'text-red-700' : 'text-red-500', delay: stormActive ? '+6.2 hrs' : '+3.6 hrs' },
    { name: 'Sunda Strait', risk: 'Medium Risk', color: 'text-amber-600', delay: '+1.2 hrs' },
    { name: 'Lombok Strait', risk: 'Low Risk', color: 'text-green-600', delay: '+3.5 hrs' }
  ]

  return (
    <section className="dashboard-card min-w-0">
      <h3 className="dashboard-card-title">Route Risk Summary</h3>
      <div className="space-y-3 mt-4">
        {items.map(item => (
          <div key={item.name} className="grid grid-cols-[1.3fr_1fr_.9fr] gap-2 items-center text-[11px]">
            <span className="font-semibold text-slate-700">{item.name}</span>
            <span className={`font-semibold ${item.color}`}>{item.risk}</span>
            <span className="text-slate-600"><span className="block text-[9px]">Delay</span>{item.delay}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function NewsTicker({ snapshot }) {
  const headlines = (snapshot?.newsTicker?.length ? snapshot.newsTicker : [
    'SIMULATED DATA — World shipping risk monitor active.',
    'Strait of Hormuz, Red Sea, and Malacca remain the primary watch points.'
  ]).join(' • ')

  return (
    <div className="h-[46px] shrink-0 bg-[#061327] text-white flex items-center overflow-hidden border-t border-white/10">
      <div className="h-full px-8 flex items-center text-[17px] font-extrabold whitespace-nowrap border-r border-white/40">WORLD SHIPPING NEWS</div>
      <div className="relative flex-1 overflow-hidden h-full flex items-center">
        <div className="ticker-light whitespace-nowrap text-[15px] font-semibold px-8">{headlines} <span className="mx-10">•</span> {headlines}</div>
      </div>
    </div>
  )
}
