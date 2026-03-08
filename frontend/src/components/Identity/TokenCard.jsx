import { useStore } from '../../store'
export default function TokenCard() {
  const { verificationToken } = useStore()

  if (!verificationToken) {
    return (
      <div className="p-6 bg-coolWhite border border-gray-200 rounded-xl text-center">
        <p className="text-anthracite font-semibold text-sm">No active verification token</p>
        <p className="text-gray-500 text-xs mt-2">
            Complete face enrollment and document verification first
        </p>
      </div>
    )
  }

  const { claims, expires_at } = verificationToken
  const expiresAt = expires_at ? new Date(expires_at) : null
  const isExpired = expiresAt && expiresAt < new Date()

  return (
    <div className={`p-6 rounded-2xl border-2 shadow-sm transition-all ${
      isExpired
        ? 'bg-red-50 border-red-200'
        : 'bg-white border-successMint'
    }`}>
      {/* Header-ul Cardului - Stil AeroSecure */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-aviation text-sm tracking-wide">BOARDING PASS TOKEN</h3>
          <p className="text-[10px] text-gray-400 font-mono">ID: {verificationToken.token?.substring(0, 8)}...</p>
        </div>
        <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter ${
          isExpired
            ? 'bg-red-200 text-red-700'
            : 'bg-successMint text-aviation'
        }`}>
          {isExpired ? 'Expirat' : 'Securizat'}
        </span>
      </div>

      {/* Afișare Claims (Datele extrase prin PDI) */}
      {claims && (
        <div className="space-y-3">
          {Object.entries(claims).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</span>
              <span className={`text-xs font-bold ${
                value === true ? 'text-green-600' :
                value === false ? 'text-red-600' :
                'text-aviation'
              }`}>
                {typeof value === 'boolean' ? (value ? 'VALIDAT' : 'INVALID') : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer Card - Valabilitate */}
      {expiresAt && (
        <div className="mt-5 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase text-gray-400">Expiră la</span>
            <span className="text-xs font-semibold text-anthracite">
              {expiresAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="h-8 w-8 bg-coolWhite rounded flex items-center justify-center">
             {/* Simbol grafic pentru securitate IAL2 */}
             <div className="w-4 h-4 rounded-full border-2 border-aviation opacity-20" />
          </div>
        </div>
      )}
    </div>
  )
}