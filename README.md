# PSF '27 Investor Relations — Duplicate Outreach Update

This version keeps the existing name/role selection flow (no authentication added), removes the visible prototype warning banner, and adds a duplicate-outreach confirmation before updating an existing record.

## Included files

- `index.html` — page structure; visible prototype warning removed.
- `styles.css` — refreshed dark navy/blue PSF’27 visual theme inspired by the investor confirmation reference.
- Shared hero section added to `index.html` with event branding, blue accent typography, and event-date pill.
- `app.js` — frontend and duplicate confirmation prompt.
- `Code.gs` — Google Apps Script API with duplicate detection and update-in-place logic.

## Expected Google Sheet tabs and headers

Keep these tabs and header rows as they are:

**Investors**

`InvestorID | InvestorName | Organization | LatestStatus | LastContactedBy | LastContactDate | LatestRemarks`

**OutreachLog**

`OutreachID | InvestorID | InvestorName | TeamMember | Role | DateTime | Status | Remarks`

**TeamMembers**

`MemberID | MemberName | Role | Active`

The script uses the spreadsheet ID already configured in `Code.gs`. Verify that it is the correct spreadsheet before deploying.

## Duplicate outreach behavior

1. A user fills in the outreach form and clicks **Save outreach**.
2. The backend checks whether the investor already has an outreach entry.
3. If an existing entry is found, the backend returns the latest outreach details without writing anything.
4. The website asks whether to update the existing entry with the values currently in the form.
5. **OK** updates the existing `OutreachLog` row in place, keeps its `OutreachID`, and updates the `Investors` summary. It does not append another outreach row.
6. **Cancel** leaves the spreadsheet unchanged.
7. The update runs under a script lock. If the record changed after the warning was displayed, the backend asks the user to search again rather than updating a different row.

The most recent outreach for the matched investor is updated. This does not create a separate audit-history row for previous field values.

## Deploy the update

### 1. Update Apps Script

1. Open the existing Apps Script project connected to the Google Sheet.
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Save the project.
4. Run `testSpreadsheetConnection` from the function dropdown and confirm it succeeds.
5. Choose **Deploy → Manage deployments → Edit → New version → Deploy**. This updates the existing versioned deployment while retaining its URL. See [Google's deployment guide](https://developers.google.com/apps-script/concepts/deployments).

### 2. Update GitHub Pages

1. Open the repository used by the current GitHub Pages site.
2. Replace `index.html`, `styles.css`, and `app.js` with the files in this folder.
3. Commit and push the changes.
4. Wait for GitHub Pages to publish, then hard-refresh the site (`Ctrl+F5`).

The `API_URL` in `app.js` is set to the existing Apps Script web app URL. If your deployment URL has changed, update it there before publishing.

## Test with dummy records

1. Search for an investor with an existing `OutreachLog` entry.
2. Enter updated status/remarks and click **Save outreach**.
3. Confirm the warning identifies the previous contact.
4. Choose **Cancel** and verify no sheet values changed.
5. Repeat and choose **OK**; verify the same `OutreachID` row was updated and no extra `OutreachLog` row was appended.
6. Submit a new investor and verify a new investor/outreach entry is created normally.

## Important limitation

The requested name/role selector is retained and no authentication has been added. Removing the visible warning does not make the app secure: a user may still select another member's name or role. Use dummy data only until identity verification and server-side permissions are implemented.


## Branding update
- The top-left text brand has been removed. The Log out button remains at the top-right when a user is in the dashboard.
- The hero banner now uses `psf27-logo.png`; keep this image in the same directory as `index.html`.
- Removed the separate “INVESTOR RELATIONS” eyebrow and “Pune Startup Fest 2027” subtitle from the hero. The event date/location pill remains.

## Optional contact method field

The Record outreach form now includes **Contact method (optional)** with three choices: `Message`, `Email`, and `Call`. Leaving it as `Not specified` stores a blank value.

The Apps Script backend automatically adds a `ContactMethod` header as a new final column in `OutreachLog` the first time an outreach is submitted or edited, if that header does not already exist. Existing columns and records are not reordered. New submissions and duplicate-record updates save the selected method. The method is also shown in the user's outreach history and the Head team overview.

### Deploy this change

1. Replace `Code.gs` in the existing Apps Script project with this package's `Code.gs`, save, and deploy a **New version** via **Deploy → Manage deployments → Edit → New version → Deploy**. The existing `/exec` URL remains the frontend API URL.
2. Replace `index.html`, `styles.css`, and `app.js` in the GitHub Pages repository with the package files. Keep `psf27-logo.png` beside `index.html`.
3. Commit/push and hard-refresh the website (`Ctrl+F5`).
4. Submit a dummy outreach with Message, then Email, then Call; also test leaving the field blank. Confirm `OutreachLog` has a `ContactMethod` column and the correct values. Test duplicate update and verify it updates the existing row's method without adding a new row.
