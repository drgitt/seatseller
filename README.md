# SeatSeller

An Android app for season-ticket holders who want to know **when to sell**. It tracks resale prices for your seats across every home game, for more than one team and venue, and tells you what to do about each game.

Built with Capacitor (web UI) plus native Android code for notifications, reminders, calendar, backup and the home-screen widget. Every push to `main` builds `SeatSeller.apk` in GitHub Actions and attaches it to the latest release.

**Install:** open the latest release on your phone, download `SeatSeller.apk`, allow installs from your browser when Android asks, and open it. New builds install over the old one and keep your data.

---

## Everything the app does

### Core tracking
- **Every home game, nearest first.** Games this week, next week and the week after are enlarged and colour-coded (red, amber, blue). How many weeks to highlight is a setting.
- **Sell button** on every game opens Ticketmaster's account page, with links to search Ticketmaster, StubHub, SeatGeek and Vivid Seats for that exact game.
- **Prices in your section.** Type the seats listed, low and high price for your rows. The app compares your low to face value.
- **Market low per game** (Wizards): the cheapest seat in the arena from TickPick, refreshed daily.
- **Selling fast** tag when your listed seats drop sharply in a week, the market low jumps, or a marketplace shows low inventory. The percentages are settings.
- **Summary tiles:** next game, games this week, selling-fast count, best logged low.

### Multiple teams and venues
- **Team pull-down** at the top lists every team you hold seats for.
- **Add Team / Venue** at the bottom of the pull-down. Pick the league, start typing the team, and the venue fills in from a built-in list (NBA, NHL, NFL, MLB, WNBA and some MLS). If the team isn't listed it tries an online sports database, and if that finds nothing you type the venue yourself. The venue is always editable.
- Enter your seats and optional face value, and optionally paste the home schedule (one game per line: `2026-11-05 Boston Bruins` or `11/12/2026 Toronto Maple Leafs | Rivalry night`).
- **Add games** later, one at a time or by pasting a list. Added games can be removed.
- Each team keeps its own seats, face value, games, prices and sales.

### Settings (gear icon)
Team venue, seats, face value, seats owned and profit-split partner; theme (phone default, light, dark); weeks to highlight; default view; sort order; selling-fast thresholds; price-spike threshold; weather flags; where you usually sell and each marketplace's fee; reminder timing; calendar; backup; notification status, test and manual price check; clear prices; remove a team.

### Splash screen
A navy ticket splash shows while the app loads and stays for at least one second. It leaves when both prices have loaded and one second has passed, whichever is slower, with an 8-second safety limit so a stalled network can't trap you.

### Records and rivals
- Each card shows **both teams' records** (for example `Wizards 12-8 · Bucks 14-6`), refreshed daily from league standings.
- A **Division rival** tag marks games against teams in your team's division (NBA, NHL, NFL and MLB, including teams you add).

### Notifications and reminders
- **Alerts** from the daily price check arrive as phone notifications (about every 3 hours the app checks for new ones).
- **List-by reminder:** notification N days before each game (default 3, 0 turns it off).
- **Last call:** notification at 9 AM on game day.
- Reminders skip games you marked sold. The schedule has no tip-off times, so they fire at 9 AM. Android may deliver them a few minutes late.
- **Schedule-change alerts:** if a game moves, its card says "Moved from [date]" and you get a notification.

### Profit, fees and tax
- **Mark sold, with partial sales:** sell one seat now and the other later. Each game tracks seats owned, sold and left, shows each sale as its own tag, and offers **Sell remaining** until all seats are gone. Advice and reminders keep working for the seats you still hold.
- **Actual payout field:** type what Ticketmaster really paid you. The app works out the true fee and learns it for next time.
- **Ticketmaster is the default marketplace.**
- **Seller fees:** editable fee per marketplace (Ticketmaster, StubHub, SeatGeek, Vivid Seats, TickPick, Other). Cards show what your low would net after fees. The defaults are estimates, so set your real fees.
- **Profit screen:** season totals across all teams, net after fees, profit after face value, per-game table.
- **Tax summary:** export a CSV of sales, fees and profit for a calendar year to Google Drive or any folder. It is a record for you and your accountant, not tax advice.
- **Renewal planner:** per team, the season's face cost against what you sold, net cost per game you kept, and sales made below face.
- **Sold too early or late:** log the price of the same seats a day after you sold. The app shows what you left on the table. It reminds you after 24 hours.
- **Partner split:** name a partner and their share of profit. The profit screen shows what they're owed, and **Share summary** sends a text summary through any app.

