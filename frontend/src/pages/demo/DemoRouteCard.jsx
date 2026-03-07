import { useStore } from '../../store'
import { DemoCard } from './DemoShared'

export default function DemoRouteCard() {
  const { route, currentStepIndex } = useStore()

  if (!route?.instructions) return null

  return (
    <DemoCard title="Route Instructions">
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {route.instructions.map((inst, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 text-xs p-1.5 rounded ${
              i === currentStepIndex
                ? 'bg-blue-500/20 text-blue-300'
                : i < currentStepIndex
                ? 'text-slate-500 line-through'
                : 'text-slate-300'
            }`}
          >
            <span className="w-5 text-right font-mono text-slate-500">
              {i + 1}
            </span>
            <span className="flex-1">{inst.display_text || inst.tts_text}</span>
            <span className="text-slate-500">{Math.round(inst.distance_m || 0)}m</span>
          </div>
        ))}
      </div>
    </DemoCard>
  )
}
