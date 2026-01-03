# AuditPro Version History

## v1.10.4 (Current) - "Smart Duration Analysis & Suspicious Detection"
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
