# Expenses

Personal expense tracker for events such as trips and renovations. Money is stored in a Google Sheet you own. The app is a phone-friendly page you can install.

Amounts are in INR. An expense has a title, amount, date, category, and an optional note.

## Run it

```bash
npm install
npm run dev
```

Open the local URL. On your phone, use `npm run dev:host` and open the network address on the same Wi-Fi.

## Connect Google Sheets

Do this once, in the spreadsheet:

1. Create a blank Google Sheet.
2. Extensions → Apps Script. Delete the sample `Code.gs` contents and paste `apps-script/Code.gs`. Save.
3. Reload the spreadsheet. Use the new menu **Expense tracker → Set up sheets** and allow the permission prompt. The script only reads and writes that spreadsheet.
4. Deploy → New deployment → select type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the web app URL. It ends in `/exec`.
6. Copy the API token from the **Setup** tab, cell B2.
7. Paste both into the app and tap **Connect sheet**.

The deployment has to be **Anyone** so the phone app can reach it. The token is what keeps the sheet private. Don’t publish the URL together with the token.

If you change `Code.gs` later: Deploy → Manage deployments → edit → Version: **New version** → Deploy. The URL stays the same.

Before connecting, **Look around with sample data** shows the interface without writing anything.

## What the sheet contains

The setup menu creates Events, Categories, Expenses, and Setup tabs. You can sort and chart them in Google Sheets. Edits you make in the app show up there, and a refresh in the app picks up edits you make in the sheet.
