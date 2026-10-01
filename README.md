# The Daily Brew — order-ahead + Brew Streak loyalty

A static web app (no server, no build step) for a café: customers order and track orders, and earn **Brew Streak** loyalty. Staff run the queue and see pilot results.

| Page | Who | What |
|---|---|---|
| `index.html` | Customers | Menu, cart, checkout, order tracking, Rewards (streak, stamps, 4-week calendar, Daily Brew Pass) |
| `staff.html` | Staff | Order queue (NEW → PREPARING → READY → COMPLETED), pilot KPIs, member list, CSV export |

## How the loyalty works
- **1 stamp per day ordered, whatever the spend.** 8 stamps = 1 free drink (up to RM 10.50).
- **Streak** = consecutive order-days. One missed day per 7 days is forgiven.
- **Order my usual**: the last order rebuilt in one tap.
- **Daily Brew Pass**: RM 99 prepaid, covers one drink per day for 30 days.

Every number above is set in `content.js` (`loyalty`, `pass`, product `pass01`).

## Running the MVP pilot (counter-tablet setup)
Data is stored **in the browser of the device** (localStorage). There is no shared database yet, so run the pilot on **one counter tablet**:

1. In `content.js`, set `kioskMode: true` (each customer's number is forgotten after their order) and update `business`, `products` and prices.
2. Add product photos to `images/` (`coffee.jpg`, `tea.jpg`, `pastries.jpg`, `snacks.jpg`, `cold.jpg`, `pass.jpg`), or leave them out for plain tiles.
3. Host the folder (GitHub Pages, Vercel or Netlify, all free for static sites) or open `index.html` directly on the tablet.
4. On the tablet, open `index.html` in one tab and `staff.html` in another. New orders appear in the staff queue automatically.
5. Payment is taken at the counter as normal. The app only records the method.
6. At the end of each week, open **Staff → Pilot results → Download orders / members (CSV)** and keep the files. Clearing the browser data erases everything.

## What to measure
- **Repeat rate**: % of members who came back on a 2nd day. This is the main signal.
- **Active streaks**: members currently on 2+ consecutive order-days.
- **Visits per member**, **passes sold**, and **perks given** (the cost of the program).

Compare the first two weeks against the last two.

## Files
`content.js` (all editable content and rules) · `loyalty.js` (shared storage, dates, streak/stamp/pass logic) · `script.js` (customer page) · `staff.js` (staff page) · `style.css`

## Claude Code: VOICE writing workflow
This repo also carries a Claude Code skill that turns a topic or rough draft into writing that doesn't read as AI-made. Type `/voice <topic or path to draft>` in Claude Code.

| Stage | What it does | Runs as |
|---|---|---|
| **O** Owned | Interviews you one question at a time for 5 personal details before writing | Main conversation |
| **I** Insightful | "Most people believe X / I believe Y / the difference is Z", then a skeptic asks "So what?" | `voice-insight` + you |
| **V** Verified | Extracts every claim and checks it against primary sources | `voice-verifier` |
| **C** Clear | 9-year-old restatement, jargon swaps, heavy sentences | `voice-clarity` |
| **E** Engaging | Strips AI tells and fluff, stronger hook and closing; you sign off | `voice-engagement` + you |

Single stages: `/voice verify <draft>`, `/voice interview <topic>`, `/voice redteam <thesis>`, `/voice clarify <draft>`, `/voice engage <draft>`.
Files: `.claude/skills/voice/` (workflow, interview bank, AI-tells list, register profiles) and `.claude/agents/voice-*.md`. Working drafts go to `voice-work/` (git-ignored).
