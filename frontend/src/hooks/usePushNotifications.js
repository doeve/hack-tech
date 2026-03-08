import { useEffect } from 'react'
import { useStore } from '../store'
import api from '../api/client'

export function usePushNotifications() {
  const { user } = useStore()

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    const setup = async () => {
      // Wait for existing SW registration (registered in main.jsx)
      let reg = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!reg) {
        // Try registering directly as fallback
        try {
          reg = await navigator.serviceWorker.register('/sw.js')
        } catch {
          console.warn('Service worker registration failed')
          return
        }
      }

      // Wait for SW to be active
      if (!reg.active) {
        await new Promise((resolve) => {
          const sw = reg.installing || reg.waiting
          if (!sw) return resolve()
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') resolve()
          })
        })
      }

      if (Notification.permission === 'denied') return

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const { data } = await api.get('/push/vapid-public-key')
      if (!data.public_key) return

      const applicationServerKey = urlBase64ToUint8Array(data.public_key)

      // Check for existing subscription first
      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })
      }

      const sub = subscription.toJSON()
      await api.post('/push/subscribe', {
        endpoint:   sub.endpoint,
        keys:       sub.keys,
        device_key: localStorage.getItem('device_key') ?? navigator.userAgent.slice(0, 50),
      })
    }

    setup().catch((err) => console.warn('Push setup failed:', err))
  }, [user])
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
