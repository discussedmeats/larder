# Larder — standalone PWA

A self-contained, single-file food tracker that runs in any modern browser and installs to your phone or desktop like a real app. Uses your own Anthropic API key for nutrition lookup and weekly low-FODMAP reviews.

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | The whole app — React + UI + storage + API calls in one file |
| `manifest.json` | PWA manifest (lets the app install to home screen / dock) |
| `sw.js` | Service worker — caches the app shell so it loads offline |
| `icon-192.png`, `icon-512.png` | Standard PWA icons |
| `icon-512-maskable.png` | Adaptive icon for Android |
| `apps-script.gs` | Google Apps Script for the optional Sheets sync — paste into a Sheet's Apps Script editor |
| `make_icons.py` | The script that generated the icons — you do not need to run this |

## Deploy to GitHub Pages (≈10 minutes)

1. **Create the repo.** On github.com, create a new public repo, e.g. `larder`.
2. **Upload the files.** Either clone the repo and copy everything in this folder into it, or use GitHub's "Add file → Upload files" button and drag in `index.html`, `manifest.json`, `sw.js`, and the three icon PNGs.
3. **Commit** to the `main` branch.
4. **Enable Pages.** Repo Settings → Pages → under "Build and deployment" set Source to **Deploy from a branch**, Branch to **main / root**, then Save.
5. **Wait ~1 minute.** GitHub will publish at `https://<your-username>.github.io/larder/`. The Pages settings page will show the live URL.
6. **Visit the URL** on your phone and laptop.

## Get an Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign up.
2. Add a small amount of credit ($5 will last a long time at Haiku 4.5 pricing).
3. **API Keys** → Create Key → copy the value (`sk-ant-…`).
4. Open Larder, tap **Settings**, paste the key, hit **Save key**.

The key is stored only in your browser's localStorage. It never goes to any server other than Anthropic's API. Do **not** commit your key into the GitHub repo — there's nowhere in the source code where it belongs.

## Install to phone and desktop

**iPhone / iPad (Safari):** open the URL → Share button → **Add to Home Screen** → Add. The Larder icon appears on your home screen and opens full-screen.

**Android (Chrome):** open the URL → the menu will offer **Install app**. Or Add to Home Screen.

**Mac (Chrome or Edge):** address bar will show an Install icon, or Menu → **Install Larder…**. The app gets its own icon in the Applications folder and dock.

**Windows (Chrome or Edge):** same — address bar Install icon, or Menu → Apps → Install this site as an app.

Once installed, it behaves like a native app — its own window, its own dock entry, no browser chrome.

## Costs

Roughly, with Claude Haiku 4.5 (this app's model):
- A nutrition lookup uses about 250 input + 200 output tokens → **~$0.0013 each**.
- A weekly FODMAP review uses about 400 input + 600 output tokens → **~$0.0034 each**.

Tracking ~5 foods a day and one weekly review: **under $0.25 per month**. $5 of credit will last you a year of heavy use.

## Sync across devices (Google Sheets)

Larder can sync your log to a Google Sheet so your phone and laptop stay in step — and the Sheet itself becomes your spreadsheet view. Setup takes about ten minutes the first time, then it's automatic.

The piece that does the work is a small Google Apps Script (`apps-script.gs` in this folder) that turns one of your Google Sheets into a tiny JSON API. Larder reads from and writes to that endpoint.

**One-time setup:**

1. **Create a Google Sheet.** Visit [sheets.new](https://sheets.new) and name it something like `Larder Log`. You don't need to add columns — the script does that on first run.
2. **Open the Apps Script editor.** In the Sheet, go to **Extensions → Apps Script**. A new tab opens with a code editor.
3. **Paste the script.** Delete whatever's in the default `Code.gs` file and paste in the entire contents of `apps-script.gs` from this repo. Click the disk icon to save (or `Cmd/Ctrl + S`).
4. **Deploy as a web app.** Click **Deploy → New deployment**. Click the gear icon next to "Select type" and pick **Web app**. In the form:
   - **Description:** anything, e.g. `larder-sync`
   - **Execute as:** Me
   - **Who has access:** Anyone
5. Click **Deploy**. Google will ask you to authorize the script — click **Authorize access**, pick your Google account, then on the "Google hasn't verified this app" screen click **Advanced → Go to [your project name] (unsafe)**, then **Allow**. (This is normal for personal scripts you own.)
6. Google shows a **Web app URL** — it looks like `https://script.google.com/macros/s/AKfycb…/exec`. **Copy it.**
7. **Open Larder → Settings → Sync to Google Sheets**, paste the URL, hit **Save & sync**. Any entries already on this device will upload to the Sheet, and the Sheet's contents come back down.
8. Repeat step 7 on every other device — same URL.

**Treat the URL like a password.** Whoever has it can read and write your Sheet. Don't commit it into your GitHub repo, don't paste it into chat threads, don't put it in screenshots.

**When you change the Apps Script code**, you need to redeploy: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. This keeps the same URL.

## Data and privacy

Without sync, everything — food log, reviews, API key, sync URL — lives in this device's localStorage. Clearing browser data for the site erases the local copy.

With sync on, your entries also live in your Google Sheet. The Sheet is in your own Google account; nobody else (including me, Anthropic, or the Sheets-as-database vendor) can read it. The Larder app sends only:
- To Anthropic: the food name and portion you type, on each nutrition lookup
- To your Apps Script URL: each entry's fields when added / deleted

That's it. Your API key stays on the device.

## Updating the app later

Push new files to the repo. The service worker will pick up the new version on next load (may take one refresh because of caching). To force a refresh: open the deployed URL with `?v=2` or similar to bypass the cache, or bump the `CACHE` constant in `sw.js`.

## Troubleshooting

**"API key was rejected"** — your key is wrong, missing, or has no credit. Open console.anthropic.com → Billing.

**"Couldn't reach Anthropic"** — usually a network issue, or you're testing the file by opening it directly from disk. Lookups don't work over `file://` — you need it hosted (GitHub Pages, or run a local server like `python3 -m http.server`).

**"Sheet GET/POST failed (401 / 403)"** — the Apps Script deployment access level isn't right. Re-deploy with **Who has access: Anyone**, and re-authorize.

**"Sheet GET failed (302)"** or HTML coming back instead of JSON — usually means you pasted the `/dev` URL by mistake instead of the deployed `/exec` URL. Get the right one from **Manage deployments**.

**Apps Script changes don't seem to take effect** — you forgot to redeploy. Each code change needs **Manage deployments → pencil → New version → Deploy**.

**The app installs but won't open offline** — service workers need at least one online load to register. Visit the URL once while online, then it'll work offline.

**Looks broken on first load** — Babel compiles the JSX in-browser on first paint, which takes ~200ms. After that it's instant.
