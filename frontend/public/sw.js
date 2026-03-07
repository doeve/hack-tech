// Registered by usePushNotifications.js on app start.
// Runs in background — receives push events when app is closed or backgrounded.

self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

self.addEventListener('push', (event) => {
    const data = event.data?.json() ?? {}
    event.waitUntil(
        self.registration.showNotification(data.title ?? 'Airport Companion', {
            body:  data.body  ?? '',
            icon:  '/assets/icon-192.png',
            badge: '/assets/badge-72.png',
            tag:   data.tag  ?? 'default',
            data:  { url: data.url ?? '/' },
        })
    )
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            const existing = list.find((c) => c.url.includes(self.location.origin))
            if (existing) return existing.focus()
            return clients.openWindow(event.notification.data.url)
        })
    )
})
