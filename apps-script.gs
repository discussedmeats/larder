/* ============================================================
 * Larder Sync — Google Apps Script
 *
 * Deploy as: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 * (The deployed URL acts as the auth token — treat it like a password.)
 *
 * This script lives inside a Google Sheet. It manages two tabs:
 *   • "Larder"   — food entries
 *   • "Symptoms" — how-you-feel notes
 * Other tabs are untouched.
 *
 * Endpoints:
 *   GET   ?           → { entries: [...], symptoms: [...] }
 *   POST  action=upsert, kind=food|symptom, entry → insert/update by id
 *   POST  action=delete, kind=food|symptom, id    → remove row with that id
 *   POST  action=ping                              → { ok: true }
 * (kind defaults to "food" when omitted, for backward compatibility.)
 * ============================================================ */

const FOOD_SHEET = "Larder";
const SYMPTOM_SHEET = "Symptoms";

const FOOD_COLUMNS = [
  { key: "id",            label: "ID" },
  { key: "foodName",      label: "Food name" },
  { key: "portionSize",   label: "Portion Size" },
  { key: "grams",         label: "Weight (g)" },
  { key: "totalFat",      label: "Total Fat" },
  { key: "saturatedFat",  label: "Saturated Fat" },
  { key: "sodium",        label: "Sodium" },
  { key: "carbohydrates", label: "Carbohydrates" },
  { key: "sugars",        label: "Sugars" },
  { key: "addedSugars",   label: "Added Sugars" },
  { key: "fiber",         label: "Fiber" },
  { key: "protein",       label: "Protein" },
  { key: "calories",      label: "Calories" },
  { key: "date",          label: "Date" },
  { key: "time",          label: "Time" },
  { key: "updatedAt",     label: "Updated At" },
];

const SYMPTOM_COLUMNS = [
  { key: "id",        label: "ID" },
  { key: "date",      label: "Date" },
  { key: "time",      label: "Time" },
  { key: "score",     label: "Wellness (1-10)" },
  { key: "text",      label: "Notes" },
  { key: "updatedAt", label: "Updated At" },
];

function columnsForKind_(kind) {
  return kind === "symptom" ? SYMPTOM_COLUMNS : FOOD_COLUMNS;
}

function sheetNameForKind_(kind) {
  return kind === "symptom" ? SYMPTOM_SHEET : FOOD_SHEET;
}

function getSheet_(name, columns) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) setupSheet_(sheet, columns);
  return sheet;
}

function getSheetByKind_(kind) {
  return getSheet_(sheetNameForKind_(kind), columnsForKind_(kind));
}

function setupSheet_(sheet, columns) {
  const headerRow = columns.map(function (c) { return c.label; });
  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow])
    .setFontWeight("bold").setBackground("#f3ebdd");
  sheet.setFrozenRows(1);
  // Plain-text formatting on date/time so they round-trip as strings
  const dateIdx = findColIndex_(columns, "date");
  const timeIdx = findColIndex_(columns, "time");
  if (dateIdx > 0) sheet.getRange(2, dateIdx, sheet.getMaxRows() - 1, 1).setNumberFormat("@");
  if (timeIdx > 0) sheet.getRange(2, timeIdx, sheet.getMaxRows() - 1, 1).setNumberFormat("@");
  // Reasonable widths per sheet kind
  if (columns === FOOD_COLUMNS) {
    sheet.setColumnWidth(findColIndex_(columns, "id"), 120);
    sheet.setColumnWidth(findColIndex_(columns, "foodName"), 220);
    sheet.setColumnWidth(findColIndex_(columns, "portionSize"), 130);
  } else if (columns === SYMPTOM_COLUMNS) {
    sheet.setColumnWidth(findColIndex_(columns, "id"), 120);
    sheet.setColumnWidth(findColIndex_(columns, "text"), 380);
  }
}

function findColIndex_(columns, key) {
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].key === key) return i + 1; // 1-indexed for Sheets API
  }
  return 0;
}

function readSheet_(kind) {
  const columns = columnsForKind_(kind);
  const sheet = getSheetByKind_(kind);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, columns.length).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    const obj = {};
    for (let j = 0; j < columns.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        if (columns[j].key === "date") {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (columns[j].key === "time") {
          val = Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
        } else {
          val = val.toISOString();
        }
      }
      obj[columns[j].key] = val;
    }
    out.push(obj);
  }
  return out;
}

function doGet(e) {
  try {
    return jsonOut_({
      entries: readSheet_("food"),
      symptoms: readSheet_("symptom"),
    });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const kind = body.kind || "food";
    if (body.action === "upsert") return upsert_(body.entry, kind);
    if (body.action === "delete") return doDeleteId_(body.id, kind);
    if (body.action === "ping")   return jsonOut_({ ok: true, sheets: [FOOD_SHEET, SYMPTOM_SHEET] });
    return jsonOut_({ error: "unknown action: " + body.action });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function upsert_(entry, kind) {
  if (!entry || !entry.id) return jsonOut_({ error: "missing entry.id" });
  const columns = columnsForKind_(kind);
  const sheet = getSheetByKind_(kind);
  const rowValues = columns.map(function (c) {
    const v = entry[c.key];
    return v === undefined || v === null ? "" : v;
  });
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(entry.id)) {
        sheet.getRange(i + 2, 1, 1, rowValues.length).setValues([rowValues]);
        return jsonOut_({ ok: true, updated: true, kind: kind });
      }
    }
  }
  sheet.appendRow(rowValues);
  return jsonOut_({ ok: true, inserted: true, kind: kind });
}

function doDeleteId_(id, kind) {
  if (!id) return jsonOut_({ error: "missing id" });
  const sheet = getSheetByKind_(kind);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return jsonOut_({ ok: true, missing: true });
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return jsonOut_({ ok: true, deleted: true, kind: kind });
    }
  }
  return jsonOut_({ ok: true, missing: true });
}

function jsonOut_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
