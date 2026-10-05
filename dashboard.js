(() => {
  "use strict";

  const STORAGE_KEY = "ai-job-search-tracker-v1";
  const STATUS = {
    drafted: { label: "Drafted", color: "#82683e", bg: "#f3ead8", group: "drafted" },
    applied: { label: "Applied", color: "#276a53", bg: "#ddefe7", group: "active" },
    recruiter_screen: { label: "Recruiter screen", color: "#37689a", bg: "#e1e9f5", group: "active" },
    assessment: { label: "Assessment", color: "#76599d", bg: "#eae4f4", group: "active" },
    interview: { label: "Interview", color: "#b65d31", bg: "#f6e3d8", group: "interview" },
    final_round: { label: "Final round", color: "#a54462", bg: "#f5e0e8", group: "interview" },
    offer: { label: "Offer", color: "#167258", bg: "#d7f0e5", group: "offer" },
    accepted: { label: "Accepted", color: "#126047", bg: "#d4eadf", group: "offer" },
    rejected: { label: "Rejected", color: "#8f4a4a", bg: "#f4e2e2", group: "closed" },
    withdrawn: { label: "Withdrawn", color: "#6c7076", bg: "#e8e9ea", group: "closed" },
    no_response: { label: "No response", color: "#6c7076", bg: "#e8e9ea", group: "closed" }
  };

  const GROUPS = [
    ["all", "All"], ["drafted", "Drafted"], ["active", "Active"],
    ["interview", "Interview"], ["offer", "Offers"], ["closed", "Closed"]
  ];

  const $ = (selector) => document.querySelector(selector);
  const pipeline = $("#pipeline");
  const dialog = $("#jobDialog");
  let selectedFilter = "all";
  let currentView = "board";
  let jobs = loadJobs();

  function loadJobs() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(stored)) return stored;
    } catch (_) { /* Start from repository data. */ }
    return structuredClone(window.JOB_TRACKER_DATA || []);
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    const state = $("#saveState");
    state.lastChild.textContent = " Saved locally";
    state.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 350 });
  }

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[char]);
  }

  function initials(company = "") {
    return company.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase() || "?";
  }

  function logoColor(company = "") {
    const palette = ["#1d3548", "#28644f", "#8a5a42", "#4f5e91", "#70517c", "#47666a"];
    const sum = [...company].reduce((total, char) => total + char.charCodeAt(0), 0);
    return palette[sum % palette.length];
  }

  function statusInfo(value) { return STATUS[value] || STATUS.drafted; }
  function formatStatusDate(value) {
    if (!value) return "No date set";
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function validHref(value) {
    if (!value) return "";
    return /^(https?:\/\/|[a-zA-Z0-9_.\-/]+$)/.test(value) ? value : "";
  }

  function renderFilters() {
    const counts = GROUPS.reduce((result, [group]) => {
      result[group] = group === "all" ? jobs.length : jobs.filter(job => statusInfo(job.status).group === group).length;
      return result;
    }, {});
    $("#statusFilters").innerHTML = GROUPS.map(([value, label]) =>
      `<button class="filter-button ${selectedFilter === value ? "active" : ""}" data-filter="${value}" type="button">${label} <span>${counts[value]}</span></button>`
    ).join("");
    document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
      selectedFilter = button.dataset.filter;
      render();
    }));
  }

  function filteredJobs() {
    const query = $("#searchInput").value.trim().toLowerCase();
    const sort = $("#sortSelect").value;
    const filtered = jobs.filter(job => {
      const matchesFilter = selectedFilter === "all" || statusInfo(job.status).group === selectedFilter;
      const haystack = `${job.company} ${job.role} ${job.sector} ${job.notes} ${job.nextAction}`.toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });
    filtered.sort((a, b) => {
      if (sort === "company-asc") return a.company.localeCompare(b.company);
      if (sort === "date-desc") return (b.date || "").localeCompare(a.date || "");
      if (sort === "updated-desc") return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      return (Number(b.fit) || 0) - (Number(a.fit) || 0);
    });
    return filtered;
  }

  function card(job) {
    const status = statusInfo(job.status);
    const fit = Number(job.fit) || 0;
    const links = [
      job.cv && `<a class="doc-link" href="${escapeHtml(validHref(job.cv))}" target="_blank" data-no-open>CV</a>`,
      job.coverLetter && `<a class="doc-link" href="${escapeHtml(validHref(job.coverLetter))}" target="_blank" data-no-open>Letter</a>`,
      job.source && `<a class="doc-link" href="${escapeHtml(validHref(job.source))}" target="_blank" rel="noreferrer" data-no-open>Role ↗</a>`
    ].filter(Boolean).join("");
    const next = job.nextAction ? escapeHtml(job.nextAction) : `Added ${formatStatusDate(job.date)}`;
    return `
      <article class="job-card" data-id="${escapeHtml(job.id)}" tabindex="0" role="button" aria-label="Update ${escapeHtml(job.company)} application"
        style="--status-color:${status.color};--status-bg:${status.bg};--logo-bg:${logoColor(job.company)}">
        <div class="card-top">
          <div class="company-lockup"><span class="company-logo">${initials(job.company)}</span><div><strong>${escapeHtml(job.company)}</strong><small>${escapeHtml(job.sector || "Opportunity")}</small></div></div>
          <span class="status-pill">${status.label}</span>
        </div>
        <h3>${escapeHtml(job.role)}</h3>
        <div class="job-meta">${escapeHtml(job.roleType || "Role")} · ${escapeHtml(job.channel || "direct")}<br>${next}</div>
        <div class="fit-row"><span>ROLE FIT</span><div class="fit-track"><i style="width:${Math.max(0, Math.min(100, fit))}%"></i></div><strong>${fit ? fit.toFixed(fit % 1 ? 1 : 0) : "—"}</strong></div>
        <div class="card-footer"><small>${job.nextDate ? `Next: ${formatStatusDate(job.nextDate)}` : "Click card to update"}</small><div class="doc-links">${links}</div></div>
      </article>`;
  }

  function renderMetrics() {
    const activeGroups = new Set(["active", "interview", "offer"]);
    const average = jobs.length ? jobs.reduce((sum, job) => sum + (Number(job.fit) || 0), 0) / jobs.filter(job => Number(job.fit)).length : 0;
    $("#metricTotal").textContent = jobs.length;
    $("#metricActive").textContent = jobs.filter(job => activeGroups.has(statusInfo(job.status).group)).length;
    $("#metricInterviews").textContent = jobs.filter(job => statusInfo(job.status).group === "interview").length;
    $("#metricFit").textContent = Number.isFinite(average) ? Math.round(average) : 0;
    const drafted = jobs.filter(job => job.status === "drafted").length;
    $("#todayPrompt").textContent = drafted ? `${drafted} drafted application${drafted === 1 ? "" : "s"} ready to move` : "Keep the pipeline moving";
  }

  function render() {
    renderMetrics();
    renderFilters();
    const visible = filteredJobs();
    pipeline.className = `pipeline ${currentView === "list" ? "list-view" : ""}`;
    pipeline.innerHTML = visible.map(card).join("");
    $("#emptyState").hidden = visible.length > 0;
    pipeline.querySelectorAll(".job-card").forEach(element => {
      const open = event => {
        if (event.target.closest("[data-no-open]")) return;
        if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
        openJob(element.dataset.id);
      };
      element.addEventListener("click", open);
      element.addEventListener("keydown", open);
    });
  }

  function populateStatusSelect() {
    $("#jobStatus").innerHTML = Object.entries(STATUS).map(([value, info]) => `<option value="${value}">${info.label}</option>`).join("");
  }

  function openJob(id) {
    const job = jobs.find(item => item.id === id);
    if (!job) return;
    $("#dialogEyebrow").textContent = "UPDATE APPLICATION";
    $("#dialogTitle").textContent = job.company;
    $("#jobId").value = job.id;
    $("#jobCompany").value = job.company || "";
    $("#jobRole").value = job.role || "";
    $("#jobStatus").value = job.status || "drafted";
    $("#jobFit").value = job.fit ?? "";
    $("#jobDate").value = job.date || "";
    $("#jobNextDate").value = job.nextDate || "";
    $("#jobNextAction").value = job.nextAction || "";
    $("#jobNotes").value = job.notes || "";
    $("#deleteButton").hidden = false;
    $("#dialogLinks").innerHTML = [
      job.cv && `<a href="${escapeHtml(validHref(job.cv))}" target="_blank">Open CV ↗</a>`,
      job.coverLetter && `<a href="${escapeHtml(validHref(job.coverLetter))}" target="_blank">Open cover letter ↗</a>`,
      job.source && `<a href="${escapeHtml(validHref(job.source))}" target="_blank" rel="noreferrer">Open posting ↗</a>`
    ].filter(Boolean).join("");
    dialog.showModal();
  }

  function addJob() {
    $("#jobForm").reset();
    $("#dialogEyebrow").textContent = "NEW OPPORTUNITY";
    $("#dialogTitle").textContent = "Add a role";
    $("#jobId").value = "";
    $("#jobStatus").value = "drafted";
    $("#jobDate").value = new Date().toISOString().slice(0, 10);
    $("#deleteButton").hidden = true;
    $("#dialogLinks").innerHTML = "";
    dialog.showModal();
  }

  function saveJob(event) {
    event.preventDefault();
    const id = $("#jobId").value;
    const existing = jobs.find(job => job.id === id);
    const now = new Date().toISOString();
    const value = {
      ...(existing || {}),
      id: id || `${slug($("#jobCompany").value)}-${Date.now()}`,
      company: $("#jobCompany").value.trim(),
      role: $("#jobRole").value.trim(),
      status: $("#jobStatus").value,
      fit: $("#jobFit").value ? Number($("#jobFit").value) : null,
      date: $("#jobDate").value,
      nextDate: $("#jobNextDate").value,
      nextAction: $("#jobNextAction").value.trim(),
      notes: $("#jobNotes").value.trim(),
      sector: existing?.sector || "",
      roleType: existing?.roleType || "full-time",
      channel: existing?.channel || "online",
      updatedAt: now
    };
    if (!value.company || !value.role) return;
    if (existing) Object.assign(existing, value); else jobs.unshift(value);
    persist();
    dialog.close();
    render();
  }

  function slug(value) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

  function deleteJob() {
    const id = $("#jobId").value;
    const job = jobs.find(item => item.id === id);
    if (!job || !confirm(`Remove ${job.company} from this browser's tracker?`)) return;
    jobs = jobs.filter(item => item.id !== id);
    persist();
    dialog.close();
    render();
  }

  function csvCell(value) {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCsv() {
    const headers = ["date","company","sector","role","role_type","channel","status","contact_person","fit_rating","notes","cv_file","cover_letter_file","source","deadline","next_action_date","next_action"];
    const rows = jobs.map(job => [job.date,job.company,job.sector,job.role,job.roleType,job.channel,job.status,job.contact,job.fit,job.notes,job.cv,job.coverLetter,job.source,job.deadline,job.nextDate,job.nextAction]);
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\n") + "\n";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `job_search_tracker_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function resetData() {
    if (!confirm("Discard all status and note changes saved in this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    jobs = structuredClone(window.JOB_TRACKER_DATA || []);
    selectedFilter = "all";
    render();
  }

  populateStatusSelect();
  $("#todayDate").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  $("#searchInput").addEventListener("input", render);
  $("#sortSelect").addEventListener("change", render);
  $("#addButton").addEventListener("click", addJob);
  $("#exportButton").addEventListener("click", exportCsv);
  $("#resetButton").addEventListener("click", resetData);
  $("#deleteButton").addEventListener("click", deleteJob);
  $("#jobForm").addEventListener("submit", saveJob);
  document.querySelectorAll(".close-dialog").forEach(button => button.addEventListener("click", () => dialog.close()));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll("[data-view]").forEach(item => item.classList.toggle("active", item === button));
    render();
  }));
  render();
})();
