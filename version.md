# AuditPro Version History

## v1.10.2 (Current) - "Personalized Notifications"
- **User Experience:**
    - **Sender Identity:** Notifications now display the real name of the sender (e.g., the specific Admin's name) instead of generic "System Message" badges.
    - **Consistent UI:** Applied these changes to both the Header Dropdown and the main Notifications page.

## v1.10.1 - "Notification Polish & Deep Linking"
- **UI Refinements:**
    - **Header Alignment:** Aligned "Send Notification" button style with "AKSİYONLAR" (Blue, Uppercase) and positioned it correctly.
    - **Mobile UX:** Moved "Send Notification" button to the Sidebar for mobile admin users.
- **Notification Quality:**
    - **Content Fix:** Standardized push notification format to remove redundant "from AuditPro" text.
    - **Deep Linking:** Fixed Service Worker to correctly redirect users to the `/notifications` page upon clicking a notification.

## v1.10.0 - "The Notification Update"
- **New Feature: Notification System:**
    - Added "Bell" icon for Admin (Sender) and Users (Receiver).
    - Implemented Push Notifications via Firebase Cloud Messaging (FCM).
    - Supports targeting specific groups (Auditors, Stores) or individuals.
    - Added "Mark as Read" and "Delete" functionality.
- **Mobile & PWA Stability:**
    - **iOS Fix:** Added APNs headers (`apns-priority: 10`, `sound: default`) for reliable iOS notifications.
    - **Android Fix:** Enforced High Priority to wake up devices in Doze mode.
    - **Auth Watchdog:** Added 12s safety timer to preventing "Infinite Loading" on slow networks.
    - **Localhost Support:** Implemented Dynamic Auth Domain and "Popup" login for Localhost vs "Redirect" for PWA.
- **Troubleshooting Tools:**
    - Added "Bildirim Gelmiyor mu?" (Fix Notifications) button to User Menu for self-healing connection issues.

## v1.9.6
- **Resolved Push Notification Issues:** Fixed API 500 errors by adding `firebase-functions` dependency and using safe admin initialization.
- **Service Worker Fixes:** Corrected syntax errors in SW and removed redundant `showNotification` calls to prevent double notifications.
- **Double Notification Fix:** Implemented `ServiceWorkerUpdater` to aggressively update cached workers and added token de-duplication in the API.
- **Foreground Notifications:** Added `onMessage` listener to display in-app toast notifications when the app is open.
- **Admin Testing:** Added "Tüm Adminler" option to the notification dialog for easier testing.

## v1.9.5
- **Resolved iOS PWA Login Loop:** Fixed the persistent `auth/network-request-failed` error on iOS PWA by switching to `signInWithRedirect` and `indexedDB` persistence.
- **Aligned Auth Domain:** Updated `authDomain` to `tugbadenetim.info` to ensure Same-Origin policy compliance with the custom domain, bypassing iOS PWA network restrictions.
- **Optimized PWA Experience:** Shortened the home screen app name to "AuditPro" and removed potentially conflicting Service Worker configurations.
- **Enhanced Login Stability:** Implemented a robust "Kill Switch" for stale Service Workers to prevent caching issues affecting authentication.

## v1.9.3
- Refined Admin Actions UI: Increased row height, font sizes, and badge styles.
- Reordered columns in Admin Actions table: Store -> Auditor -> Audit Type.
- Fixed `useSearchParams` build errors in Admin Actions and Sidebar by adding Suspense boundaries.
- Added dynamic filtering for "Return Date" and "Deadline" columns based on tab.

## v1.9.1
- Updated question cards to match the blue theme of the section cards.

## v1.8.0
- Increased visibility of section card background color (distinct blue).
- Updated versioning workflow.

## v1.7.0
- Updated UI to use Shadcn-compatible blue theme for audit forms.
- Section cards now have a light blue background for better visibility.
- Audit header styling refined to match the blue theme.

## v1.6.0
- Added version display in sidebar.
- Fixed build error in admin dashboard.
- Modernized section headers.
