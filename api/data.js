// Vercel serverless function — fetches the two Google Sheets workbooks live
// (public "gviz" CSV export per tab, no API key needed since both files are
// shared as "Anyone with the link: Viewer") and returns the same
// { people, teamTotal, month, year } shape per team that the front-end's
// achievement/rendering code already expects.
import { parsePersonTab, MONTHS_FR } from "../lib/parse.mjs";

const FILE_IDS = {
  closing: "1dBC-D7LpWvneIzTYO984KmJzE5-T7yud5tbIU5Pcl84",
  setting: "1MLM1g1vTUMRytM7qqKrt_cKNaVFE7bc23R3zpGaq1wo"
};

// tab name -> display name shown on the card
const CLOSING_TABS = {
  "CHLOÉ": "Chloé", "EMILIE": "Émilie", "IBTISSEM": "Ibtissem", "MANON": "Manon",
  "TALYN": "Talyn", "ALEXANDRA": "Alexandra", "MANON D": "Manon D", "JADE": "Jade",
  "VANESSA": "Vanessa"
};
const SETTING_TABS = {
  "ALEX": "Alexandra", "ANISSA": "Anissa", "JOEY-": "Joey", "LOU": "Lou",
  "LILOU": "Lilou", "SONIA": "Sonia", "MOUNIT": "Mounit"
};

const MONTH_DISPLAY = {
  JANVIER: "Janvier", FEVRIER: "Février", MARS: "Mars", AVRIL: "Avril",
  MAI: "Mai", JUIN: "Juin", JUILLET: "Juillet", AOUT: "Août",
  SEPTEMBRE: "Septembre", OCTOBRE: "Octobre", NOVEMBRE: "Novembre", DECEMBRE: "Décembre"
};

function currentMonthYear() {
  const now = new Date();
  return { name: MONTHS_FR[now.getUTCMonth()].toUpperCase(), year: String(now.getUTCFullYear()) };
}

async function fetchTabCSV(fileId, tab) {
  const url = "https://docs.google.com/spreadsheets/d/" + fileId +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(tab);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Sheet fetch failed for tab " + tab + ": HTTP " + res.status);
  return res.text();
}

async function buildTeamResult(fileId, tabMap, kind, nowMonthName, nowYear) {
  const entries = Object.entries(tabMap);
  const settled = await Promise.allSettled(
    entries.map(([tab]) => fetchTabCSV(fileId, tab))
  );

  const people = [];
  let latestMonthSeen = null; // most common / most recent month label actually used

  settled.forEach((outcome, i) => {
    const [tab, displayName] = entries[i];
    if (outcome.status !== "fulfilled") return;
    const stats = parsePersonTab(outcome.value, kind, nowMonthName);
    if (!stats) return;
    if (stats.totalCloses > 0) {
      people.push({
        name: displayName,
        totalCloses: stats.totalCloses,
        presence: stats.presence,
        closingRate: stats.closingRate,
        rdv: stats.rdv,
        montantGenere: kind === "closing" ? stats.montantGenere : undefined
      });
    }
    // Track whichever month label shows up (prefer the real current month if
    // any tab has it — falls back to whatever the majority of tabs report).
    if (stats.month === nowMonthName) latestMonthSeen = nowMonthName;
    else if (!latestMonthSeen) latestMonthSeen = stats.month;
  });

  people.sort((a, b) => b.totalCloses - a.totalCloses);
  const teamTotal = people.reduce((s, p) => s + p.totalCloses, 0);
  const monthKey = latestMonthSeen || nowMonthName;

  return {
    people: people,
    teamTotal: teamTotal,
    month: MONTH_DISPLAY[monthKey] || monthKey,
    year: nowYear
  };
}

export default async function handler(req, res) {
  try {
    const { name: nowMonthName, year: nowYear } = currentMonthYear();
    const [closing, setting] = await Promise.all([
      buildTeamResult(FILE_IDS.closing, CLOSING_TABS, "closing", nowMonthName, nowYear),
      buildTeamResult(FILE_IDS.setting, SETTING_TABS, "setting", nowMonthName, nowYear)
    ]);
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
    res.status(200).json({ closing, setting });
  } catch (err) {
    res.status(500).json({ error: String(err && err.message || err) });
  }
}
