# AuditPro Version History

## v1.10.10 (Current) - "Streamlined Store Header"
- **Mobile UX:**
    - **Header Clean-up:** Removed redundant Notification and Profile buttons from the mobile header for Store users, as these are now accessible via the persistent bottom navigation.
    - **Online Status:** Added a dedicated "Çevrimiçi/Çevrimdışı" text badge to the top right header for clear connectivity status visibility.

## v1.10.9 - "Mobile Nav Polish & Persistence"
- **Mobile Experience:**
    - **Persistent Navigation:** Integrated Bottom Navigation into the global Dashboard layout, ensuring it remains visible across all Store pages (including Notifications).
    - **Visual Refinements:** Standardized the "Panel" button style to match other navigation items (removed FAB style) and perfected vertical alignment for a cleaner interface.
    - **Improved Layout:** Switched to a uniform grid layout for equal spacing of all mobile navigation items.

## v1.10.8 - "Audit Card & Action Alert Polish"
- **UI Refinements:**
    - **Audit Card:** Optimized layout to remove visual gaps and improved whitespace usage for a cleaner look.
    - **Action Alerts:** Tweaked styling for better visual integration.
- **Code Quality:**
    - **Date Utils:** Minor improvements to date utility functions.

## v1.10.7 - "Store Panel Redesign & PDF Download"
- **Major Feature: Store User Panel:**
    - **New Dashboard:** A completely redesigned `/magaza/panel` for store users, featuring a modern welcome header, improved layout, and clear action items.
    - **Action Alerts:** New banner-style alerts for pending and rejected actions, providing immediate visibility and deep linking.
    - **Audit Cards:** Premium Shadcn-styled audit cards with score badges, detailed metrics, and direct PDF access.
- **Reporting & Notifications:**
    - **PDF Download for Stores:** Store users can now download PDF reports directly from the audit detail page (`/audits/[id]/actions`), ensuring easy access to their audit records.
    - **Access Control:** Enforced strict store-level permissions on audit viewing pages.
- **UI/UX Refinements:**
    - **Action Buttons:** Added distinct "PDF İndir" button to the audit response page.
    - **Navigation:** Added dedicated "Panel" link to the sidebar for store users.

## v1.10.6 - "PWA Notification Stability & APK Integration"
- **Android PWA & Notification System:**
    - **APK Native Notifications:** Fixed notifications to appear from "AuditPro" app instead of "Chrome" by adding Android notification channel configuration (`channelId`, `icon`, `color`) to FCM payload.
    - **Permission Flow:** Restored automatic notification permission request on first install while maintaining manual fix button for users who dismiss the initial prompt.
    - **Visual Status Indicator:** Added real-time permission status indicator (🟢 granted / 🔴 denied) next to the "Bildirim gelmiyor mu?" fix button in notification menu.
    - **Permission Monitoring:** Implemented automatic permission state polling (2s interval) to keep UI status synchronized with device settings.
- **User Experience:**
    - **Fix Button Enhancement:** "Tıkla ve Düzelt" button now shows visual feedback with permission state icon, making it clear when notifications are enabled.
    - **Removed Diagnostic Tool:** Clean UI by removing technical diagnostic button, keeping only essential "Fix" functionality.
    - **Removed Success Toast:** Eliminated "Cihaz bildirim servisine bağlandı 🟢" toast for cleaner, less intrusive UX.
- **Bug Fixes:**
    - **Firebase Permission-Blocked Error:** Fixed diagnostic tool to skip token fetching when permission is denied, preventing `messaging/permission-blocked` errors.
    - **Permission State Logic:** Resolved infinite permission loops by properly managing `Notification.permission` state transitions.
- **Technical Improvements:**
    - **Type Safety:** Fixed TypeScript errors by renaming `Notification` type import to `NotificationModel` to avoid conflicts with global `Notification` API.
    - **PWA Manifest:** Enhanced with categories, shortcuts, and screenshots for better Play Store presentation.

## v1.10.5 - "Login Dark Mode & Robust Editing"
- **Auditor & Action Logic:**
    - **Reactivation Fix:** Confirmed and optimized logic where Auditor edits (changing answer to "No") correctly trigger action reactivation for Stores.
    - **Data Integrity:** Implemented `restoreTimestamps` helper to prevent date corruption when editing completed audits.
