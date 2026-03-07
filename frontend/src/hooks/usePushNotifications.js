import { useEffect } from 'react'
import { useStore } from '../store'
import api from '../api/client'

export function usePushNotifications() {
  const { user } = useStore()

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return

    const setup = async () => {
      // 1. Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')

      // 2. Check existing permission
      if (Notification.permission === 'denied') return

      // 3. Request permission on first call (must be triggered by user gesture
      //    in production; for the demo, call from a button onClick)
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      // 4. Fetch VAPID public key
      const { data } = await api.get('/push/vapid-public-key')
      const applicationServerKey = urlBase64ToUint8Array(data.public_key)

      // 5. Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // 6. Send subscription object to backend
      const sub = subscription.toJSON()
      await api.post('/push/subscribe', {
        endpoint:   sub.endpoint,
        keys:       sub.keys,
        device_key: localStorage.getItem('device_key') ?? 'unknown',
      })
    }

    setup().catch(console.error)
  }, [user])
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
