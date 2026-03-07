import { useEffect } from 'react'
import { useStore } from '../../store'

const INSTRUCTION_ICONS = {
  continue_straight: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
  turn_left: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  ),
  turn_right: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  ),
  turn_slight_left: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7l5-5m0 0v12m0-12l5 5" />
    </svg>
  ),
  turn_slight_right: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-5-5m0 0v12m0-12L7 7" />
    </svg>
  ),
  arrive: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const PROXIMITY_THRESHOLD_M = 5

export default function InstructionBanner() {
  const { route, currentStepIndex, position, advanceStep, navGraph } = useStore()

  // Auto-advance when near next waypoint
  useEffect(() => {
    if (!route?.instructions || !route?.node_sequence || !navGraph?.nodes?.length) return

    const nextNodeIdx = Math.min(currentStepIndex + 1, route.node_sequence.length - 1)
    const nextNodeId = route.node_sequence[nextNodeIdx]
    const nextNode = navGraph.nodes.find((n) => n.id === nextNodeId)
    if (!nextNode) return

    const dx = position.x_m - nextNode.x_m
    const dy = position.y_m - nextNode.y_m
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < PROXIMITY_THRESHOLD_M && currentStepIndex < route.instructions.length - 1) {
      advanceStep()
    }
  }, [position, route, currentStepIndex, navGraph, advanceStep])

  if (!route?.instructions?.length) return null

  const instruction = route.instructions[currentStepIndex]
  if (!instruction) return null

  const icon = INSTRUCTION_ICONS[instruction.instruction_type] || INSTRUCTION_ICONS.continue_straight
  const isLast = currentStepIndex >= route.instructions.length - 1

  return (
    <div className="bg-white backdrop-blur-sm rounded-2xl px-4 py-3
                    border border-slate-200 shadow-xl flex items-center gap-4">
      <div className={`flex-shrink-0 p-2 rounded-xl ${isLast ? 'bg-green-500/20 text-green-400' : 'bg-[#1e3a8a]/20 text-[#1e3a8a]'}`}>
        {isLast ? INSTRUCTION_ICONS.arrive : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 text-sm font-medium truncate">
          {instruction.display_text || instruction.tts_text || 'Continue ahead'}
        </p>
        <p className="text-slate-500 text-xs mt-0.5">
          {instruction.distance_m != null ? `${Math.round(instruction.distance_m)} m` : ''}
          {instruction.bearing_deg != null ? ` | ${Math.round(instruction.bearing_deg)}deg` : ''}
        </p>
      </div>
      <div className="text-xs text-slate-500 flex-shrink-0">
        {currentStepIndex + 1}/{route.instructions.length}
      </div>
    </div>
  )
}


