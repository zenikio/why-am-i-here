# Why Am I Here

A browser extension that asks **what you came to do** before a distracting site loads, keeps your answer on screen while you browse, and checks in when your time is up. It never blocks anything. It only makes you decide.

## How it works

1. **Ask:** on a watched site (YouTube, Reddit, X, ...), an overlay asks what you're here for and how long you'll give it. Media is paused until you answer.
2. **Remind:** a small banner shows your reason and the time left.
3. **Check in:** when time is up, you get your own words back ("You came here to: ...") and choose to take 10 more minutes or finish.
4. **Reflect:** when you finish, you say whether you did what you came for. The history page shows how often you did, and how often you went over time.

Everything is stored locally in `chrome.storage.local`. Nothing leaves your browser.

## Install (development)

1. Clone this repo.
2. Open `chrome://extensions` (Chrome, Brave, Edge) and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension/` folder.

Click the toolbar icon to open the history page, where you can also edit the watched-site list and export your log as JSON.

## Notes

- A session is shared across tabs of the same site and lapses after 30 minutes of inactivity (logged as `unrecorded`).
- The content script runs on all pages and checks the hostname against your list, which is what keeps the list editable.
- Firefox would need small manifest changes (not tested).

## License

MIT
