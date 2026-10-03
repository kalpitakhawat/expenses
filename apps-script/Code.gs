/**
 * Expense tracker — Google Sheets backend.
 *
 * Setup (one time):
 * 1. Create a Google Sheet. Extensions → Apps Script.
 * 2. Replace the sample code with this file and save.
 * 3. Reload the spreadsheet. Use the menu: Expense tracker → Set up sheets.
 *    Approve the permission prompt (the script only touches this spreadsheet).
 * 4. Deploy → New deployment → gear → Web app.
 *    Execute as: Me
 *    Who has access: Anyone
 * 5. Copy the web app URL (it ends in /exec) and the API token into the app.
 * 6. If you edit this script later: Deploy → Manage deployments → pencil →
 *    Version: New version → Deploy. The URL stays the same.
 *
 * The web app is public, but every request must include the API token.
 * Runtime: V8 (the Apps Script default).
 */

var SHEETS = {
  Events: ['id', 'name', 'note', 'budget', 'createdAt', 'archived'],
  Categories: ['id', 'name', 'archived'],
  Expenses: ['id', 'eventId', 'categoryId', 'title', 'note', 'amount', 'date', 'createdAt'],
};

var DEFAULT_CATEGORIES = [
  'Food',
  'Stay',
  'Travel',
  'Transport',
  'Decor',
  'Maintenance',
  'Furniture',
  'Shopping',
  'Utilities',
  'Medical',
  'Other',
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Expense tracker')
    .addItem('Set up sheets', 'setup')
    .addItem('Show API token', 'showToken')
    .addToUi();
}

function setup() {
  ensureSheets_();
  writeSetupSheet_();
  showToken();
}

function showToken() {
  ensureSheets_();
  var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  writeSetupSheet_();
  SpreadsheetApp.getUi().alert(
    'API token',
    token + '\n\nIt is also in the Setup tab, cell B2. Paste it into the app with the web app URL.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function doGet(e) {
  var callback = sanitizeCallback_(e && e.parameter ? e.parameter.callback : '');
  var result;
  try {
    var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    var given = e && e.parameter ? String(e.parameter.token || '') : '';
    if (!token || given !== token) {
      result = {
        error: 'Unauthorized. In the spreadsheet, open Expense tracker → Set up sheets, then paste that API token.',
      };
    } else {
      var payload = {};
      if (e.parameter.payload) payload = JSON.parse(e.parameter.payload);
      result = handle_(String(e.parameter.action || 'load'), payload || {});
    }
  } catch (err) {
    result = { error: String(err && err.message ? err.message : err) };
  }
  var body = callback + '(' + JSON.stringify(result).replace(/</g, '\\u003c') + ')';
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function handle_(action, payload) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Sheet is busy. Try again.');
  try {
    ensureSheets_();
    if (action === 'load') return snapshot_();
    if (action === 'saveEvent') {
      saveEvent_(payload);
      return snapshot_();
    }
    if (action === 'deleteEvent') {
      deleteEvent_(payload);
      return snapshot_();
    }
    if (action === 'saveCategory') {
      saveCategory_(payload);
      return snapshot_();
    }
    if (action === 'deleteCategory') {
      deleteCategory_(payload);
      return snapshot_();
    }
    if (action === 'saveExpense') {
      saveExpense_(payload);
      return snapshot_();
    }
    if (action === 'deleteExpense') {
      deleteExpense_(payload);
      return snapshot_();
    }
    throw new Error('Unknown action.');
  } finally {
    lock.releaseLock();
  }
}

function ensureSheets_() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('API_TOKEN')) {
    props.setProperty('API_TOKEN', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  Object.keys(SHEETS).forEach(function (name) {
    var sh = getOrCreate_(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, sh.getMaxRows(), SHEETS[name].length).setNumberFormat('@');
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, SHEETS[name].length).setFontWeight('bold');
      if (name === 'Expenses') {
        var amountCol = SHEETS.Expenses.indexOf('amount') + 1;
        sh.getRange(1, amountCol, sh.getMaxRows(), 1).setNumberFormat('0.00');
      }
    }
  });

  var categories = SpreadsheetApp.getActive().getSheetByName('Categories');
  if (categories.getLastRow() < 2) {
    var rows = DEFAULT_CATEGORIES.map(function (name) {
      return [Utilities.getUuid(), name, 'false'];
    });
    categories.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

function writeSetupSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = getOrCreate_('Setup');
  var token = PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
  var url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (err) {
    url = '';
  }
  var rows = [
    ['Field', 'Value'],
    ['API token', token],
    ['Web app URL', url || 'Deploy as a web app (Execute as Me, access Anyone), then run Show API token again.'],
    ['Execute as', 'Me'],
    ['Who has access', 'Anyone'],
    ['After script edits', 'Manage deployments → Edit → Version: New version → Deploy'],
  ];
  sh.clear();
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1, 1, 2).setFontWeight('bold');
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 720);
  sh.setFrozenRows(1);
}

function saveEvent_(payload) {
  var name = cleanText_(payload.name, 80);
  if (!name) throw new Error('Event name is required.');
  var id = cleanText_(payload.id, 80) || Utilities.getUuid();
  var budget = payload.budget === '' || payload.budget == null ? '' : Number(payload.budget);
  if (budget !== '' && (!isFinite(budget) || budget < 0)) throw new Error('Budget must be a positive number.');
  var createdAt = cleanText_(payload.createdAt, 40) || new Date().toISOString();
  writeById_('Events', id, [
    id,
    name,
    cleanNote_(payload.note, 500),
    budget === '' ? '' : budget,
    createdAt,
    payload.archived ? 'true' : 'false',
  ]);
}

