/* Service Worker – תומך בהתראות Push גם כשהדפדפן סגור (PWA) */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "הוצאות טיול", body: event.data.text() };
  }
  const title = data.title || "הוצאות טיול";
  const options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || "trip-notification",
    renotify: true,
    data: data.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.navigate(url).then((c) => c?.focus());
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
