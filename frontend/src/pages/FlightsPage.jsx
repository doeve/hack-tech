import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { getFlights, getMyFlights } from '../api/client'
import BottomNav from '../components/BottomNav'

const STATUS_COLORS = {
  boarding: 'bg-[#1e3a8a]/20 text-[#1e3a8a]',
  'final call': 'bg-orange-500/20 text-orange-400',
  delayed: 'bg-red-500/20 text-red-400',
  on_time: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  landed: 'bg-slate-500/20 text-slate-500',
  arrived: 'bg-green-500/20 text-green-400',
  departed: 'bg-cyan-500/20 text-cyan-400',
}

const AIRLINE_COLORS = {
  UA: '#2563eb', AA: '#dc2626', DL: '#7c3aed', B6: '#0891b2',
  SG: '#3b82f6', EK: '#f59e0b', BA: '#1e40af', LH: '#eab308',
  AF: '#6366f1', JL: '#ef4444', default: '#3b82f6',
}

function getAirlineColor(flightNum) {
  const prefix = flightNum?.replace(/[0-9\s]/g, '').trim()
  return AIRLINE_COLORS[prefix] || AIRLINE_COLORS.default
}

export default function FlightsPage() {
  const navigate = useNavigate()
  const { accessToken } = useStore()
  const [activeTab, setActiveTab] = useState('my')
  const [direction, setDirection] = useState('departure')
  const [searchQuery, setSearchQuery] = useState('')
  const [apiFlights, setApiFlights] = useState([])
  const [myFlights, setMyFlights] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [allRes, myRes] = await Promise.all([
          getFlights({ direction }),
          getMyFlights(),
        ])
        if (!cancelled) {
          setApiFlights(allRes.data || [])
          setMyFlights(myRes.data || [])
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setApiFlights([])
          setMyFlights([])
          setLoading(false)
        }
      }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [direction, accessToken])

  const allFlights = apiFlights

  const displayFlights = activeTab === 'my' ? myFlights : allFlights

  const filtered = displayFlights.filter((f) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      f.flight_number?.toLowerCase().includes(q) ||
      f.origin_code?.toLowerCase().includes(q) ||
      f.destination_code?.toLowerCase().includes(q) ||
      f.origin_city?.toLowerCase().includes(q) ||
      f.destination_city?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button className="text-slate-500 hover:text-slate-900 p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-900 tracking-wide">SkyGuide</h1>
        <button className="relative text-slate-500 hover:text-slate-900 p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
        </button>
      </div>

      {/* Search */}
      <div className="px-5 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flight or city"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200
                       rounded-xl text-sm text-slate-900 placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/30 focus:border-[#1e3a8a]/50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 px-5 mb-4">
        <button
          onClick={() => setActiveTab('my')}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            activeTab === 'my'
              ? 'text-slate-900 border-transparent'
              : 'text-slate-500 border-transparent hover:text-slate-500'
          }`}
        >
          My Flights
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'text-[#1e3a8a] border-[#1e3a8a]'
              : 'text-slate-500 border-transparent hover:text-slate-500'
          }`}
        >
          All Flights
        </button>
      </div>

      {/* Direction Toggle */}
      <div className="flex mx-5 mb-5 bg-white rounded-xl p-1">
        <button
          onClick={() => setDirection('departure')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            direction === 'departure'
              ? 'bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-500 hover:text-slate-500'
          }`}
        >
          Departures
        </button>
        <button
          onClick={() => setDirection('arrival')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            direction === 'arrival'
              ? 'bg-[#1e3a8a] text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-500 hover:text-slate-500'
          }`}
        >
          Arrivals
        </button>
      </div>

      {/* Flight List */}
      <div className="flex-1 px-5 space-y-3 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-[#1e3a8a] border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-sm">No flights found</p>
          </div>
        ) : (
          filtered.map((flight) => (
            <FlightCard
              key={flight.id || flight.flight_number}
              flight={flight}
              showAddButton={activeTab === 'all'}
              onAdd={() => navigate('/identity', { state: { openScanner: true } })}
            />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function formatTime(dt) {
  if (!dt) return '--:--'
  const d = new Date(dt)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function FlightCard({ flight, showAddButton, onAdd }) {
  const statusKey = flight.status?.toLowerCase() || 'scheduled'
  const statusColor = STATUS_COLORS[statusKey] || STATUS_COLORS.scheduled
  const airlineColor = getAirlineColor(flight.flight_number)
  const isDelayed = statusKey === 'delayed'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 hover:bg-white transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{ color: airlineColor }}>
          {flight.flight_number}
        </span>
        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${statusColor}`}>
          {flight.status?.replace(/_/g, ' ') || 'Scheduled'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-slate-900 text-lg font-bold">{flight.origin_code || '--'}</span>
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="text-slate-900 text-lg font-bold">{flight.destination_code || '--'}</span>
        </div>
        <span className="text-slate-500 text-xs">Gate {flight.gate || '--'}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-500">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isDelayed && flight.estimated_at ? (
            <span className="text-xs">
              <span className="line-through text-slate-600 mr-1">{formatTime(flight.scheduled_at)}</span>
              <span className="text-red-400">{formatTime(flight.estimated_at)}</span>
            </span>
          ) : (
            <span className="text-xs">{formatTime(flight.scheduled_at)}</span>
          )}
        </div>
        {showAddButton ? (
          <button onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/20 border border-[#1e3a8a]/30 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5 text-[#1e3a8a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-xs font-medium text-[#1e3a8a]">Scan QR</span>
          </button>
        ) : (
          <span className="text-slate-500 text-xs">Terminal {flight.terminal || '--'}</span>
        )}
      </div>
    </div>
  )
}


