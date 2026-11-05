// PSF '27 Investor Relations API
// Name/role selection is a convenience-only prototype, not authentication.
// Do not store confidential data until identity and server-side permissions are implemented.

const SPREADSHEET_ID = "1Bo5F4r0sdbLVe73rLtciUyWqeRnVYnFukZ8qld8b1mA";
const ALLOWED_ROLES = ["Head", "Coordinator", "Volunteer"];
const VALID_STATUSES = ["Confirmed", "Not Confirmed"];

function db() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_YOUR_SPREADSHEET_ID_HERE") {
    throw new Error("Please configure your Google Spreadsheet ID.");
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function respond(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function norm(value) {
  return String(value == null ? "" : value).trim().replace(/\s+/g, " ").toLowerCase();
}

function rows(sheetName) {
  const sheet = db().getSheetByName(sheetName);
  if (!sheet) throw new Error("Missing sheet: " + sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).filter(row => row.some(v => v !== "")).map(row => {
    const record = {};
    headers.forEach((h, i) => {
      const value = row[i];
      record[h] = value instanceof Date ? value.toISOString() : value;
    });
    return record;
  });
}

function member(name, role) {
  if (!name || !ALLOWED_ROLES.includes(role)) {
    throw new Error("Choose a valid member and role.");
  }
  const found = rows("TeamMembers").find(m =>
    norm(m.MemberName) === norm(name) &&
    String(m.Role).trim() === role &&
    ["TRUE", "YES", "1", "ACTIVE"].includes(String(m.Active).trim().toUpperCase())
  );
  if (!found) throw new Error("Member not found or inactive.");
  return found;
}

function doGet() {
  return respond({ ok: true, service: "PSF27 Investor Relations API", message: "API is running." });
}

function doPost(e) {
  try {
    const p = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // The team list is needed before a team member is selected.
    if (p.action === "teamList") {
      return respond({
        ok: true,
        members: rows("TeamMembers")
          .filter(m => ["TRUE", "YES", "1", "ACTIVE"].includes(String(m.Active).trim().toUpperCase()))
          .map(m => ({ name: m.MemberName, role: m.Role }))
          .filter(m => m.name && ALLOWED_ROLES.includes(String(m.role).trim()))
      });
    }

    const who = String(p.memberName || "").trim();
    const role = String(p.role || "").trim();
    // Prototype-only validation; this does not prove the user's identity.
    member(who, role);

    switch (p.action) {
      case "search":
        return respond(searchInvestors(p.query, role));
      case "myOutreach":
        return respond({
          ok: true,
          records: rows("OutreachLog").filter(r => norm(r.TeamMember) === norm(who))
        });
      case "submit":
        return respond(submitOutreach(p, who, role));
      case "headRecords":
        if (role !== "Head") throw new Error("Head role required.");
        return respond({ ok: true, investors: rows("Investors"), outreach: rows("OutreachLog") });
      default:
        throw new Error("Unknown action.");
    }
  } catch (error) {
    return respond({ ok: false, error: String(error.message || error) });
  }
}

function searchInvestors(query, role) {
  const q = norm(query);
  if (q.length < 2) return { ok: true, results: [], message: "Enter at least 2 characters." };

  const investors = rows("Investors");
  const logs = rows("OutreachLog");
  const results = investors.filter(i =>
    norm(i.InvestorName).includes(q) || norm(i.Organization).includes(q)
  ).slice(0, 30).map(i => {
    const history = logs.filter(l => String(l.InvestorID) === String(i.InvestorID));
    const latest = latestOutreach(history);
    return {
      investorID: i.InvestorID,
      investorName: i.InvestorName,
      organization: i.Organization,
      previouslyContacted: history.length > 0,
      outreachCount: history.length,
      lastContactedBy: latest ? latest.TeamMember : (i.LastContactedBy || ""),
      latestStatus: latest ? latest.Status : (i.LatestStatus || ""),
      lastContactDate: latest ? latest.DateTime : (i.LastContactDate || ""),
      contactMethod: latest ? (latest.ContactMethod || "") : "",
      remarks: role === "Head" ? (latest ? latest.Remarks : (i.LatestRemarks || "")) : ""
    };
  });
  return { ok: true, results: results };
}

function latestOutreach(records) {
  if (!records || !records.length) return null;
  return records.slice().sort((a, b) => {
    const ta = new Date(a.DateTime || 0).getTime() || 0;
    const tb = new Date(b.DateTime || 0).getTime() || 0;
    return tb - ta;
  })[0];
}

function findRowByValue(sheet, headerName, targetValue) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;
  const headers = data[0].map(h => String(h).trim());
  const col = headers.indexOf(headerName);
  if (col < 0) throw new Error("Missing column '" + headerName + "' in " + sheet.getName() + ".");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][col]) === String(targetValue)) return i + 1;
  }
  return -1;
}

function setCellsByHeader(sheet, rowNumber, valuesByHeader) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  Object.keys(valuesByHeader).forEach(header => {
    const col = headers.indexOf(header);
    if (col < 0) throw new Error("Missing column '" + header + "' in " + sheet.getName() + ".");
    sheet.getRange(rowNumber, col + 1).setValue(valuesByHeader[header]);
  });
}

/** Ensure the optional ContactMethod column exists without disturbing existing columns. */
function ensureContactMethodColumn(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(h => String(h).trim());
  let column = headers.indexOf("ContactMethod") + 1;
  if (!column) {
    column = lastColumn + 1;
    sheet.getRange(1, column).setValue("ContactMethod");
  }
  return column;
}

