import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import {
  getAirports, getAirportPOIs, getNavGraph, getReplayTracks,
  createSession, getRoute, startReplay, stopReplay,
} from '../api/client'
import { useWebSocket } from '../hooks/useWebSocket'
import { DemoCard, InfoRow } from './demo/DemoShared'
import DemoReplayCard from './demo/DemoReplayCard'
import DemoPositionCard from './demo/DemoPositionCard'
import DemoVerifyCard from './demo/DemoVerifyCard'
import DemoRouteCard from './demo/DemoRouteCard'

export default function DemoPage() {
  const navigate = useNavigate()
  const {
    airport, setAirport, setPois, setNavGraph, navGraph,
    session, setSession, position,
    route, setRoute, isReplaying, setReplaying,
    verificationToken,
  } = useStore()

  const [tracks, setTracks] = useState([])
  const [loading, setLoading] = useState(true)
  useWebSocket(session?.id)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: airports } = await getAirports()
        if (!airports?.length) return
        const ap = airports[0]
        setAirport(ap)
        const [poisRes, graphRes, tracksRes] = await Promise.all([
          getAirportPOIs(ap.id), getNavGraph(ap.id), getReplayTracks(ap.id),
        ])
        setPois(poisRes.data)
        setNavGraph(graphRes.data)
        setTracks(tracksRes.data)
      } catch (err) {
        console.error('Failed to load demo data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [setAirport, setPois, setNavGraph])

  useEffect(() => {
    if (!airport || !navGraph?.nodes?.length) return
    const go = async () => {
      try {
        const s = navGraph.nodes[0]
        const e = navGraph.nodes[navGraph.nodes.length - 1]
        const { data } = await getRoute({
          airport_id: airport.id, from_node_id: s.id, to_node_id: e.id, mode: 'fastest',
        })
        setRoute(data)
      } catch { /* not ready */ }
    }
    go()
  }, [airport, navGraph, setRoute])

  const handleStart = useCallback(async (trackId, speed) => {
    if (!trackId || !airport) return
    try {
      let sess = session
      if (!sess) {
        const { data } = await createSession({
          airport_id: airport.id, start_x_m: position.x_m, start_y_m: position.y_m,
          start_confirmed_by: 'manual_set', route_mode: 'fastest',
          nav_mode: 'standard', ar_enabled: false, replay_track_id: trackId,
        })
        sess = data; setSession(sess)
      }
      await startReplay({ session_id: sess.id, track_id: trackId, speed_multiplier: speed })
      setReplaying(true)
    } catch (err) { console.error('Start replay failed:', err) }
  }, [airport, session, position, setSession, setReplaying])

  const handleStop = useCallback(async () => {
    if (!session) return
    try { await stopReplay(session.id); setReplaying(false) }
    catch (err) { console.error('Stop replay failed:', err) }
  }, [session, setReplaying])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-900 p-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/map')} className="text-slate-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-white">Demo Control Panel</h1>
      </div>
      <div className="max-w-lg mx-auto space-y-4">
        <DemoCard title="Airport">
          {airport ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <InfoRow label="Name" value={airport.name} />
              <InfoRow label="IATA" value={airport.iata_code} />
              <InfoRow label="Size" value={`${airport.width_m}m x ${airport.height_m}m`} />
              <InfoRow label="px/m" value={airport.px_per_metre} />
            </div>
          ) : <p className="text-slate-500 text-sm">No airport loaded</p>}
        </DemoCard>
        <DemoReplayCard tracks={tracks} isReplaying={isReplaying} onStart={handleStart} onStop={handleStop} />
        <DemoPositionCard position={position} />
        <DemoRouteCard />
        <DemoVerifyCard verificationToken={verificationToken} />
      </div>
    </div>
  )
}
