self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Focus if already opened
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url.includes("/admin") && "focus" in client) {
          return client.focus();
        }
      }
      // If not opened, open a new window
      if (clients.openWindow) {
        return clients.openWindow("/admin");
      }
    }),
  );
});
