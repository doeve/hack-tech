import { useMemo } from 'react'
import { useStore } from '../../store'

export default function ETABar() {
  const { route, currentStepIndex } = useStore()

  const stats = useMemo(() => {
    if (!route?.instructions?.length) return null

    // Remaining distance: sum of remaining instruction distances
    let remainingDistance = 0
    for (let i = currentStepIndex; i < route.instructions.length; i++) {
      remainingDistance += route.instructions[i].distance_m || 0
    }

    const totalDistance = route.total_distance_m || 0
    const totalTime = route.total_time_s || 0
    const progress = totalDistance > 0
      ? Math.min(1, (totalDistance - remainingDistance) / totalDistance)
      : 0

    // Estimate remaining time based on average walking speed 1.2 m/s
    const remainingTime = Math.ceil(remainingDistance / 1.2)

    return {
      totalDistance,
      remainingDistance,
      totalTime,
      remainingTime,
      progress,
    }
  }, [route, currentStepIndex])

  if (!stats) return null

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  return (
    <div className="bg-slate-800/95 backdrop-blur-sm rounded-xl px-4 py-2
                    border border-slate-700/50 shadow-xl">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-slate-700 rounded-full mb-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full
                     transition-all duration-500 ease-out"
          style={{ width: `${stats.progress * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            <span className="text-white font-medium">
              {Math.round(stats.remainingDistance)}m
            </span> remaining
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white font-medium">
            {formatTime(stats.remainingTime)}
          </span>
        </div>
        <span className="text-slate-500">
          {Math.round(stats.totalDistance)}m total
        </span>
      </div>
    </div>
  )
}
