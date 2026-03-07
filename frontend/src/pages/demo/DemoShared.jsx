export function DemoCard({ title, children }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function InfoRow({ label, value, warn, badge }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      {badge ? (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          value === 'replay' ? 'bg-purple-500/20 text-purple-400' :
          value === 'imu' ? 'bg-green-500/20 text-green-400' :
          'bg-slate-600/50 text-slate-400'
        }`}>{value}</span>
      ) : (
        <span className={`font-mono ${warn ? 'text-yellow-400' : 'text-white'}`}>{value}</span>
      )}
    </div>
  )
}
