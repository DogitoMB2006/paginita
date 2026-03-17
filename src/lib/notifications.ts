export function requestNotificationPermission() {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function showBrowserNotification(message: string, avatarUrl: string | null) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return

  const icon = avatarUrl || undefined

  try {
    new Notification('Nuestra paginita', {
      body: message,
      icon,
      badge: icon,
    })
  } catch {
    // Ignore notification errors
  }
}

