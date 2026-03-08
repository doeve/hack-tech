import { DemoCard, InfoRow } from './DemoShared'

export default function DemoPositionCard({ position }) {
  return (
    <DemoCard title="Live Position">
      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoRow label="X" value={`${position.x_m?.toFixed(1)} m`} />
        <InfoRow label="Y" value={`${position.y_m?.toFixed(1)} m`} />
        <InfoRow label="Heading" value={`${position.heading_deg?.toFixed(0)} deg`} />
        <InfoRow
          label="Drift"
          value={`+/- ${position.drift_radius_m?.toFixed(1)} m`}
          warn={position.drift_radius_m > 5}
        />
        <InfoRow label="Source" value={position.source} badge />
      </div>
    </DemoCard>
  )
}


