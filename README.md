# PSF '27 Investor Relations Portal

A static frontend for GitHub Pages with a Google Apps Script backend and Google Sheets storage.

## Files
- `index.html` — UI
- `styles.css` — responsive styles
- `app.js` — browser logic
- `Code.gs` — paste into Google Apps Script
- `README.md` — setup instructions

## Important security limitation
This version is a **prototype only**. Selecting a name and role is not authentication. Anyone who can reach a public Apps Script web app may forge a Head role or member name. The frontend cannot enforce access control. Do not use real investor/contact details until the backend is restricted to verified users and role permissions are derived from a trusted identity, not the request body.

For production, prefer Google sign-in restricted to approved accounts and verify the signed-in identity server-side. If your team cannot use a shared Google Workspace/domain, implement a real identity provider. Do not put passwords, service-account keys, API secrets, or spreadsheet credentials in `app.js` or GitHub.

## 1. Prepare Google Sheets
Create a spreadsheet with three tabs and exact names:

### Investors (row 1)
`InvestorID | InvestorName | Organization | LatestStatus | LastContactedBy | LastContactDate | LatestRemarks`

### OutreachLog (row 1)
`OutreachID | InvestorID | InvestorName | TeamMember | Role | DateTime | Status | Remarks`

### TeamMembers (row 1)
`MemberID | MemberName | Role | Active`

Use tabs between headings when pasting into Sheets. Add the 31 actual team members below the header. Roles must be exactly `Head`, `Coordinator`, or `Volunteer`; Active must be `TRUE` or `FALSE`.

## 2. Set up Apps Script
1. Open https://script.google.com/ and create a project.
2. Paste `Code.gs` into the editor.
3. Replace `PASTE_YOUR_SPREADSHEET_ID_HERE` with the spreadsheet ID from its URL (between `/d/` and `/edit`).
4. Save, select `testSpreadsheetConnection`, and run it. Approve spreadsheet access if prompted.
5. Do not deploy publicly with real data while the prototype identity check is in place.

## 3. Configure frontend
1. Open `app.js`.
2. Replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your deployed Apps Script Web App URL.
3. Apps Script browser requests can be affected by redirects and browser CORS behavior. Test the deployed frontend in your browser before relying on it. If cross-origin requests fail, use an authenticated backend/hosting architecture rather than disabling browser security.

## 4. Publish to GitHub Pages
1. Create a GitHub repository, e.g. `psf27-investor-relations`.
2. Upload `index.html`, `styles.css`, and `app.js` to the repository root.
3. Commit the files.
4. Open **Settings → Pages**.
5. Under Build and deployment, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
6. Wait for the published URL shown in Pages settings.

## 5. Test with dummy data only
- Team list loads and names/roles are correct.
- Searching returns a duplicate warning for an existing investor.
- Submitting outreach creates a row in `OutreachLog`.
- Confirmed/Not Confirmed and remarks are saved.
- Test concurrent submissions and duplicate names.
- Do not assume role permissions are secure until verified authentication is implemented.

## Data model
Every outreach is stored in `OutreachLog` so follow-ups do not overwrite previous interactions. `Investors` stores the current summary for each investor. The current prototype identifies records by name plus organization when organization is supplied; ambiguous investor matches should be reviewed by a human.
