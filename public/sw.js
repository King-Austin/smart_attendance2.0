/* Service worker — handles background Web Push notifications for the
 * Capacitor Android WebView. Expected payload:
 *
 *   {
 *     "title": "Session started",
 *     "body": "CSC 401 attendance is now open",
 *     "icon": "/app-icon-192.png",
 *     "data": {
 *       "route": "/student/attendance/SES-2026-1234",
 *       "entityId": "SES-2026-1234"
 *     }
 *   }
 */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Smart Campus Presence",
    body: "You have a new notification",
    icon: "/app-icon-192.png",
    data: {},
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title ?? payload.title,
        body: parsed.body ?? payload.body,
        icon: parsed.icon ?? payload.icon,
        data: parsed.data ?? {},
      };
    } catch (err) {
      // Non-JSON payload — fall back to text.
      payload.body = event.data.text();
    }
  }

  const tag = (payload.data && payload.data.entityId) || payload.title;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.icon,
      tag,
      renotify: true,
      data: payload.data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const route = typeof data.route === "string" ? data.route : "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Try to focus an existing tab/app instance.
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.pathname === route) {
          return client.focus();
        }
      }
      // Otherwise open a new one. Keep the path under the WebView origin.
      const targetUrl = new URL(route, self.location.origin).toString();
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
