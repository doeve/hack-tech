import { useCallback } from 'react'
import { useStore } from '../store'
import { startReplay as apiStartReplay, stopReplay as apiStopReplay } from '../api/client'

export function useReplay() {
  const { session, isReplaying, setReplaying } = useStore()

  const startReplay = useCallback(async (trackId, speedMultiplier = 1.0) => {
    if (!session?.id) return
    try {
      await apiStartReplay({
        session_id: session.id,
        track_id: trackId,
        speed_multiplier: speedMultiplier,
      })
      setReplaying(true)
    } catch (err) {
      console.error('Failed to start replay:', err)
      throw err
    }
  }, [session, setReplaying])

  const stopReplay = useCallback(async () => {
    if (!session?.id) return
    try {
      await apiStopReplay(session.id)
      setReplaying(false)
    } catch (err) {
      console.error('Failed to stop replay:', err)
      throw err
    }
  }, [session, setReplaying])

  return { startReplay, stopReplay, isReplaying }
}
