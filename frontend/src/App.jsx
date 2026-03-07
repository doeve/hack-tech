import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useStore } from './store'
import { usePushNotifications } from './hooks/usePushNotifications'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import ARPage from './pages/ARPage'
import IdentityPage from './pages/IdentityPage'
import DemoPage from './pages/DemoPage'

function AuthGuard({ children }) {
  const { accessToken } = useStore()
  const location = useLocation()

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default function App() {
  usePushNotifications()

  return (
    <div className="h-full w-full">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/map"
          element={
            <AuthGuard>
              <MapPage />
            </AuthGuard>
          }
        />
        <Route
          path="/ar"
          element={
            <AuthGuard>
              <ARPage />
            </AuthGuard>
          }
        />
        <Route
          path="/identity"
          element={
            <AuthGuard>
              <IdentityPage />
            </AuthGuard>
          }
        />
        <Route
          path="/demo"
          element={
            <AuthGuard>
              <DemoPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/map" replace />} />
      </Routes>
    </div>
  )
}
