importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Config from firebase.ts
const firebaseConfig = {
    apiKey: "AIzaSyAWNOeyW0mHSqhjcLqdhPoL4TmOzyP7f6w",
    authDomain: "tugbadenetim.info",
    projectId: "tugba-auditpro",
    storageBucket: "tugba-auditpro.firebasestorage.app",
    messagingSenderId: "187720079346",
    appId: "1:187720079346:web:fcc9bd140dc790196bbd6b",
    measurementId: "G-EK65S7WF6R"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
// When the app is in the background or closed, FCM routes messages here.
// We MUST call showNotification manually — relying on the browser to auto-show
// only works for pure notification-only messages (no data field).
// Since our messages include both notification + data, Chrome always delegates to SW.
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background message received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'AuditPro';
    const body  = payload.notification?.body  || payload.data?.body  || '';
    const url   = payload.data?.url || payload.fcmOptions?.link || '/';

    const options = {
        body: body,
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        data: { url: url },
        requireInteraction: false,
        vibrate: [200, 100, 200]
    };

    self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
    console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
    event.notification.close();

    // Get URL from data payload or default to root
    const targetUrl = event.notification.data?.url || event.notification.data?.link || '/';

    // Open the app or focus the window
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Check if there is already a window/tab open with the target URL
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                // If the client is already open, focus it and navigate
                if ('focus' in client) {
                    if (client.url.includes(targetUrl)) {
                        return client.focus();
                    }
                    return client.focus().then(activeClient => {
                        return activeClient.navigate(targetUrl);
                    });
                }
            }
            // If not, then open the target URL in a new window/tab.
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
