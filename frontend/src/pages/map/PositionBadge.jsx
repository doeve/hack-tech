export default function PositionBadge({ position }) {
  return (
    <div className="absolute bottom-6 left-4 z-[1000]">
      <div className="bg-white backdrop-blur-sm rounded-xl px-3 py-2
                      border border-slate-200 text-xs text-slate-500 space-y-0.5">
        <div className="flex gap-3">
          <span>X: {position.x_m?.toFixed(1)}m</span>
          <span>Y: {position.y_m?.toFixed(1)}m</span>
        </div>
        <div className="flex gap-3">
          <span>H: {position.heading_deg?.toFixed(0)}deg</span>
          <span className={position.drift_radius_m > 5 ? 'text-yellow-400' : ''}>
            D: +/-{position.drift_radius_m?.toFixed(1)}m
          </span>
        </div>
        <div>
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
            position.source === 'replay' ? 'bg-purple-500/20 text-purple-400' :
            position.source === 'imu' ? 'bg-green-500/20 text-green-400' :
            'bg-slate-600/50 text-slate-500'
          }`}>
            {position.source || 'manual'}
          </span>
        </div>
      </div>
    </div>
  )
}


