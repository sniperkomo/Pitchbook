# Pitchbook

A lightweight lesson scheduler and athlete progress tracker for a pitching coach.

## Run it

From this folder, run `python3 -m http.server 8000`, then open `http://localhost:8000` in a modern browser. Stop the server with Ctrl+C. The app has no build step or package installation.

## What it tracks

- 30-minute lessons, with a weekly calendar, athlete, status, and lesson notes.
- Past-dated lessons are marked completed automatically, so logging a completed session from an earlier date applies its package credit.
- The $60 single lesson, $200 four-lesson package, and $400 eight-lesson package.
- Package payments and remaining credits. A package credit is used when its lesson is marked completed.
- Unpaid single lessons and unpaid packages in the Payments view.
- Athlete profiles and a portal-style view of each athlete’s completed lesson notes.
- JSON backup export and import from the left navigation.

## Data and athlete portals

Records are stored in this browser’s local storage. Export a backup regularly if you want an extra copy. The athlete portal is currently a preview using the same browser data; sharing it with families from another device requires hosted storage and secure sign-in, which this local version does not provide.
