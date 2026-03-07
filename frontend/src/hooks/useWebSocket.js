import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 10
const PING_INTERVAL_MS = 25000

export function useWebSocket(sessionId) {
  const wsRef = useRef(null)
  const reconnectCountRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const pingTimerRef = useRef(null)
  const { accessToken, setPosition } = useStore()

  const connect = useCallback(() => {
    if (!sessionId || !accessToken) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const url = `${protocol}//${host}/ws/positions/${sessionId}?token=${accessToken}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectCountRef.current = 0

      // Start ping interval to keep connection alive
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.x_m !== undefined && data.y_m !== undefined) {
          setPosition({
            x_m: data.x_m,
            y_m: data.y_m,
            heading_deg: data.heading_deg ?? 0,
            drift_radius_m: data.drift_radius_m ?? 0,
            source: data.source ?? 'websocket',
            estimated_at: data.estimated_at,
          })
        }
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onclose = () => {
      clearInterval(pingTimerRef.current)
      if (reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCountRef.current += 1
        const delay = RECONNECT_DELAY_MS * Math.min(reconnectCountRef.current, 5)
        reconnectTimerRef.current = setTimeout(connect, delay)
      }
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [sessionId, accessToken, setPosition])

  useEffect(() => {
    connect()

    return () => {
      clearTimeout(reconnectTimerRef.current)
      clearInterval(pingTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connect])

  const confirmPosition = useCallback((x_m, y_m) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'confirm_position',
        x_m,
        y_m,
      }))
    }
  }, [])

  return { confirmPosition, ws: wsRef }
}
