import { useState } from 'react'
import { DemoCard } from './DemoShared'
import FaceVerify from '../../components/Identity/FaceVerify'
import TokenCard from '../../components/Identity/TokenCard'

export default function DemoVerifyCard({ verificationToken }) {
  const [showSecurityVerify, setShowSecurityVerify] = useState(false)
  const [showGateVerify, setShowGateVerify] = useState(false)

  return (
    <>
      <DemoCard title="Touchpoint Verification">
        <div className="space-y-3">
          <button
            onClick={() => setShowSecurityVerify(!showSecurityVerify)}
            className="w-full py-2 bg-red-600/20 border border-red-700 text-red-400
                       rounded-lg text-sm font-medium hover:bg-red-600/30 transition-colors"
          >
            Verify at Security
          </button>
          {showSecurityVerify && (
            <FaceVerify
              touchpointId="tp000000-0000-0000-0000-000000000001"
              onResult={(r) => console.log('Security verify:', r)}
            />
          )}

          <button
            onClick={() => setShowGateVerify(!showGateVerify)}
            className="w-full py-2 bg-[#1e3a8a] border border-blue-700 text-[#1e3a8a]
                       rounded-lg text-sm font-medium hover:bg-[#1e3a8a] transition-colors"
          >
            Board at Gate B7
          </button>
          {showGateVerify && (
            <FaceVerify
              touchpointId="tp000000-0000-0000-0000-000000000002"
              onResult={(r) => console.log('Gate verify:', r)}
            />
          )}
        </div>
      </DemoCard>

      <DemoCard title="Token & Claims">
        <TokenCard />
        {verificationToken?.claims && (
          <div className="mt-3 p-2 bg-white rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Raw Claims JSON</p>
            <pre className="text-xs text-slate-500 font-mono overflow-x-auto">
              {JSON.stringify(verificationToken.claims, null, 2)}
            </pre>
          </div>
        )}
      </DemoCard>
    </>
  )
}


