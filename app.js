// PSF '27 Investor Relations frontend
const API_URL = "https://script.google.com/macros/s/AKfycbzGfAcF9krvVsjAF3JJ-z3DZ6thz5jxZILvY8j9lN5pN5-dDx5mWzdE6NanZB369gD4Nw/exec";
const $ = id => document.getElementById(id);
let currentMember = null;
let toastTimer;

function notify(message) {
  const el = $("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.style.display = "none", 4000);
}
async function api(action, extra = {}) {
  if (!API_URL.startsWith("https://script.google.com/")) {
    throw new Error("Add your Apps Script web app URL to app.js first.");
  }
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...(currentMember || {}), ...extra }),
    redirect: "follow"
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Request failed");
  return result;
}
async function loadTeam() {
  try {
    // Team list endpoint returns names and roles only.
    const result = await api("teamList");
    const select = $("memberName");
    select.replaceChildren(new Option("Choose your name", ""));
    result.members.forEach(m => {
      const option = new Option(m.name, m.name);
      option.dataset.role = m.role;
      select.add(option);
    });
    $("role").value = "Volunteer";
  } catch (error) {
    $("memberName").replaceChildren(new Option("Configure API URL to load team", ""));
    notify("Team list could not load: " + error.message);
  }
}
$("memberName").addEventListener("change", () => {
  const option = $("memberName").selectedOptions[0];
  if (option && option.dataset.role) $("role").value = option.dataset.role;
});
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = $("memberName").value;
  const role = $("role").value;
  if (!name) return notify("Choose your name.");
  // This is convenience-only identity; backend must use real authentication in production.
  currentMember = { memberName: name, role };
  try {
    await api("myOutreach");
    $("welcomeName").textContent = name;
    $("welcomeRole").textContent = role;
    $("loginView").classList.add("hidden");
    $("appView").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("headPanel").classList.toggle("hidden", role !== "Head");
    await loadMyOutreach();
  } catch (error) {
    currentMember = null;
    notify("Login failed: " + error.message);
  }
});
$("logoutBtn").addEventListener("click", () => {
  currentMember = null;
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
});
$("searchForm").addEventListener("submit", async event => {
  event.preventDefault();
  const container = $("searchResults");
  container.textContent = "Searching…";
  try {
    const data = await api("search", { query: $("searchQuery").value.trim() });
    container.replaceChildren();
    if (!data.results.length) {
      container.textContent = "No matching investors found.";
      return;
    }
    data.results.forEach(investor => {
      const card = document.createElement("article");
      card.className = "result-card";
      const title = document.createElement("h3");
      title.textContent = investor.investorName;
      card.append(title);
      const org = document.createElement("p");
      org.textContent = investor.organization || "Organization not provided";
      card.append(org);
      const badge = document.createElement("span");
      badge.className = "badge " + (investor.previouslyContacted ? "warn" : "ok");
      badge.textContent = investor.previouslyContacted
        ? "Previously contacted · " + investor.outreachCount + " record(s)"
        : "No previous outreach recorded";
      card.append(badge);
      if (investor.previouslyContacted) {
        const details = document.createElement("p");
        details.textContent = `Last contacted by ${investor.lastContactedBy || "Unknown"} · Status: ${investor.latestStatus || "Unknown"} · Date: ${investor.lastContactDate || "Unknown"}`;
        card.append(details);
      }
      if (investor.remarks) {
        const notes = document.createElement("p");
        notes.textContent = "Latest remarks: " + investor.remarks;
        card.append(notes);
      }
      const use = document.createElement("button");
      use.className = "btn btn-secondary";
      use.type = "button";
      use.textContent = "Use this investor";
      use.addEventListener("click", () => {
        $("investorName").value = investor.investorName;
        $("organization").value = investor.organization || "";
        $("status").value = investor.latestStatus === "Confirmed" ? "Confirmed" : "Not Confirmed";
        $("outreachForm").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.append(use);
      container.append(card);
    });
  } catch (error) {
    container.textContent = "Search failed: " + error.message;
  }
});
$("outreachForm").addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    investorName: $("investorName").value.trim(),
    organization: $("organization").value.trim(),
    status: $("status").value,
    contactMethod: $("contactMethod").value,
    remarks: $("remarks").value.trim()
  };
  try {
    let result = await api("submit", payload);

    if (result.duplicateFound && result.existingOutreach) {
      const previous = result.existingOutreach;
      const previousDate = formatDate(previous.dateTime) || "Unknown date";
      const message = [
        `This investor already has outreach recorded: ${previous.investorName}.`,
        `Last recorded by: ${previous.teamMember || "Unknown"}`,
        `Date: ${previousDate}`,
        `Previous status: ${previous.status || "Unknown"}`,
        `Previous contact method: ${previous.contactMethod || "Not specified"}`,
        "",
        "Do you want to update the existing outreach with the details currently in this form?",
        "Choose OK to edit the existing record (no new outreach row will be created), or Cancel to leave it unchanged."
      ].join("\n");

      if (!window.confirm(message)) {
        notify("Existing outreach left unchanged.");
        return;
      }

      result = await api("submit", {
        ...payload,
        updateExisting: true,
        outreachID: previous.outreachID
      });
    }

    notify(result.message || "Outreach saved.");
    $("outreachForm").reset();
    await loadMyOutreach();
  } catch (error) {
    notify("Could not save outreach: " + error.message);
  }
});
async function loadMyOutreach() {
  try {
    const data = await api("myOutreach");
    const records = data.records || [];
    $("myCount").textContent = records.length;
    $("confirmedCount").textContent = records.filter(r => r.Status === "Confirmed").length;
    $("unconfirmedCount").textContent = records.filter(r => r.Status === "Not Confirmed").length;
    const container = $("myHistory");
    container.replaceChildren();
    if (!records.length) {
      container.textContent = "No outreach recorded yet.";
      return;
    }
    container.append(makeTable(
      ["Investor", "Date", "Contact method", "Status", "Remarks"],
      records.slice().reverse().map(r => [
        r.InvestorName, formatDate(r.DateTime), r.ContactMethod || "Not specified", r.Status, r.Remarks || ""
      ])
    ));
  } catch (error) {
    $("myHistory").textContent = error.message;
  }
}
$("loadHeadBtn").addEventListener("click", async () => {
  try {
    const data = await api("headRecords");
    const container = $("headRecords");
    container.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `${data.investors.length} investor(s) · ${data.outreach.length} outreach record(s)`;
    container.append(summary);
    container.append(makeTable(
      ["Investor", "Member", "Role", "Contact method", "Status", "Date", "Remarks"],
      data.outreach.slice().reverse().map(r => [
        r.InvestorName, r.TeamMember, r.Role, r.ContactMethod || "Not specified", r.Status, formatDate(r.DateTime), r.Remarks || ""
      ])
    ));
  } catch (error) {
    notify("Could not load records: " + error.message);
  }
});
function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
function makeTable(headers, rows) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrap";
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  headers.forEach(value => {
    const th = document.createElement("th");
    th.textContent = value;
    hr.append(th);
  });
  thead.append(hr);
  table.append(thead);
  const tbody = document.createElement("tbody");
  rows.forEach(values => {
    const tr = document.createElement("tr");
    values.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value == null ? "" : String(value);
      tr.append(td);
    });
    tbody.append(tr);
  });
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}
loadTeam();
