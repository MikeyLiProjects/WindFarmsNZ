# NZ Wind Farm Strong Wind Analysis

Find periods when NZ wind farms experience strong winds (60+ km/h for 6+ hours).

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open http://localhost:3000/strong-wind-periods

## What it does

-   Analyzes 15 NZ wind farms for strong wind periods
-   Finds times when wind speed ≥60 km/h at 100m height for 6+ hours
-   If any farm has strong winds, counts as NZ-wide strong wind period
-   Shows average wind speeds during these periods
