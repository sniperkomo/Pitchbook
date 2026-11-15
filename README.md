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

On GitHub Pages, the app loads its starting records from `public-records.json`. The GitHub repository and Pages site are public, so anyone can view the published athlete profiles, lesson schedule and history, and payment status. The current import contains 4 athlete records, 6 lessons, and 2 packages.

Changes made in the app are saved to the current browser’s local storage. They do not sync to other browsers or update the public records file. Use Export backup to save a copy of browser changes; publishing new shared records requires updating `public-records.json` in the repository. The athlete portal is a view of the same records and does not have sign-in or access controls.
