import { useState } from 'react'
import { DemoCard } from './DemoShared'

export default function DemoReplayCard({ tracks, isReplaying, onStart, onStop }) {
  const [selectedTrack, setSelectedTrack] = useState(tracks[0]?.id || '')
  const [speed, setSpeed] = useState(1.0)

  return (
    <DemoCard title="Replay">
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Track</label>
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="w-full px-3 py-2 bg-slate-100 border border-slate-300
                       rounded-lg text-sm text-slate-900"
          >
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.total_steps} steps, {(t.duration_ms / 1000).toFixed(0)}s)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-500 mb-1 block">
            Speed: {speed.toFixed(1)}x
          </label>
          <input
            type="range" min="0.25" max="5" step="0.25"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onStart(selectedTrack, speed)}
            disabled={isReplaying || !selectedTrack}
            className="flex-1 py-2 bg-green-600 hover:bg-green-500
                       disabled:bg-slate-100 text-slate-900 rounded-lg text-sm
                       font-medium transition-colors"
          >
            {isReplaying ? 'Playing...' : 'Start'}
          </button>
          <button
            onClick={onStop}
            disabled={!isReplaying}
            className="flex-1 py-2 bg-red-600 hover:bg-red-500
                       disabled:bg-slate-100 text-slate-900 rounded-lg text-sm
                       font-medium transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </DemoCard>
  )
}