function submitOutreach(p, who, role) {
  const name = String(p.investorName || "").trim().replace(/\s+/g, " ");
  const org = String(p.organization || "").trim();
  const status = String(p.status || "").trim();
  const remarks = String(p.remarks || "").trim();
  const contactMethod = String(p.contactMethod || "").trim();
  if (contactMethod && !["Message", "Email", "Call"].includes(contactMethod)) {
    throw new Error("Contact method must be Message, Email, or Call.");
  }
  const updateExisting = p.updateExisting === true;
  const requestedOutreachID = String(p.outreachID || "").trim();

  if (!name) throw new Error("Investor name is required.");
  if (!VALID_STATUSES.includes(status)) throw new Error("Status must be Confirmed or Not Confirmed.");
  if (org.length > 250) throw new Error("Organization must be 250 characters or fewer.");
  if (remarks.length > 1000) throw new Error("Remarks must be 1000 characters or fewer.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = db();
    const investorSheet = spreadsheet.getSheetByName("Investors");
    const logSheet = spreadsheet.getSheetByName("OutreachLog");
    if (!investorSheet || !logSheet) throw new Error("Investors or OutreachLog sheet is missing.");
    ensureContactMethodColumn(logSheet);

    const investorRecords = rows("Investors");
    let investor = investorRecords.find(i =>
      norm(i.InvestorName) === norm(name) &&
      (!org || !norm(i.Organization) || norm(i.Organization) === norm(org))
    );

    // Look for outreach linked to this investor. Name/organization fallback
    // also catches older records with an inconsistent InvestorID.
    const logs = rows("OutreachLog");
    let history = [];
    if (investor) {
      history = logs.filter(l => String(l.InvestorID) === String(investor.InvestorID));
    }
    if (!history.length) {
      history = logs.filter(l =>
        norm(l.InvestorName) === norm(name) &&
        (!org || !norm(l.Organization) || norm(l.Organization) === norm(org))
      );
    }

    const existing = latestOutreach(history);

    // First submission for an already-contacted investor returns a warning only.
    // Nothing is written until the user explicitly confirms the update in the UI.
    if (existing && !updateExisting) {
      return {
        ok: true,
        duplicateFound: true,
        message: "This investor already has outreach recorded.",
        existingOutreach: {
          outreachID: existing.OutreachID,
          investorID: existing.InvestorID,
          investorName: existing.InvestorName,
          organization: investor ? investor.Organization : org,
          teamMember: existing.TeamMember,
          role: existing.Role,
          dateTime: existing.DateTime,
          status: existing.Status,
          remarks: existing.Remarks || "",
          contactMethod: existing.ContactMethod || ""
        }
      };
    }

    // Confirmed edit: update the existing OutreachLog row in place.
    // It keeps the same OutreachID and does not append a duplicate row.
    if (updateExisting) {
      if (!existing) throw new Error("The previous outreach record could not be found. Search again and retry.");
      if (requestedOutreachID && String(existing.OutreachID) !== requestedOutreachID) {
        throw new Error("The selected outreach record changed. Search again before updating.");
      }
      const outreachRow = findRowByValue(logSheet, "OutreachID", existing.OutreachID);
      if (outreachRow < 2) throw new Error("Could not locate the existing outreach row.");
      let investorID = existing.InvestorID || (investor && investor.InvestorID) || Utilities.getUuid();
      const now = new Date();
      setCellsByHeader(logSheet, outreachRow, {
        InvestorID: investorID,
        InvestorName: name,
        TeamMember: who,
        Role: role,
        DateTime: now,
        Status: status,
        Remarks: remarks,
        ContactMethod: contactMethod
      });

      // Update the Investors summary row; create one only if it was missing.
      let investorRow = investor
        ? findRowByValue(investorSheet, "InvestorID", investor.InvestorID)
        : -1;
      if (investorRow < 2) {
        investorSheet.appendRow([investorID, name, org, status, who, now, remarks]);
      } else {
        setCellsByHeader(investorSheet, investorRow, {
          InvestorName: name,
          Organization: org || (investor && investor.Organization) || "",
          LatestStatus: status,
          LastContactedBy: who,
          LastContactDate: now,
          LatestRemarks: remarks
        });
      }
      return {
        ok: true,
        updatedExisting: true,
        message: "Existing outreach updated. No duplicate outreach row was created.",
        investorID: investorID,
        outreachID: existing.OutreachID
      };
    }

    // No previous outreach exists: create or reuse the investor row and append a log.
    let investorID;
    if (investor) {
      investorID = investor.InvestorID;
    } else {
      investorID = Utilities.getUuid();
      investorSheet.appendRow([investorID, name, org, status, who, new Date(), remarks]);
      investor = { InvestorID: investorID, InvestorName: name, Organization: org };
    }

    const now = new Date();
    const outreachID = Utilities.getUuid();
    logSheet.appendRow([outreachID, investorID, name, who, role, now, status, remarks, contactMethod]);
    const investorRow = findRowByValue(investorSheet, "InvestorID", investorID);
    if (investorRow >= 2) {
      setCellsByHeader(investorSheet, investorRow, {
        InvestorName: name,
        Organization: org || investor.Organization || "",
        LatestStatus: status,
        LastContactedBy: who,
        LastContactDate: now,
        LatestRemarks: remarks
      });
    }
    return { ok: true, message: "Outreach saved.", investorID: investorID, outreachID: outreachID };
  } finally {
    lock.releaseLock();
  }
}

function testSpreadsheetConnection() {
  const spreadsheet = db();
  ["Investors", "OutreachLog", "TeamMembers"].forEach(name => {
    if (!spreadsheet.getSheetByName(name)) throw new Error("Missing tab: " + name);
  });
  Logger.log("Connection successful: " + spreadsheet.getName());
}
