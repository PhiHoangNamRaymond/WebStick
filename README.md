 QuickPins
Save and open links instantly with one click.
A lightweight Chrome extension with zero tracking and no account required.




 Features
•  Pin the current tab with a single click
•  Fast search by title or domain (80ms debounce)
•  Rename pins directly inside the popup
•  Delete pins instantly without reloading
•  Automatic favicon loading from Chrome's internal cache
•  Fully local storage powered by chrome.storage.local

 Installation (Development)
git clone https://github.com/PhiHoangNamRaymond/WebStick
Load the extension into Chrome
1. Open chrome://extensions
2. Enable Developer mode
3. Click Load unpacked
4. Select the quickpins-v3/ directory
5. Done — the  icon should appear in your toolbar

 Project Structure
quickpins-v3/
├── manifest.json      # Manifest V3 + permissions + CSP
├── popup.html         # Main popup UI
├── popup.js           # UI rendering + search + rename + delete logic
├── store.js           # State management + debounced storage writes
├── background.js      # Service worker caching tab metadata
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

 Security
QuickPins is designed following the Least Privilege principle.
Component
Description
host_permissions: none
The extension cannot read website contents
Strict CSP
connect-src 'none' blocks all outbound requests
Zero External Requests
No CDN, analytics, or external APIs
Safe DOM Rendering
Uses textContent and DOM APIs instead of innerHTML
URL Validation
Only allows http: and https: URLs
Secure IDs
Uses crypto.randomUUID() instead of timestamps
Permissions Used
Permission
Purpose
storage
Save pinned links locally
tabs
Read the current tab's URL and title
favicon
Load favicons from chrome://favicon2/

 Privacy
• No tracking
• No analytics
• No telemetry
• No external data transmission
• No account required
All data remains entirely on the user's device.

 Contributing
Pull requests and issues are welcome.
Before submitting a PR, please ensure:
• No usage of innerHTML with dynamic content
• No external network requests added
• No unnecessary permissions introduced


