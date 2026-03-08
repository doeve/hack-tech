import { useNavigate } from 'react-router-dom'
import ARView from '../components/AR/ARView'

export default function ARPage() {
  const navigate = useNavigate()

  return (
    <div className="h-full w-full">
      <ARView onExit={() => navigate('/map')} />
    </div>
  )
}


