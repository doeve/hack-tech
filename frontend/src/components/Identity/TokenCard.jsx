import { useStore } from '../../store'

export default function TokenCard() {
  const { verificationToken } = useStore()

  if (!verificationToken) {
    return (
      <div className="p-4 bg-white border border-slate-200 rounded-xl text-center">
        <p className="text-slate-500 text-sm">No active verification token</p>
        <p className="text-slate-500 text-xs mt-1">
          Complete face enrollment and document verification first
        </p>
      </div>
    )
  }

  const { claims, expires_at } = verificationToken
  const expiresAt = expires_at ? new Date(expires_at) : null
  const isExpired = expiresAt && expiresAt < new Date()

  return (
    <div className={`p-4 rounded-xl border ${
      isExpired
        ? 'bg-red-900/20 border-red-700'
        : 'bg-green-900/20 border-green-700'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-slate-900 text-sm">Verification Token</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          isExpired
            ? 'bg-red-500/20 text-red-400'
            : 'bg-green-500/20 text-green-400'
        }`}>
          {isExpired ? 'Expired' : 'Active'}
        </span>
      </div>

      {claims && (
        <div className="space-y-2">
          {Object.entries(claims).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{key.replace(/_/g, ' ')}</span>
              <span className={`font-mono ${
                value === true ? 'text-green-400' :
                value === false ? 'text-red-400' :
                'text-slate-900'
              }`}>
                {typeof value === 'boolean' ? (value ? 'YES' : 'NO') : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {expiresAt && (
        <div className="mt-3 pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Expires: {expiresAt.toLocaleString()}
          </p>
        </div>
      )}
    </div>
  )
}