### Calendar, asking price, optional market data
- **Calendar button** on each game opens a chooser: Phone calendar, Google Calendar (web link), or a downloadable calendar file. Events run **7 PM to 10 PM** on game day (start hour is a setting).
- **Ticketmaster calendar:** the Phone calendar option files the event directly into the phone calendar whose name or account contains "Ticketmaster" (changeable in Settings; falls back to your primary calendar and says so). Google's web link cannot choose a calendar, so it lands in your default one.
- **Asking price:** each game has an Asking $ box for the price you are trying to sell at. It shows as a tag with what it nets after fees, pre-fills Mark sold, and drives the Sell queue and digest. The weekly check has it too.
- **Market low and Ticketmaster info are optional:** Settings → your team → uncheck "Show market low and Ticketmaster price info" and the app uses only the prices you enter. No market lows, spike or alert banners, or stale warning.
- The List helper button was removed.

### Sold checkbox and vendor prices
- **Sold checkbox** on every game card. Checking it opens the sale form (seats, price, payout) so profit stays accurate; unchecking removes the sale after a confirmation. Partial sales show as "Fully sold" once all seats are gone.
- **Vendor prices:** each card has a Vendor prices section with its own Low and High line for Ticketmaster, StubHub, SeatGeek, Vivid Seats and TickPick, what each nets after its fee, and which vendor nets the most. If you leave your own section Low blank, the cheapest vendor low is used for advice.
- **Notification diagnostics:** Settings → Test alarm (1 min) schedules a real alarm so you can close the app and see if it arrives. The self-test reports the last notification posted, the last alarm that fired, blocked channels, battery restrictions and exact-alarm access. Alarms are exact-time where Android allows.

### Vendor links
- The vendor names next to the Low/High boxes are the links (Ticketmaster, StubHub, SeatGeek, Vivid Seats, TickPick); there is no separate link row. The Sold checkbox, Mark sold and Calendar share one line above them.
- Vivid Seats and TickPick open the exact game when the feed has its link (`links` in `data/prices.json`, filled for the games those sites currently list). Otherwise they open the Wizards team page on that site. Other teams open that site's search.

### Roll-ups
- Each ticket seller line has Asking, Low and High boxes. The top row of each card is rolled up from them: Low is the lowest seller low, High is the highest seller high, and the middle box shows the range of seller asking prices (lowest ask - highest ask).
- The game notes box shows the game's note, plus the best-net line: which seller nets the most at the current lowest low. It updates whenever the lowest low changes.
- The Ticket sellers section is collapsible and stays open or closed as you leave it, even while you type.

### Live records
- Team records (yours and each opponent shown) refresh from ESPN standings the first time the app opens each day, and again if you return to it on a new day. If the refresh fails, it keeps the last good numbers and tries again next time you open it. NBA, NFL, NHL, MLB and WNBA are supported.

### Selling workflow
- **Profit target:** set the margin over face you want (default 10%). Advice thresholds follow it.
- **Sell queue:** ranks games by the profit you would pocket after fees on the seats you still own.
- **Weekly check:** a guided walk through the next few weeks of games, one at a time. Type your section's low and seats listed, with a Ticketmaster link for each. About a minute.
- **First-run setup:** the first launch asks for face value, seats owned, profit target and digest.
- **Reliable reminders:** the daily digest and a weekly check reminder (default Sunday 10 AM) are their own alarms that re-arm themselves each time, restore after reboot or an app update, and don't depend on the background price check. Settings → Allow background activity opens Android's battery screen; set SeatSeller to Unrestricted so Android doesn't delay them. The self-test shows the next scheduled digest and weekly reminder.
- **Daily digest:** one morning notification (hour is a setting) with sell candidates, next game, and price alerts, instead of separate alerts. Turn off in settings to get alerts as they come. **Send digest now** tests it.
- **Self-test:** Settings → Notifications → Run self-test checks the schedule, price feed, face value, notifications, background check and backup.
- **Stale-data warning:** a banner appears when market prices are over 36 hours old.

