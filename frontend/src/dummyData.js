// /src/dummyData.js
// Generates dummy master/detail data (apps + activity_logs) over the last N days,
// and provides a helper to build the flat activities array expected by the frontend.

// ---- Config ----
const DAYS = 30; // number of days to generate (change to 60/90 if you want longer)
const END_DATE = new Date(); // last day (today)
const MAX_DAILY_SECONDS = 4 * 3600; // up to 4 hours per app per day
const RANDOM_SEED = 12345; // deterministic seed for reproducible dummy data

// ---- Simple seeded RNG (LCG) for repeatability ----
function makeRng(seed = RANDOM_SEED) {
  let s = seed >>> 0;
  return function () {
    // Park-Miller LCG variant
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rng = makeRng(RANDOM_SEED);

// ---- Master apps (sample master records) ----
// You can edit/add entries here. These represent UNIQUE (user_id, app_name, window_title)
export const dummyApps = [
  { id: 1, user_id: "Alice",   app_name: "chrome.exe", window_title: "YouTube" },
  { id: 2, user_id: "Bob",     app_name: "chrome.exe", window_title: "YouTube" },
  { id: 3, user_id: "Charlie", app_name: "chrome.exe", window_title: "YouTube" },
  { id: 4, user_id: "Alice",   app_name: "Code.exe",   window_title: "Project Tracker" },
  { id: 5, user_id: "Bob",     app_name: "Code.exe",   window_title: "Project Tracker" },
  { id: 6, user_id: "Alice",   app_name: "slack.exe",  window_title: "Team Chat" },
  { id: 7, user_id: "Charlie", app_name: "slack.exe",  window_title: "Team Chat" },
  { id: 8, user_id: "Bob",     app_name: "spotify.exe",window_title: "Music" },
  { id: 9, user_id: "Dana",    app_name: "Figma.exe",  window_title: "Design" },
  { id:10, user_id: "Eve",     app_name: "zoom.exe",   window_title: "Meetings" },
];

// ---- Helper: produce YYYY-MM-DD string from a Date object ----
function toYMD(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---- Generate logs ----
export function generateDummyActivityLogs({ days = DAYS, endDate = END_DATE } = {}) {
  const logs = [];
  let idCounter = 1;

  // generate list of dates from (endDate - days + 1) to endDate inclusive
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(endDate);
    dt.setDate(endDate.getDate() - i);
    dates.push(toYMD(dt));
  }

  // For realistic behavior, give each app a base probability it is used on a given day
  // and a user-specific bias to make "top users" emerge.
  const baseProbByApp = {}; // app_id -> base probability
  const userBias = {}; // app_id -> { user_id -> multiplier }

  dummyApps.forEach((app) => {
    // base probability between 30% and 85%
    baseProbByApp[app.id] = 0.3 + rng() * 0.55;

    // create small bias map: some users are more active on some apps
    userBias[app.id] = {};
    // give primary user (matching app.user_id) a slight boost
    dummyApps.forEach((maybeUserApp) => {
      // if same app_name/window_title but different user, create a small presence too
      if (maybeUserApp.app_name === app.app_name && maybeUserApp.window_title === app.window_title) {
        userBias[app.id][maybeUserApp.user_id] = 0.6 + rng() * 0.9; // 0.6-1.5 multiplier
      }
    });
  });

  // For each date and each app master entry, decide whether there's activity and how much
  for (const date of dates) {
    for (const app of dummyApps) {
      const prob = baseProbByApp[app.id];
      // small day-of-week effect: weekends slightly lower for work apps
      const dow = new Date(date).getDay(); // 0 Sun ... 6 Sat
      let dayFactor = 1.0;
      if (dow === 0 || dow === 6) {
        // weekend: reduce work-related apps (Code, Slack, Zoom) a bit
        if (["Code.exe", "slack.exe", "zoom.exe", "Figma.exe"].includes(app.app_name)) {
          dayFactor = 0.4 + rng() * 0.6; // 0.4-1.0
        } else {
          dayFactor = 0.7 + rng() * 0.6;
        }
      } else {
        dayFactor = 0.9 + rng() * 0.3; // 0.9-1.2
      }

      // Decide whether this app (master row) has any usage this day.
      const useToday = rng() < (prob * dayFactor);

      if (!useToday) continue;

      // Determine duration total for this app on that date distributed across users that have that app
      // We'll find all master rows with same app_name/window_title to distribute across users.
      const sameAppMasters = dummyApps.filter(
        (a) => a.app_name === app.app_name && a.window_title === app.window_title
      );

      // Total seconds for that app on that date (0.5 * MAX to MAX on average)
      const baseDur = Math.round((0.25 + rng() * 0.75) * MAX_DAILY_SECONDS);

      // Split across users present in sameAppMasters using bias weights
      const weights = sameAppMasters.map((m) => userBias[app.id][m.user_id] || (0.5 + rng()));
      const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

      sameAppMasters.forEach((m, idx) => {
        // user share proportion
        const share = weights[idx] / weightSum;
        // noise
        const noise = 0.6 + rng() * 1.2; // 0.6 - 1.8
        const dur = Math.round(baseDur * share * noise);

        if (dur <= 0) return;

        logs.push({
          id: idCounter++,
          app_id: m.id,
          activity_date: date,
          duration: dur,
        });
      });
    }
  }

  // aggregate logs by (app_id, activity_date) in case duplicates exist
  const aggregated = {};
  for (const log of logs) {
    const key = `${log.app_id}||${log.activity_date}`;
    if (!aggregated[key]) aggregated[key] = { ...log };
    else aggregated[key].duration += log.duration;
  }

  return Object.values(aggregated).map((l, i) => ({ id: i + 1, ...l }));
}

// ---- Build the flat activities array that the frontend expects ----
export function buildDummyActivities(opts = { days: DAYS }) {
  const logs = generateDummyActivityLogs({ days: opts.days, endDate: END_DATE });
  const activities = [];

  for (const log of logs) {
    const app = dummyApps.find((a) => a.id === log.app_id);
    if (!app) continue;
    // attach a time in the middle of the day to make timestamp parsable
    const timestamp = `${log.activity_date}T09:00:00Z`;
    activities.push({
      id: `${log.app_id}-${log.activity_date}`,
      user_id: app.user_id,
      app_name: app.app_name,
      window_title: app.window_title,
      duration: log.duration,
      timestamp,
    });
  }

  // sort newest first (helpful for UI)
  activities.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  return activities;
}

// convenience exports for direct usage
export const dummyActivityLogs = generateDummyActivityLogs();
export const dummyActivities = buildDummyActivities();
