// Shared parsing helpers for reading team-member tabs exported live from
// Google Sheets via the public "gviz" CSV endpoint (no API key needed —
// the two workbooks are shared as "Anyone with the link: Viewer").

export const MONTHS_FR = [
  "JANVIER", "FEVRIER", "MARS", "AVRIL", "MAI", "JUIN",
  "JUILLET", "AOUT", "SEPTEMBRE", "OCTOBRE", "NOVEMBRE", "DECEMBRE"
];

export function stripAccents(s) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normHeader(cell) {
  return stripAccents((cell || "").trim()).toLowerCase().replace(/\s+/g, " ");
}

// The Montant genere column can render a stray %-formatted glitch value
// for a barely-started current month instead of a clean currency figure —
// treat anything containing % here as no data yet, not a real amount.
export function parseMontant(raw) {
  var s = String(raw || "");
  if (s.indexOf("%") !== -1) return 0;
  return parseNum(raw);
}

export function parseNum(raw) {
  if (raw == null) return 0;
  var s = String(raw).replace(/#REF!/gi, "");
  s = s.replace(/[€%\s]/g, "").replace(",", ".").trim();
  if (s === "" || s === "/" || s === "-") return 0;
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Minimal RFC4180 CSV parser (handles quoted fields, embedded commas,
// escaped double-quotes, and embedded newlines inside quoted cells —
// Google Sheets cell text in this workbook does contain literal newlines).
export function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip, \n handles line breaks */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function findCol(header, test) {
  for (var i = 0; i < header.length; i++) {
    if (test(normHeader(header[i]))) return i;
  }
  return -1;
}

// Extracts the ordered list of month names embedded in the tab's merged
// header cell (e.g. "JOUR JANVIER FÉVRIER MARS AVRIL MAI JUIN JUILLET AOUT
// CHLOE" -> ["JANVIER", "FEVRIER", ..., "AOUT"]). Different tabs can list a
// different number of months depending on when their "Août" column etc.
// was added, so this is read fresh per tab rather than assumed fixed.
function extractMonthList(headerCell) {
  var up = stripAccents(headerCell || "").toUpperCase();
  var found = [];
  MONTHS_FR.forEach(function (m) {
    if (new RegExp("\\b" + m + "\\b").test(up)) found.push(m);
  });
  // MONTHS_FR is already in calendar order, and regex membership doesn't
  // tell us the header's actual left-to-right order, but this workbook
  // always lists them in calendar order starting from janvier, so this is
  // equivalent to reading them in appearance order.
  return found;
}

// Parses one person's tab (closing or setting) and returns their stats for
// the most relevant available month: the current calendar month if the tab
// already has a column for it, otherwise the most recent month it does have.
export function parsePersonTab(csvText, kind, nowMonthName) {
  var rows = parseCSV(csvText).filter(function (r) { return r.length > 1; });
  if (rows.length < 2) return null;
  var header = rows[0];
  var monthList = extractMonthList(header[0]);
  if (monthList.length === 0) return null;

  var idxTotal = findCol(header, function (h) { return h === "total closes"; });
  var idxPresence = findCol(header, function (h) { return h === "% presence"; });
  var idxMontant = findCol(header, function (h) { return h.indexOf("montant genere") !== -1; });
  var idxClosingRate = findCol(header, function (h) { return h === "% closing"; });
  var idxConversion = findCol(header, function (h) { return h.indexOf("conversion") !== -1; });
  var idxRdv = findCol(header, function (h) { return h.indexOf("rdv") !== -1 && h.indexOf("booke") !== -1; });
  if (idxRdv === -1) idxRdv = findCol(header, function (h) { return h.indexOf("rdv") !== -1; });

  // find the last day-row (col0 matches DD/MM/YYYY), then the trailing block
  // of "no-date" rows right after it are the per-month summary rows, one per
  // entry in monthList, in the same order.
  var lastDayRowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test((rows[i][0] || "").trim())) lastDayRowIdx = i;
  }
  if (lastDayRowIdx === -1) return null;

  var summaryRows = [];
  for (var j = lastDayRowIdx + 1; j < rows.length && summaryRows.length < monthList.length; j++) {
    if ((rows[j][0] || "").trim() === "") summaryRows.push(rows[j]);
    else break;
  }
  if (summaryRows.length === 0) return null;

  // prefer the row matching the real current month if the tab already has
  // that column; otherwise fall back to the tab's most recent month.
  var wantIdx = monthList.indexOf(stripAccents(nowMonthName || "").toUpperCase());
  var rowIdx = (wantIdx !== -1 && wantIdx < summaryRows.length) ? wantIdx : summaryRows.length - 1;
  var monthLabel = monthList[rowIdx];
  var row = summaryRows[rowIdx];

  return {
    month: monthLabel,
    totalCloses: idxTotal !== -1 ? parseNum(row[idxTotal]) : 0,
    presence: idxPresence !== -1 ? parseNum(row[idxPresence]) : null,
    closingRate: idxClosingRate !== -1 ? parseNum(row[idxClosingRate]) : (idxConversion !== -1 ? parseNum(row[idxConversion]) : null),
    montantGenere: idxMontant !== -1 ? parseMontant(row[idxMontant]) : null,
    rdv: idxRdv !== -1 ? parseNum(row[idxRdv]) : null
  };
}