### Smart guidance
- **Sell-or-hold advice** on every game. Inputs: your logged low (or the market low), seller fee, face value, days to the game, price trend, selling-fast signals, demand score and learned peak timing. Verdicts: Sell now, Consider selling, Hold a little, Hold, Sell or use, Last call, Use or take the loss. It always shows its reason.
- **Demand score (0–100)** from weekend, division rivalry, notable opponents or tags, holiday dates, and both teams' records. Sort the list by demand in settings.
- **Price-history chart** on each Wizards game: market low over time, your logged low as a dashed line, and face value as a dotted line.
- **Best-time-to-sell learning:** once about three finished games each have a few weeks of daily prices, the Profit screen shows how many days before tip-off prices usually peak, overall and for weekend and division games. The advice then uses it. Until then it says it is still collecting.
- **Price-spike alerts:** a red tag on any unsold game whose market low is well above its recent average or above face. The daily check also sends a notification.
- **Weather flags:** snow, heavy rain, high wind or bitter cold forecast for a game within 16 days, from Open-Meteo. Last-call reminders mention it.

### Everyday helpers
- **List helper:** copies the game, venue, your seats, a suggested price and your break-even price to the clipboard, then opens your usual marketplace. It cannot list for you, so you paste.
- **Calendar:** a Calendar button per game, and "Add upcoming games to my calendar" for all of them. Each is an all-day event with a list-by reminder, and running it again updates what it made. In a browser it downloads an `.ics` file instead.
- **Home-screen widget:** long-press your home screen, add the SeatSeller widget. It shows the next game, the advice and the market low, and refreshes whenever the app or the price check runs.
- **Backup:** Settings → Backup → choose a file in Google Drive and SeatSeller keeps it refreshed about once a day. Also Back up now and Restore from a file. Backups hold teams, prices, sales and settings.

---

## Your seats
Seat label is **Section 109, Row E, seats 1-2** (change it in settings).

## How the data works

- `data/prices.json` is the shared feed. A scheduled task runs every morning (7:47 AM Eastern) and updates it: market lows, price history, team records, schedule changes and alerts. The app and its background check read it from `raw.githubusercontent.com`, so **this repository must stay public**.
- Everything you type (prices, sales, teams, settings) stays on your phone and in your backup file.
- Market lows and history are the cheapest seat in the whole arena, not your section. The tool cannot see row-level prices. Type your section's low for a true read.
- Only Wizards games get automatic market lows, history, spike alerts and schedule-change checks. Other teams get records, rival tags, demand, advice from the numbers you log, weather, and all the money tools.

## What is not included, and why
- No automatic listing or buying: marketplaces don't offer that to individuals.
- No live shared link with a partner: it needs accounts and a server. Share summary and backup files cover it.
- No injury or lineup data: spike alerts say to check it yourself.
- Game times aren't in the schedule, so reminders use 9 AM.

## Repository layout
- `web/` app UI: `index.html`, `app.js`, `app.css`, `teams.js` (venue and division table), fonts, `prices.seed.json` (offline fallback)
- `android/` Capacitor project plus native code: `PriceCheckWorker` (background check), `SeatSellerPlugin` (bridge), `Reminders`/`ReminderReceiver`/`BootReceiver`, `CalendarSync`, `BackupHelper`, `WidgetProvider`
- `data/prices.json` price feed
- `.github/workflows/build-apk.yml` builds the APK on every push (data-only changes are skipped). A failed build writes its log to the `build-logs` branch.

## Building locally
```
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
```
Needs JDK 21 and the Android SDK. The debug keystore in the repo is a personal sideload key so updates install over each other, not a Play Store key.

### Private signing key (optional)
The committed key is public, so anyone could build an APK that installs over yours. To use a private key: make a keystore, then add GitHub repo secrets `KEYSTORE_BASE64` (base64 of the file), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, and optionally `KEY_PASSWORD`. The workflow uses them when present and falls back to the committed key otherwise. Switching keys means Android will make you **uninstall and reinstall once**, so make a backup first and restore after.
