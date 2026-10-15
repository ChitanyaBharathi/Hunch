# Hunch

A multiplayer price-guessing game. The host creates a room, friends join by name and room code, and everyone submits one private guess per product. The host reveals the stored retail price and the nearest guesses win. Equal distances share a rank; both overestimates and underestimates count.

## Run locally

```sh
npm install
npm run dev
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

This starts the Node game server on port 3001 and Vite on port 5173. Open the Network URL printed by Vite on all phones connected to the same Wi-Fi. The host computer must remain running. If a phone cannot connect, check the host's firewall and whether the Wi-Fi isolates devices.

1. Enter your name and choose **Host a game**.
2. Use **Copy invite link** or share the six-character room code with friends.
3. Friends open the same network address and choose **Join a game**.
4. Each player locks in one guess. The host reveals the price after guesses arrive; an early reveal requires confirmation and closes guessing for the round.
5. See the closest guesses, then advance to the next item. After ten rounds, view the final scores.

## Scoring and state

New games draw ten unique items from a 48-item catalog: six items each in Tech, Fashion, Home, Beauty, Food & Drink, Sports, Hobbies and Everyday. Every game covers all eight categories with a shuffled order. Existing saved rooms retain their original rounds. Draws are independent, so an item can recur in a later game.

Catalog benchmarks are illustrative SGD values; product pictures are labelled illustrations. Commercial studies must replace demo benchmarks with dated, verified prices and licensed exact-product imagery. Run `node scripts/export-catalog.js` to export the complete server-only dataset to `server/catalog.json`. Prices stay outside the frontend bundle. See `docs/commercial-plan.md` for the proposed business offering.

Round ranking is by absolute price difference. Points are rounded accuracy: `max(0, 100 * (1 - absoluteDifference / actualPrice))`, rounded to a whole number. Overall ranking uses accumulated points. Missed rounds earn zero points. Tied nearest guesses each receive a round win.

Prices are predefined demo values in `server/products.js`, not live retailer prices. The server excludes actual prices and other players' guesses from round responses until reveal. Browser sessions are remembered in localStorage. Room state persists in `.game-data/rooms.json` across server restarts. Names and submitted guesses are visible to room participants after reveal. Names must be unique within each room.

This is a local-network app, not an internet deployment. Publishing the static `dist` folder alone will not run multiplayer: a Node server and `/api` routing are required. This development setup is intended for a friendly game, not a tamper-proof competition. The host should keep their browser session until the game ends; host transfer is not implemented.

## Commercial research preview

Players can optionally opt in to aggregate pricing reports that may be sold to companies. Playing is available without research consent. Existing data is excluded; opting in affects future guesses only. Opted-in players can also answer an optional, separate maximum-pay question before price reveal. Zero means they would not buy the item.

The host's **Insights** tab reports only revealed rounds from their own room. Each product or metric needs at least five opted-in responses before publication. It shows median perceived price, interquartile range, median bias against the demo benchmark, and a stated maximum-pay median if enough optional responses exist. CSV exports include aggregate rows only. The threshold is a disclosure precaution, not guaranteed anonymity or sufficient evidence for pricing decisions. These are self-selected responses; maximum-pay answers are hypothetical and must not be presented as observed sales or estimated demand curves.

### Company research portal

Companies buying research get a pooled report across every game on the server, so rooms too small to publish alone still contribute once combined. Each buyer receives its own access key, configured on the server:

```sh
# Generate a key per company
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
# PowerShell: $env:RESEARCH_BUYER_KEYS = "acme:<key>,beta-foods:<key>"
RESEARCH_BUYER_KEYS="acme:<key>,beta-foods:<key>" npm run dev
```

Companies open `/?portal=company`, enter their key and optionally filter by category. The report adds **category price perception**: each response compared with its own product's benchmark, giving the median over/under-estimate and the stated maximum pay relative to benchmark for each category. The same consent gate, revealed-round rule and minimum-five suppression apply. API: `GET /api/research/report[.csv]?category=Tech` with `Authorization: Bearer <key>`. Player session tokens are never accepted. Every pull is appended to `.game-data/research-access.log` (buyer, time, format, category), so you can answer which companies received data. Remove a buyer from `RESEARCH_BUYER_KEYS` and restart to revoke access. With no keys configured the endpoint is disabled.

Research preferences can be changed in Profile, even after a game finishes. Withdrawal removes the player's research records from future reports in that room, but does not delete their game guesses or recall previously exported reports. Research events store submission time and consent version. Room state is local, single-server JSON storage. Before a paid launch, implement operator/customer accounts, scoped access to pooled studies, deduplicated recruitment, production storage, and a documented retention policy. Public internet deployment is separate from the local Wi-Fi setup.

## Verification

```sh
npm test
npm run build
npm run lint
```

The tests cover independent HTTP sessions, hidden guesses, nearest-price ties, duplicate names, input validation, round transitions, host authorization, scoring and restored room state. Existing unused demo components may generate lint warnings.