- **UI/UX & Dark Mode:**
    - **Login Page Overhaul:** Added comprehensive Dark Mode support for the Login page (adaptive backgrounds, text, and icons).
    - **Dynamic Logo:** Login page now switches between "welcome-image.jpg" (Light) and "auditpro-beyaz.png" (Dark).
    - **Date Display:** Standardized Store action dates to "Gönderim" for clearer history tracking.
- **Bug Fixes:**
    - **Runtime Errors:** Resolved `toDate is not a function` errors in Admin and Store panels by enhancing date parsing logic.

## v1.10.4 - "Smart Duration Analysis & Suspicious Detection"
- **New Feature: Suspicious Answer Detection:**
    - **Smart Analysis:** Automatically compares individual answer duration against the global average for that specific question.
    - **Rounding Tolerance:** Implemented intelligent rounding (no decimals) to prevent false positives (e.g., treating 6.1s and 5.9s as equal '6s').
    - **Visual Indicators:** "Suspicious" status is highlighted in Red in both UI and PDF/Excel exports.
    - **Data Filtering:** Automatically excludes unanswered questions from analysis and reports to ensure accurate statistics.
- **Audit Form Engine:**
    - **Refactored Timer Logic:** Replaced focus-based timing with a robust session-based interaction timer.
    - **Interval Tracking:** Now calculates duration based on the interval between the last interaction and the current answer, providing truer reflection of "thinking time".
- **Enhanced Reports (PDF & Excel):**
    - **New Columns:** Added "Average Duration (sec)" and "Status" (Suspicious/-) columns to detailed question reports.
    - **Header Updates:** Renamed "Duration" to "Answer Duration (sec)" for clarity.
    - **Clean Data:** Removed decimal places from all duration fields for cleaner readability.
    - **Summary Metrics:** Added "Suspicious Answer Rate" (e.g., 5/45) to the report headers.

## v1.10.3 - "Enhanced Reports & Export Features"
- **Auditor Performance Reports:**
    - **Interactive Charts:** Made auditor performance bar charts clickable - displays monthly breakdown in modal
    - **Monthly Analytics Modal:** Shows selected auditor's monthly store ratings with bar chart and detailed statistics table
    - **Responsive Modal:** Optimized modal dimensions (50vw width, 65vh height) for better PC viewing experience
    - **Year Selector:** Added year dropdown with 2026 as default selection
- **Export Functionality:**
    - **PDF Export:** Added professional PDF export for "Question-Based Duration Analysis" with:
        - Roboto font support (Regular & Bold) for proper Turkish character rendering
        - 4-column table layout displaying: Auditor Name, Start Time, End Time, Total Duration
        - Bold headers with blue background (#3b82f6)
        - Automatic time formatting (HH:MM format)
        - Dynamic file naming: `{StoreName} - {AuditorName} {Date} Tarihli mağaza denetimi.pdf`
    - **Excel Export:** Implemented Excel export with same data structure and file naming convention
    - **Export Buttons:** Added color-coded export buttons (Red for PDF, Green for Excel) in DataTable toolbar
- **Data Enhancements:**
    - **Extended `DurationMetric` interface with `startDate` and `endDate` fields**
    - **Automated Timestamp to Date conversion in `processAudits` function**
    - **Improved data flow from database to export functions**
- **UI/UX Improvements:**
    - **Optimized PDF spacing and layout for professional appearance**
    - **Reduced vertical gaps between tables (20px start, 5px between tables)**
    - **Center-aligned table content for better readability**

## v1.10.2 - "Personalized Notifications"
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
    - **Bell icon for Admin (Sender) and Users (Receiver).**
    - **Implemented Push Notifications via Firebase Cloud Messaging (FCM).**
    - **Supports targeting specific groups (Auditors, Stores) or individuals.**
    - **Added "Mark as Read" and "Delete" functionality.**
- **Mobile & PWA Stability:**
    - **iOS Fix:** Added APNs headers (`apns-priority: 10`, `sound: default`) for reliable iOS notifications.
    - **Android Fix:** Enforced High Priority to wake up devices in Doze mode.
    - **Auth Watchdog:** Added 12s safety timer to preventing "Infinite Loading" on slow networks.
    - **Localhost Support:** Implemented Dynamic Auth Domain and "Popup" login for Localhost vs "Redirect" for PWA.
- **Troubleshooting Tools:**
    - **Added "Bildirim Gelmiyor mu?" (Fix Notifications) button to User Menu for self-healing connection issues.**

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