function deleteEvent_(payload) {
  var id = cleanText_(payload.id, 80);
  if (!id) throw new Error('Missing event.');
  var expenses = objects_('Expenses').filter(function (row) {
    return String(row.eventId) === id;
  });
  if (expenses.length && !payload.force) {
    throw new Error('This event still has expenses.');
  }
  expenses.forEach(function (row) {
    deleteById_('Expenses', String(row.id));
  });
  deleteById_('Events', id);
}

function saveCategory_(payload) {
  var name = cleanText_(payload.name, 40);
  if (!name) throw new Error('Category name is required.');
  var id = cleanText_(payload.id, 80) || Utilities.getUuid();
  var existing = objects_('Categories');
  var duplicate = existing.some(function (row) {
    return String(row.id) !== id && String(row.name).toLowerCase() === name.toLowerCase();
  });
  if (duplicate) throw new Error('That category already exists.');
  writeById_('Categories', id, [id, name, payload.archived ? 'true' : 'false']);
}

function deleteCategory_(payload) {
  var id = cleanText_(payload.id, 80);
  if (!id) throw new Error('Missing category.');
  var used = objects_('Expenses').some(function (row) {
    return String(row.categoryId) === id;
  });
  if (used) throw new Error('This category is used by expenses. Rename it instead.');
  deleteById_('Categories', id);
}

function saveExpense_(payload) {
  var title = cleanText_(payload.title, 120);
  if (!title) throw new Error('Title is required.');
  var amount = Number(payload.amount);
  if (!isFinite(amount) || amount === 0) throw new Error('Enter an amount other than zero.');
  amount = Math.round(amount * 100) / 100;

  var categoryId = cleanText_(payload.categoryId, 80);
  var newCategoryName = cleanText_(payload.newCategoryName, 40);
  if (newCategoryName) {
    var categories = objects_('Categories');
    var found = null;
    categories.forEach(function (row) {
      if (String(row.name).toLowerCase() === newCategoryName.toLowerCase()) found = row;
    });
    if (found) {
      categoryId = String(found.id);
    } else {
      categoryId = Utilities.getUuid();
      writeById_('Categories', categoryId, [categoryId, newCategoryName, 'false']);
    }
  }
  if (!categoryId) throw new Error('Choose a category.');
  if (!objects_('Categories').some(function (row) { return String(row.id) === categoryId; })) {
    throw new Error('That category no longer exists.');
  }

  var eventId = cleanText_(payload.eventId, 80);
  if (!eventId) throw new Error('Choose an event.');
  if (!objects_('Events').some(function (row) { return String(row.id) === eventId; })) {
    throw new Error('That event no longer exists.');
  }

  var date = cleanText_(payload.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a date.');

  var id = cleanText_(payload.id, 80) || Utilities.getUuid();
  var createdAt = cleanText_(payload.createdAt, 40) || new Date().toISOString();
  writeById_('Expenses', id, [
    id,
    eventId,
    categoryId,
    title,
    cleanNote_(payload.note, 500),
    amount,
    date,
    createdAt,
  ]);
}

function deleteExpense_(payload) {
  var id = cleanText_(payload.id, 80);
  if (!id) throw new Error('Missing expense.');
  deleteById_('Expenses', id);
}

function snapshot_() {
  var ss = SpreadsheetApp.getActive();
  return {
    spreadsheetName: ss.getName(),
    spreadsheetUrl: ss.getUrl(),
    events: objects_('Events'),
    categories: objects_('Categories'),
    expenses: objects_('Expenses'),
  };
}

function objects_(sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return [];
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    if (values[r][0] === '' || values[r][0] == null) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      obj[headers[c]] = formatCell_(headers[c], values[r][c]);
    }
    out.push(obj);
  }
  return out;
}

function formatCell_(key, value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (key === 'createdAt') return value.toISOString();
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return value;
}

function writeById_(sheetName, id, rowValues) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var finder = sh.getRange('A:A').createTextFinder(String(id)).matchEntireCell(true);
  var found = finder.findNext();
  var rowIndex = found ? found.getRow() : sh.getLastRow() + 1;
  if (rowIndex < 2) rowIndex = 2;
  var written = rowValues.map(function (value) {
    return value == null ? '' : String(value);
  });
  sh.getRange(rowIndex, 1, 1, written.length).setNumberFormat('@');
  sh.getRange(rowIndex, 1, 1, written.length).setValues([written]);
  if (sheetName === 'Expenses') {
    var amountCol = SHEETS.Expenses.indexOf('amount') + 1;
    sh.getRange(rowIndex, amountCol).setNumberFormat('0.00');
    sh.getRange(rowIndex, amountCol).setValue(Number(rowValues[amountCol - 1]) || 0);
  }
  if (sheetName === 'Events') {
    var budgetCol = SHEETS.Events.indexOf('budget') + 1;
    var budget = rowValues[budgetCol - 1];
    if (budget === '' || budget == null) {
      sh.getRange(rowIndex, budgetCol).clearContent();
    } else {
      sh.getRange(rowIndex, budgetCol).setNumberFormat('0.00');
      sh.getRange(rowIndex, budgetCol).setValue(Number(budget));
    }
  }
}

function deleteById_(sheetName, id) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  var values = sh.getRange('A:A').getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][0]) === String(id)) sh.deleteRow(i + 1);
  }
}

function getOrCreate_(name) {
  var ss = SpreadsheetApp.getActive();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function cleanText_(value, max) {
  var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function cleanNote_(value, max) {
  var text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function sanitizeCallback_(value) {
  var name = String(value || 'callback').replace(/[^a-zA-Z0-9_]/g, '');
  return name || 'callback';
}
