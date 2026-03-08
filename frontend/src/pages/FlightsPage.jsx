import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { useStore } from '../store'
import { getFlights, getMyFlights, subscribeFlight } from '../api/client'
import BottomNav from '../components/BottomNav'

const STATUS_COLORS = {
  boarding: 'bg-blue-500/20 text-blue-400',
  gate_closed: 'bg-orange-500/20 text-orange-400',
  delayed: 'bg-red-500/20 text-red-400',
  on_time: 'bg-green-500/20 text-green-400',
  scheduled: 'bg-green-500/20 text-green-400',
  cancelled: 'bg-red-500/20 text-red-400',
  landed: 'bg-slate-500/20 text-slate-400',
  gate_closed: 'bg-orange-500/20 text-orange-400',
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
  const [showScanner, setShowScanner] = useState(false)
  const [scanResult, setScanResult] = useState(null)

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

  const handleScanSuccess = async (flightData) => {
    try {
      await subscribeFlight(flightData.flight_id)
      const { data } = await getMyFlights()
      setMyFlights(data || [])
      setScanResult({ ok: true, flight: flightData.flight_number || flightData.flight_id })
    } catch (err) {
      console.error('subscribeFlight failed:', err)
      setScanResult({ ok: false, message: 'Failed to add flight' })
    }
    setShowScanner(false)
  }

  const allFlights = apiFlights

  const filteredMyFlights = myFlights.filter((f) => !f.direction || f.direction === direction)
  const displayFlights = activeTab === 'my' ? filteredMyFlights : allFlights

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
    <div className="min-h-full bg-[#0b1120] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button className="text-slate-400 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">SkyGuide</h1>
        <button className="relative text-slate-400 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#0b1120]" />
        </button>
      </div>

      {/* Search + Scan */}
      <div className="px-5 mb-4">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
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
              className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-slate-700/50
                         rounded-xl text-sm text-white placeholder-slate-500
                         focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50"
            />
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="flex-shrink-0 w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center hover:bg-blue-600/30 transition-colors"
          >
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scan Result Toast */}
      {scanResult && (
        <div className={`mx-5 mb-3 px-4 py-3 rounded-xl text-sm flex items-center justify-between ${
          scanResult.ok
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          <span>{scanResult.ok ? `Added ${scanResult.flight} to My Flights` : scanResult.message}</span>
          <button onClick={() => setScanResult(null)} className="hover:text-white ml-2">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-6 px-5 mb-4">
        <button
          onClick={() => setActiveTab('my')}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            activeTab === 'my'
              ? 'text-white border-transparent'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          My Flights
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
            activeTab === 'all'
              ? 'text-blue-400 border-blue-400'
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          All Flights
        </button>
      </div>

      {/* Direction Toggle */}
      <div className="flex mx-5 mb-5 bg-slate-800/40 rounded-xl p-1">
        <button
          onClick={() => setDirection('departure')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            direction === 'departure'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Departures
        </button>
        <button
          onClick={() => setDirection('arrival')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            direction === 'arrival'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Arrivals
        </button>
      </div>

      {/* Flight List */}
      <div className="flex-1 px-5 space-y-3 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
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
              onAdd={() => setShowScanner(true)}
            />
          ))
        )}
      </div>

      {showScanner && (
        <TicketScannerModal
          onScan={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      <BottomNav />
    </div>
  )
}

// Process decoded QR text for ticket data
function parseTicketQR(text) {
  try {
    const data = JSON.parse(text)
    if (data.type === 'skyguide_ticket' && data.flight_id) return data
  } catch { /* not JSON */ }
  const trimmed = text.trim()
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return { flight_id: trimmed, flight_number: trimmed, type: 'skyguide_ticket' }
  }
  return null
}

function TicketScannerModal({ onScan, onClose }) {
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const [error, setError] = useState(null)
  const [scanStatus, setScanStatus] = useState(null)
  const [pastedImg, setPastedImg] = useState(null)
  const containerRef = useRef(null)
  const scannerRef = useRef(null)

  // Clipboard paste: decode QR from pasted image
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          const url = URL.createObjectURL(file)
          setPastedImg(url)
          setScanStatus('Image pasted, decoding...')

          // Brief preview delay then decode
          await new Promise((r) => setTimeout(r, 300))

          try {
            // Decode QR from pasted image using a temporary scanner
            const tempId = 'paste-qr-' + Date.now()
            const div = document.createElement('div')
            div.id = tempId
            div.style.display = 'none'
            document.body.appendChild(div)
            const tempScanner = new Html5Qrcode(tempId)
            const text = await tempScanner.scanFileV2(file, false)
            document.body.removeChild(div)

            const ticket = parseTicketQR(text.decodedText)
            if (ticket) {
              try { scannerRef.current?.stop() } catch {}
              onScanRef.current(ticket)
              return
            }
            setScanStatus('QR found but not a valid boarding pass')
            setTimeout(() => { setScanStatus(null); setPastedImg(null) }, 2000)
          } catch {
            setScanStatus('No QR code found in image')
            setTimeout(() => { setScanStatus(null); setPastedImg(null) }, 2000)
          }
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [])

  // Camera scanner
  useEffect(() => {
    let active = true
    const container = containerRef.current
    if (!container) return

    const id = 'tqr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
    container.id = id
    container.innerHTML = ''

    const timeout = setTimeout(() => {
      if (!active) return
      const scanner = new Html5Qrcode(id)
      scannerRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text) => {
          if (!active) return
          const ticket = parseTicketQR(text)
          if (ticket) {
            active = false
            try { scanner.stop() } catch {}
            onScanRef.current(ticket)
            return
          }
          setScanStatus('Not a valid boarding pass QR')
          setTimeout(() => setScanStatus(null), 2000)
        },
        () => {}
      ).catch(() => {
        if (active) setError('Camera access denied or unavailable')
      })
    }, 150)

    return () => {
      active = false
      clearTimeout(timeout)
      try { scannerRef.current?.stop() } catch {}
      scannerRef.current = null
      if (container) container.innerHTML = ''
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />
      <div className="relative bg-slate-800 rounded-2xl w-full max-w-sm mx-4 p-5 border border-slate-700">
        <button onClick={onClose} className="absolute top-3 right-3 text-slate-500 hover:text-white z-10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-white mb-1">Scan Boarding Pass</h3>
          <p className="text-sm text-slate-400">Point camera at the ticket QR code</p>
        </div>

        <div className="rounded-xl overflow-hidden bg-black mb-3" style={{ minHeight: 280 }}>
          {pastedImg ? (
            <img src={pastedImg} className="w-full h-auto" alt="Pasted QR" />
          ) : (
            <div ref={containerRef} />
          )}
        </div>

        {scanStatus && (
          <p className="text-amber-400 text-xs text-center mb-2">{scanStatus}</p>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
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
    <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4 hover:bg-slate-800/60 transition-colors">
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
          <span className="text-white text-lg font-bold">{flight.origin_code || '--'}</span>
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
          <span className="text-white text-lg font-bold">{flight.destination_code || '--'}</span>
        </div>
        <span className="text-slate-500 text-xs">Gate {flight.gate || '--'}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <span className="text-xs font-medium text-blue-400">Scan QR</span>
          </button>
        ) : (
          <span className="text-slate-500 text-xs">Terminal {flight.terminal || '--'}</span>
        )}
      </div>
    </div>
  )
}
