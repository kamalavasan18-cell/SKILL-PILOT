"use strict";
/* =========================================================
   SkillPilot AI — frontend
   Talks to the existing FastAPI backend (unchanged):
   POST /analyze · GET /assessment/questions · POST /assessment/submit
   GET /progress/{id} · GET /agents · GET /
   ========================================================= */
const API_BASE = "http://127.0.0.1:8000";

/* Starter data mirrored from backend/main.py. Used only for the landing demo,
   skill suggestions and mentor hints. Real results always come from the API. */
const CAREER_SKILLS = {
  "Full Stack Developer": ["HTML", "CSS", "JavaScript", "React", "Node.js", "SQL", "Git"],
  "AI / ML Engineer": ["Python", "Mathematics", "Statistics", "Machine Learning", "Pandas", "Model Evaluation"],
  "Data Analyst": ["SQL", "Python", "Excel", "Statistics", "Power BI", "Data Visualization"],
  "Cybersecurity Analyst": ["Networking", "Linux", "Python", "Security Fundamentals", "Risk Analysis"],
  "UI/UX Designer": ["Design Principles", "Figma", "Wireframing", "Prototyping", "User Research"]
};
const SHORT_CAREER = { "Full Stack Developer": "Full Stack", "AI / ML Engineer": "AI / ML", "Data Analyst": "Data", "Cybersecurity Analyst": "Security", "UI/UX Designer": "UI/UX" };
const HINTS = {
  "HTML": "Build a semantic multi-page website and learn forms and accessibility.",
  "CSS": "Practice Flexbox, Grid and responsive design.",
  "JavaScript": "Learn variables, functions, arrays, DOM and asynchronous programming.",
  "React": "Build reusable components and manage application state.",
  "Node.js": "Create REST APIs and understand backend development.",
  "SQL": "Practice SELECT, JOIN, GROUP BY and database relationships.",
  "Git": "Learn commits, branches, merges and GitHub collaboration.",
  "Python": "Practice Python syntax, functions, collections and projects.",
  "Mathematics": "Study algebra, vectors, probability and linear algebra.",
  "Statistics": "Study distributions, averages, variance and correlation.",
  "Machine Learning": "Learn supervised learning and model training.",
  "Pandas": "Clean, transform and analyze datasets.",
  "Model Evaluation": "Practice accuracy, precision, recall and model evaluation.",
  "Excel": "Practice formulas, sorting, filtering and pivot tables.",
  "Power BI": "Build interactive dashboards.",
  "Data Visualization": "Learn charts and communicate data insights.",
  "Networking": "Study IP, DNS, HTTP and network architecture.",
  "Linux": "Practice terminal commands and file permissions.",
  "Security Fundamentals": "Study authentication, encryption and vulnerabilities.",
  "Risk Analysis": "Identify and document security risks.",
  "Design Principles": "Study typography, spacing, hierarchy and contrast.",
  "Figma": "Create clickable interface mockups.",
  "Wireframing": "Sketch application layouts.",
  "Prototyping": "Connect screens into interactive user flows.",
  "User Research": "Conduct interviews and identify user needs."
};
const FALLBACK_AGENTS = [
  { name: "Career Intelligence Agent", role: "Identifies career requirements." },
  { name: "Skill Verification Agent", role: "Compares declared skills with career requirements." },
  { name: "Learning Path Agent", role: "Creates personalized learning roadmaps." },
  { name: "AI Mentor Agent", role: "Provides personalized learning guidance." },
  { name: "Adaptive Learning Agent", role: "Recommends changes based on assessment performance." }
];
const STATUS = {
  verified: { label: "Verified", cls: "st-verified", color: "#174C3C" },
  declared: { label: "Declared", cls: "st-declared", color: "#A8BDA9" },
  shaky: { label: "Needs practice", cls: "st-shaky", color: "#F7C9A0" },
  gap: { label: "Gap", cls: "st-gap", color: "#F29B50" }
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}
const esc = escapeHTML;
const lc = s => String(s).toLowerCase();
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } }
};
const fmtDate = t => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}
async function api(path, opts) {
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    let detail = ""; try { detail = (await res.json()).detail; } catch { /* no body */ }
    const err = new Error(typeof detail === "string" && detail ? detail : `Request failed (${res.status}).`);
    err.status = res.status; throw err;
  }
  return res.json();
}
const OFFLINE_MSG = "Can't reach the SkillPilot server at 127.0.0.1:8000. Start the backend with “uvicorn main:app --reload” and try again.";

/* =========================================================
   SVG building blocks
   ========================================================= */
function ringHTML(value, { size = 120, stroke = 12 } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
  return `<svg class="ring-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${value} percent">
    <circle class="ring-bg" cx="${h}" cy="${h}" r="${r}" stroke-width="${stroke}"/>
    <circle class="ring-fg" data-c="${c}" data-v="${value}" cx="${h}" cy="${h}" r="${r}" stroke-width="${stroke}" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${h} ${h})"/>
    <text class="ring-num" x="${h}" y="${h}" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(size * .27)}">${value}%</text></svg>`;
}
function fillRings(root = document) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$(".ring-fg", root).forEach(el => { el.style.strokeDashoffset = +el.dataset.c * (1 - +el.dataset.v / 100); });
  }));
}
function setRing(container, value) {
  const fg = $(".ring-fg", container); if (!fg) return;
  fg.dataset.v = value; fg.style.strokeDashoffset = +fg.dataset.c * (1 - value / 100);
  $(".ring-num", container).textContent = value + "%";
  $("svg", container).setAttribute("aria-label", value + " percent");
}
function labelLines(text) {
  if (text.length <= 12 || !text.includes(" ")) return [text];
  const words = text.split(" "); let best = 1, diff = 99;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
    if (d < diff) { diff = d; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}
function radarSVG(items, { size = 420, selected = null, interactive = true } = {}) {
  const n = items.length, c = size / 2, R = size / 2 - 74;
  const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, f) => [c + Math.cos(ang(i)) * R * f, c + Math.sin(ang(i)) * R * f];
  const poly = f => items.map((_, i) => pt(i, f).map(v => v.toFixed(1)).join(",")).join(" ");
  const user = items.map((it, i) => pt(i, Math.max(it.level, 22) / 100).map(v => v.toFixed(1)).join(",")).join(" ");
  let out = `<svg class="radar" viewBox="0 0 ${size} ${size}" role="group" aria-label="Skill gap radar">`;
  [.25, .5, .75, 1].forEach(f => { out += `<polygon class="radar-ring" points="${poly(f)}"/>`; });
  items.forEach((_, i) => { const [x, y] = pt(i, 1); out += `<line class="radar-axis" x1="${c}" y1="${c}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; });
  out += `<polygon class="radar-target" points="${poly(1)}"/>`;
  out += `<polygon class="radar-user" style="transform-origin:${c}px ${c}px" points="${user}"/>`;
  items.forEach((it, i) => {
    const cos = Math.cos(ang(i)), sin = Math.sin(ang(i));
    const [lx, ly] = pt(i, 1); const x = lx + cos * 20, y = ly + sin * 20;
    const anchor = cos > .3 ? "start" : cos < -.3 ? "end" : "middle";
    const lines = labelLines(it.skill);
    const y0 = y + (sin > .5 ? 10 : sin < -.5 ? -(lines.length - 1) * 14 : -(lines.length - 1) * 7) + 4;
    const sel = selected === it.skill ? " sel" : "";
    out += `<text class="radar-label${sel}" data-skill="${esc(it.skill)}" text-anchor="${anchor}" x="${x.toFixed(1)}" y="${y0.toFixed(1)}">${lines.map((l, k) => `<tspan x="${x.toFixed(1)}" dy="${k ? 14 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
  });
  items.forEach((it, i) => {
    const [x, y] = pt(i, Math.max(it.level, 22) / 100);
    const sel = selected === it.skill ? " sel" : "";
    out += `<circle class="radar-pt${sel}" r="7" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" fill="${STATUS[it.status].color}" data-skill="${esc(it.skill)}" data-tip="${esc(it.skill)}: ${STATUS[it.status].label}" ${interactive ? `tabindex="0" role="button" aria-label="${esc(it.skill)}, ${STATUS[it.status].label}"` : ""}/>`;
  });
  return out + "</svg>";
}
function barsHTML(items, selected) {
  return `<div class="bar-rows">${items.map((it, i) => `
    <button type="button" class="bar-row${selected === it.skill ? " sel" : ""}" data-skill="${esc(it.skill)}" aria-label="${esc(it.skill)}, ${STATUS[it.status].label}">
      <span class="bar-name">${esc(it.skill)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(it.level, 4)}%;background:${STATUS[it.status].color};animation-delay:${i * 60}ms"></span></span>
      <span class="bar-val">${STATUS[it.status].label === "Needs practice" ? "Practice" : STATUS[it.status].label}</span>
    </button>`).join("")}</div>`;
}
function legendHTML() {
  return `<ul class="legend">${Object.values(STATUS).map(s => `<li><span class="dot ${s.cls}"></span>${s.label}</li>`).join("")}</ul>`;
}
function lineChart(points) {
  const W = 640, H = 260, pl = 40, pr = 20, pt = 18, pb = 34;
  const x = i => points.length === 1 ? (pl + W - pr) / 2 : pl + (i * (W - pl - pr)) / (points.length - 1);
  const y = v => pt + (H - pt - pb) * (1 - v / 100);
  let out = `<svg class="line-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Career readiness over time">`;
  [0, 25, 50, 75, 100].forEach(v => { out += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-t" x="${pl - 10}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; });
  if (points.length > 1) {
    const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.readiness).toFixed(1)}`).join(" ");
    out += `<path d="${d} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)}Z" fill="rgba(168,189,169,.3)"/><path class="line-path" pathLength="1" d="${d}"/>`;
  }
  points.forEach((p, i) => { out += `<circle class="line-dot" cx="${x(i).toFixed(1)}" cy="${y(p.readiness).toFixed(1)}" r="6.5" tabindex="0" data-tip="${esc(p.label)} · ${p.readiness}% · ${fmtDate(p.at)}"/>`; });
  return out + "</svg>";
}
function donutHTML(counts, total) {
  const r = 70, c = 2 * Math.PI * r; let acc = 0;
  const segs = Object.keys(STATUS).map(k => {
    const len = total ? (counts[k] / total) * c : 0; const s = `<circle class="donut-seg" cx="95" cy="95" r="${r}" stroke="${STATUS[k].color}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 95 95)" data-tip="${STATUS[k].label}: ${counts[k]}"/>`;
    acc += len; return s;
  }).join("");
  return `<svg viewBox="0 0 190 190" width="190" height="190" role="img" aria-label="Skills by status"><circle cx="95" cy="95" r="${r}" fill="none" stroke="#EEF2EA" stroke-width="22"/>${segs}<text class="donut-num" x="95" y="93" text-anchor="middle">${total}</text><text class="donut-cap" x="95" y="113" text-anchor="middle">required skills</text></svg>`;
}
/* hover tooltips for any element with data-tip */
document.addEventListener("mouseover", e => {
  const t = e.target.closest && e.target.closest("[data-tip]"); const tip = $("#tip");
  if (!t) return; tip.textContent = t.dataset.tip; tip.hidden = false;
});
document.addEventListener("mousemove", e => {
  const tip = $("#tip"); if (tip.hidden) return;
  tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 250) + "px"; tip.style.top = e.clientY + 16 + "px";
});
document.addEventListener("mouseout", e => { if (e.target.closest && e.target.closest("[data-tip]")) $("#tip").hidden = true; });

/* =========================================================
   Accounts (frontend demo — stored in this browser only)
   ========================================================= */
let session = store.get("sp_session", null);
async function hashPw(pw, salt) {
  const bytes = new TextEncoder().encode(salt + pw);
  try {
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return btoa(String.fromCharCode(...bytes)); }
}
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

$("#form-signup").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("#signup-name").value.trim(), email = lc($("#signup-email").value.trim()), pw = $("#signup-password").value;
  const err = $("#signup-error");
  if (!name) return void (err.textContent = "Enter your full name.");
  if (!validEmail(email)) return void (err.textContent = "Enter a valid email address.");
  if (pw.length < 8) return void (err.textContent = "Use a password with at least 8 characters.");
  const users = store.get("sp_users", {});
  if (users[email]) return void (err.textContent = "An account with this email already exists. Log in instead.");
  const salt = Math.random().toString(36).slice(2);
  users[email] = { name, salt, hash: await hashPw(pw, salt) };
  store.set("sp_users", users);
  startSession(email, name); err.textContent = "";
  toast(`Welcome to SkillPilot AI, ${name.split(" ")[0]}.`);
  location.hash = "#/app/analyzer";
});
$("#form-login").addEventListener("submit", async e => {
  e.preventDefault();
  const email = lc($("#login-email").value.trim()), pw = $("#login-password").value, err = $("#login-error");
  const u = store.get("sp_users", {})[email];
  if (!u || u.hash !== await hashPw(pw, u.salt)) return void (err.textContent = "That email and password don't match. Check them and try again.");
  err.textContent = ""; startSession(email, u.name);
  location.hash = "#/app/dashboard";
});
function resetProfileForm() { $("#profile-form").reset(); $("#skill-suggest").innerHTML = ""; }
function startSession(email, name) {
  session = { email, name }; store.set("sp_session", session); loadState(); resetProfileForm();
}
$("#logout-btn").addEventListener("click", () => {
  session = null; state = null; localStorage.removeItem("sp_session"); ui.synced = false; ui.assess = { stage: "intro" }; ui.sel = null; resetProfileForm();
  toast("You're logged out."); location.hash = "#/";
});
document.addEventListener("click", e => {
  const b = e.target.closest(".pw-toggle"); if (!b) return;
  const input = $("#" + b.dataset.target); const show = input.type === "password";
  input.type = show ? "text" : "password"; b.textContent = show ? "Hide" : "Show";
});

/* =========================================================
   Learner state (cached per account; SQLite stays the source of truth)
   ========================================================= */
let state = null;
const blankState = () => ({ learnerId: null, name: "", career: "", experience: "", required: [], current: [], gaps: [], declared: [], roadmap: [], mentor: "", assessment: null, history: [], done: {}, chat: [] });
function loadState() { state = { ...blankState(), ...store.get("sp_state_" + session.email, {}) }; }
function saveState() { if (session && state) store.set("sp_state_" + session.email, state); }
if (session) loadState();

const ui = { page: null, sel: null, gapView: "radar", filter: "all", assess: { stage: "intro" }, focusSkill: null, typing: false, agents: null, synced: false };

const hasAnalysis = () => !!(state && state.learnerId && state.required.length);
const normItem = it => ({ skill: it.skill, activity: String(it.activity).replace(/^(\s*Priority practice:\s*)+/i, ""), priority: /^\s*Priority practice:/i.test(it.activity) });
const roadmapItems = () => state.roadmap.map(normItem);
const doneCount = () => roadmapItems().filter(i => state.done[i.skill]).length;

function statuses() {
  const weak = new Set((state.assessment?.weak || []).map(lc)), assessed = new Set((state.assessment?.assessed || []).map(lc));
  return state.required.map(skill => {
    const k = lc(skill), isGap = state.gaps.some(g => lc(g) === k);
    let status, level;
    if (isGap) { status = "gap"; level = 0; }
    else if (assessed.has(k)) { if (weak.has(k)) { status = "shaky"; level = 40; } else { status = "verified"; level = 100; } }
    else { status = "declared"; level = 60; }
    return { skill, status, level, assessed: assessed.has(k), passedUndeclared: isGap && assessed.has(k) && !weak.has(k) };
  });
}
function breakdown() {
  const cov = Math.round((100 * state.current.length) / state.required.length);
  const n = roadmapItems().length;
  return { cov, asmt: state.assessment ? state.assessment.score : null, prog: n ? Math.round((100 * doneCount()) / n) : 0 };
}
function readiness() {
  const b = breakdown(); let w = 70, s = 50 * b.cov + 20 * b.prog;
  if (b.asmt !== null) { w += 30; s += 30 * b.asmt; }
  return Math.round(s / w);
}
const band = r => r < 30 ? "Getting started" : r < 55 ? "Building momentum" : r < 80 ? "Nearly ready" : "Interview-ready";
function pushHistory(type, label, extra = {}) {
  state.history.push({ type, label, at: Date.now(), readiness: readiness(), ...extra });
  state.history = state.history.slice(-60);
}
function applyAnalysis(data) {
  state.learnerId = data.learner_id; state.name = data.name; state.career = data.career_goal;
  state.current = data.current_skills; state.gaps = data.skill_gaps; state.roadmap = data.roadmap;
  state.declared = data.other_skills || []; state.mentor = data.mentor_message;
  state.required = data.agent_system?.career_analysis?.required_skills || [...data.current_skills, ...data.skill_gaps];
  state.assessment = null; state.done = {};
  state.chat = [{ role: "bot", text: `${data.mentor_message} Ask me what to learn first, or pick a suggestion below.`, at: Date.now() }];
  pushHistory("analysis", `Analyzed ${data.career_goal}`);
  ui.assess = { stage: "intro" }; ui.sel = null;
}
async function syncFromServer() {
  if (!state || !state.learnerId) return;
  try {
    const d = await api(`/progress/${state.learnerId}`);
    const a = d.latest_analysis; if (!a) return;
    const before = JSON.stringify([state.career, state.current, state.gaps, state.roadmap]);
    state.career = d.career_goal; state.current = a.current_skills; state.gaps = a.skill_gaps; state.roadmap = a.roadmap;
    if (!state.required.length) state.required = [...a.current_skills, ...a.skill_gaps];
    saveState();
    if (before !== JSON.stringify([state.career, state.current, state.gaps, state.roadmap]) && ui.page && ui.page !== "analyzer") renderCurrent();
  } catch (err) {
    if (err.status === 404) { const keep = state.history; state = { ...blankState(), history: keep }; saveState(); renderCurrent(); }
  }
}

/* =========================================================
   Router
   ========================================================= */
const PAGES = ["dashboard", "analyzer", "gaps", "roadmap", "assessment", "mentor", "analytics"];
function pageMeta(p) {
  const first = (session?.name || "there").split(" ")[0], h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return {
    dashboard: [`${greet}, ${first}`, hasAnalysis() ? `Target career: ${state.career}` : "Build your skill profile to unlock your readiness score."],
    analyzer: ["Skill profile", "Tell us what you know and where you want to go."],
    gaps: ["Skill gaps", "Every skill your target role needs, on one map."],
    roadmap: ["Your roadmap", "A learning plan that reorders itself around your results."],
    assessment: ["Skill assessment", "Check the skills you claimed."],
    mentor: ["AI mentor", "Ask about your plan, your gaps or your next step."],
    analytics: ["Progress", "How your readiness has changed over time."]
  }[p];
}
function showView(id) { ["landing", "auth", "app"].forEach(v => $("#view-" + v).classList.toggle("hidden", v !== id)); }
function route() {
  const h = location.hash || "#/"; const parts = h.split("/");
  closeMenu();
  if (parts[1] === "app") {
    if (!session) { location.replace("#/login"); return; }
    const page = PAGES.includes(parts[2]) ? parts[2] : "dashboard";
    showView("app"); openPage(page); return;
  }
  if (parts[1] === "login" || parts[1] === "signup") {
    const signup = parts[1] === "signup"; showView("auth"); setAuthTab(signup);
    document.title = (signup ? "Create your account" : "Log in") + " | SkillPilot AI"; window.scrollTo(0, 0); return;
  }
  showView("landing"); document.title = "SkillPilot AI | Find the skills between you and your first tech role";
  syncLandingLinks();
  if (h === "#/" || h === "#") window.scrollTo(0, 0);
}
function setAuthTab(signup) {
  $("#tab-login").setAttribute("aria-selected", String(!signup)); $("#tab-signup").setAttribute("aria-selected", String(signup));
  $("#form-login").classList.toggle("hidden", signup); $("#form-signup").classList.toggle("hidden", !signup);
  $("#auth-title").textContent = signup ? "Create your account" : "Welcome back";
  $("#auth-sub").textContent = signup ? "Start building your personal learning path." : "Log in to continue your learning path.";
}
$("#tab-login").addEventListener("click", () => { location.hash = "#/login"; });
$("#tab-signup").addEventListener("click", () => { location.hash = "#/signup"; });
function syncLandingLinks() {
  $$(".js-login-link").forEach(a => { a.textContent = session ? "Open dashboard" : "Log in"; a.href = session ? "#/app/dashboard" : "#/login"; });
  $$(".js-signup-link").forEach(a => { if (session) { a.href = "#/app/analyzer"; a.textContent = a.classList.contains("btn-lg") ? "Build my roadmap" : "Start analysis"; } });
}
function openPage(page) {
  const changed = ui.page !== page; ui.page = page;
  $$(".page").forEach(p => p.classList.toggle("hidden", p.id !== "page-" + page));
  $$(".side-nav a").forEach(a => a.setAttribute("aria-current", a.dataset.nav === page ? "page" : "false"));
  const [t, s] = pageMeta(page); $("#page-title").textContent = t; $("#page-sub").textContent = s;
  document.title = t.split(",")[0] + " | SkillPilot AI";
  renderChrome(); renderCurrent();
  if (changed) { window.scrollTo(0, 0); $("#page-title").focus({ preventScroll: true }); }
  if (!ui.synced) { ui.synced = true; checkApi(); syncFromServer(); }
}
function renderChrome() {
  $("#avatar").textContent = (session.name || "S").trim().charAt(0).toUpperCase();
  const card = $("#side-card");
  if (hasAnalysis()) {
    const r = readiness();
    card.innerHTML = `<p>Target career</p><b>${esc(state.career)}</b><div class="side-meter" role="img" aria-label="Readiness ${r} percent"><i style="width:${r}%"></i></div><p style="margin-top:8px">${r}% career ready</p>`;
  } else card.innerHTML = `<p>Get started</p><b>Build your skill profile</b><a class="btn btn-accent btn-sm" href="#/app/analyzer">Start analysis</a>`;
}
function renderCurrent() {
  if (!session || !ui.page) return;
  ({ dashboard: renderDashboard, analyzer: prefillAnalyzer, gaps: renderGaps, roadmap: renderRoadmap, assessment: renderAssessment, mentor: renderMentor, analytics: renderAnalytics })[ui.page]();
  renderChrome(); const [t, s] = pageMeta(ui.page); $("#page-title").textContent = t; $("#page-sub").textContent = s;
}
window.addEventListener("hashchange", route);
function closeMenu() { $("#sidebar").classList.remove("open"); $("#scrim").classList.remove("show"); }
$("#menu-btn").addEventListener("click", () => { $("#sidebar").classList.add("open"); $("#scrim").classList.add("show"); });
$("#scrim").addEventListener("click", closeMenu);
async function checkApi() {
  const pill = $("#api-status"), label = $("span", pill);
  pill.className = "status-pill"; label.textContent = "Checking server";
  try {
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 4000);
    await api("/", { signal: ctl.signal }); clearTimeout(timer);
    pill.classList.add("ok"); label.textContent = "Server connected";
  } catch { pill.classList.add("bad"); label.textContent = "Server offline"; }
}
$("#api-status").addEventListener("click", () => { checkApi(); syncFromServer(); });

const emptyHTML = (title, text, cta, href) => `<div class="empty"><svg class="i"><use href="#i-spark"/></svg><h2>${esc(title)}</h2><p>${esc(text)}</p><a class="btn btn-primary" href="${href}">${esc(cta)}</a></div>`;
const NEEDS_ANALYSIS = (what) => emptyHTML("Build your skill profile first", `Your ${what} appears here once SkillPilot has analyzed your skills.`, "Start my analysis", "#/app/analyzer");

/* =========================================================
   Landing page interactions
   ========================================================= */
const sim = { career: "Full Stack Developer", known: new Set() };
function resetSim(career) { sim.career = career; sim.known = new Set(CAREER_SKILLS[career].slice(0, 2)); }
function renderSim() {
  $("#sim-tabs").innerHTML = Object.keys(CAREER_SKILLS).map(c => `<button type="button" role="tab" aria-selected="${c === sim.career}" data-career="${esc(c)}">${SHORT_CAREER[c]}</button>`).join("");
  $("#sim-skills").innerHTML = CAREER_SKILLS[sim.career].map(s => `<button type="button" class="skill-chip" aria-pressed="${sim.known.has(s)}" data-skill="${esc(s)}"><svg class="i"><use href="#i-check"/></svg>${esc(s)}</button>`).join("");
  updateSim(true);
}
function updateSim(first) {
  const req = CAREER_SKILLS[sim.career], val = Math.round((100 * sim.known.size) / req.length);
  const box = $("#sim-ring");
  if (first || !$(".ring-fg", box)) { box.innerHTML = ringHTML(val, { size: 104, stroke: 11 }); fillRings(box); } else setRing(box, val);
  $("#sim-note").textContent = val === 0 ? "Select the skills you have to see your score." : val < 40 ? "A solid start. Several core skills are still missing." : val < 100 ? "You're well on your way. A few gaps left to close." : "You cover every skill in this track. Next, prove it with an assessment.";
  const next = req.find(s => !sim.known.has(s));
  $("#sim-next-skill").textContent = next || "Portfolio project";
  $("#sim-next-hint").textContent = next ? HINTS[next] : "Build and document a project that demonstrates your skills.";
}
$("#sim-tabs").addEventListener("click", e => { const b = e.target.closest("button[data-career]"); if (b) { resetSim(b.dataset.career); renderSim(); } });
$("#sim-skills").addEventListener("click", e => {
  const b = e.target.closest("button[data-skill]"); if (!b) return;
  const s = b.dataset.skill; sim.known.has(s) ? sim.known.delete(s) : sim.known.add(s);
  b.setAttribute("aria-pressed", String(sim.known.has(s))); updateSim(false);
});
function renderTracks() {
  $("#tracks-grid").innerHTML = Object.entries(CAREER_SKILLS).map(([c, skills]) => `
    <a class="track-card" href="#/signup" data-career="${esc(c)}"><h3>${esc(c)}</h3><span class="track-count">${skills.length} core skills</span>
    <span class="track-skills">${skills.slice(0, 4).map(s => `<span>${esc(s)}</span>`).join("")}</span></a>`).join("");
}
$("#tracks-grid").addEventListener("click", e => {
  const a = e.target.closest("a[data-career]"); if (!a) return;
  sessionStorage.setItem("sp_pending_career", a.dataset.career); if (session) a.href = "#/app/analyzer";
});

/* =========================================================
   Skill profile (analyzer) — same ids and API call as before
   ========================================================= */
const form = $("#profile-form");
const parseSkills = () => $("#skills").value.split(",").map(s => s.trim()).filter(Boolean);
function renderSuggest() {
  const career = $("#career").value, box = $("#skill-suggest");
  if (!CAREER_SKILLS[career]) { box.innerHTML = ""; return; }
  const have = new Set(parseSkills().map(lc));
  box.innerHTML = `<span class="suggest-label">Skills this role needs:</span>` + CAREER_SKILLS[career].map(s => `<button type="button" class="skill-chip" data-skill="${esc(s)}" aria-pressed="${have.has(lc(s))}"><svg class="i"><use href="#i-check"/></svg>${esc(s)}</button>`).join("");
}
function prefillAnalyzer() {
  const msg = $("#form-message"); msg.textContent = ""; msg.className = "form-message";
  if (!$("#student-name").value) $("#student-name").value = state.name || session.name || "";
  if (!$("#career").value) $("#career").value = state.career || sessionStorage.getItem("sp_pending_career") || "";
  if (!$("#skills").value && state.declared.length) $("#skills").value = state.declared.join(", ");
  if (!$("#experience").value && state.experience) $("#experience").value = state.experience;
  renderSuggest();
}
$("#career").addEventListener("change", renderSuggest);
$("#skills").addEventListener("input", renderSuggest);
$("#skill-suggest").addEventListener("click", e => {
  const b = e.target.closest("button[data-skill]"); if (!b) return;
  const list = parseSkills(), k = lc(b.dataset.skill), i = list.findIndex(s => lc(s) === k);
  i >= 0 ? list.splice(i, 1) : list.push(b.dataset.skill);
  $("#skills").value = list.join(", "); renderSuggest();
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  const payload = {
    name: $("#student-name").value.trim(), career_goal: $("#career").value,
    skills: parseSkills(), experience: $("#experience").value.trim()
  };
  const message = $("#form-message"), btn = $("#analyze-btn");
  message.className = "form-message"; message.textContent = "";
  btn.disabled = true; btn.classList.add("is-loading"); $(".btn-label", btn).textContent = "Analyzing your profile";
  try {
    const data = await api("/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    state.experience = payload.experience; applyAnalysis(data); saveState();
    toast("Your skill analysis is ready."); location.hash = "#/app/dashboard";
  } catch (error) {
    message.textContent = error instanceof TypeError ? OFFLINE_MSG : error.message;
    if (error instanceof TypeError) checkApi();
  } finally { btn.disabled = false; btn.classList.remove("is-loading"); $(".btn-label", btn).textContent = "Analyze my skills"; }
});

/* =========================================================
   Dashboard
   ========================================================= */
function nextStep() { return roadmapItems().find(i => !state.done[i.skill]) || null; }
function renderDashboard() {
  const el = $("#page-dashboard");
  if (!hasAnalysis()) {
    el.innerHTML = `<div class="empty"><svg class="i"><use href="#i-target"/></svg><h2>Your career readiness score starts here</h2><p>Tell SkillPilot your target career and the skills you have. In a few seconds you'll get a skill map, a roadmap and your first score.</p><a class="btn btn-primary btn-lg" href="#/app/analyzer">Build my skill profile</a></div>`;
    return;
  }
  const r = readiness(), b = breakdown(), items = roadmapItems(), done = doneCount(), next = nextStep(), st = statuses();
  const meter = (label, v, extra = "") => v === null
    ? `<li><span>${label}</span><div class="meter"></div><span class="na">Not taken</span></li>`
    : `<li><span>${label}</span><div class="meter"><i style="width:${v}%"></i></div><b>${v}%</b></li>`;
  el.innerHTML = `<div class="dash-grid">
    <article class="card readiness on-dark">
      <div>${ringHTML(r, { size: 190, stroke: 17 })}</div>
      <div>
        <h2>Career readiness</h2>
        <span class="band">${band(r)}</span>
        <p class="for">for ${esc(state.career)}</p>
        <ul class="meter-list">${meter("Skill coverage", b.cov)}${meter("Assessment", b.asmt)}${meter("Roadmap progress", b.prog)}</ul>
        <details class="how"><summary>How this is calculated</summary><p>Skill coverage counts for 50%, your assessment score for 30% and finished roadmap steps for 20%. Until you take the assessment, only coverage and roadmap progress are used.</p></details>
      </div>
    </article>
    <article class="card next-card">
      <span class="eyebrow-s">${next ? "Up next" : "Roadmap complete"}</span>
      <h3>${next ? esc(next.skill) : "Build a portfolio project"}</h3>
      <p>${next ? esc(next.activity) : "You've finished every step. Retake the assessment to see how much your readiness has grown."}</p>
      ${next && next.priority ? `<span class="tag tag-priority" style="align-self:flex-start">Priority from your assessment</span>` : ""}
      <div class="btn-row">${next ? `<button class="btn btn-primary" data-action="toggle-done" data-skill="${esc(next.skill)}" type="button">Mark as done</button>` : `<a class="btn btn-primary" href="#/app/assessment">Retake assessment</a>`}<a class="btn btn-ghost" href="#/app/roadmap">View roadmap</a></div>
    </article>
    <div class="stats">
      <article class="card stat"><span class="stat-ic"><svg class="i"><use href="#i-target"/></svg></span><p>Target career</p><h3 class="sm" id="stat-career">${esc(state.career)}</h3><small>Your destination</small></article>
      <article class="card stat"><span class="stat-ic"><svg class="i"><use href="#i-check"/></svg></span><p>Skills you have</p><h3 id="stat-skills">${state.current.length}<span class="muted" style="font-size:18px"> / ${state.required.length}</span></h3><small>Required skills listed</small></article>
      <article class="card stat"><span class="stat-ic"><svg class="i"><use href="#i-radar"/></svg></span><p>Skills to develop</p><h3 id="stat-gaps">${state.gaps.length}</h3><small>Identified skill gaps</small></article>
      <article class="card stat"><span class="stat-ic"><svg class="i"><use href="#i-route"/></svg></span><p>Roadmap steps done</p><h3 id="stat-tasks">${done}<span class="muted" style="font-size:18px"> / ${items.length}</span></h3><small>Tick steps off as you finish</small></article>
    </div>
    <article class="card radar-card" id="dash-radar" role="link" tabindex="0" aria-label="Open skill gaps">
      <div class="card-head"><h2>Skill map</h2><span class="pill">Tap to explore</span></div>
      ${radarSVG(st, { size: 360, interactive: false })}
    </article>
    <div class="dash-right">
      <article class="card note-card"><span class="note-ic"><svg class="i"><use href="#i-spark"/></svg></span><div><h3>A note for ${esc(state.name || session.name)}</h3><p id="mentor-message">${esc(state.mentor)}</p><div class="btn-row" style="padding-top:12px"><a class="btn btn-soft btn-sm" href="#/app/mentor">Ask your mentor</a></div></div></article>
      <article class="card assess-card"><div><h3>${state.assessment ? `Last assessment: ${state.assessment.score}%` : "Verify your skills"}</h3><p>${state.assessment ? esc(state.assessment.action) + ". " + esc(state.assessment.message) : "Five questions check what you can actually do and reorder your roadmap."}</p></div><a class="btn ${state.assessment ? "btn-ghost" : "btn-accent"}" href="#/app/assessment">${state.assessment ? "Retake" : "Take the assessment"}</a></article>
    </div></div>`;
  fillRings(el);
}
$("#page-dashboard").addEventListener("click", e => {
  const t = e.target.closest("[data-action='toggle-done']"); if (t) return toggleDone(t.dataset.skill);
  if (e.target.closest("#dash-radar")) location.hash = "#/app/gaps";
});
$("#page-dashboard").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "dash-radar") location.hash = "#/app/gaps"; });
function toggleDone(skill) {
  const now = !state.done[skill]; if (now) state.done[skill] = true; else delete state.done[skill];
  pushHistory("task", `${now ? "Completed" : "Reopened"} ${skill}`); saveState(); renderCurrent();
  toast(now ? "Step marked as done." : "Step reopened.");
}

/* =========================================================
   Skill gaps
   ========================================================= */
function renderGaps() {
  const el = $("#page-gaps");
  if (!hasAnalysis()) { el.innerHTML = NEEDS_ANALYSIS("skill gap map"); return; }
  const st = statuses();
  if (!ui.sel || !st.some(s => s.skill === ui.sel)) ui.sel = (st.find(s => s.status === "gap") || st[0]).skill;
  const extra = state.declared.filter(s => !state.required.some(r => lc(r) === lc(s)));
  el.innerHTML = `<div class="gaps-layout">
    <article class="card chart-card">
      <div class="card-head"><h2>${esc(state.career)} skill map</h2>
        <div class="seg" role="tablist" aria-label="Chart type"><button role="tab" data-view="radar" aria-selected="${ui.gapView === "radar"}">Radar</button><button role="tab" data-view="bars" aria-selected="${ui.gapView === "bars"}">Bars</button></div></div>
      <div id="gap-chart"></div>${legendHTML()}
      <p class="fine" style="margin-top:12px">Distance from the centre is an estimate: gaps sit near the centre, declared skills mid-way and verified skills on the dashed target ring.</p>
    </article>
    <aside class="card detail" id="gap-detail" aria-live="polite"></aside>
  </div>
  <article class="card"><div class="card-head"><h2>All required skills</h2>
    <div class="filters" role="group" aria-label="Filter skills">${[["all", "All"], ["gap", "Gaps"], ["shaky", "Needs practice"], ["declared", "Declared"], ["verified", "Verified"]].map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${ui.filter === k}">${l}</button>`).join("")}</div></div>
    <div class="skill-rows" id="skill-rows"></div>
    ${extra.length ? `<div class="extra">Other skills you listed that this role doesn't track:<div class="chips">${extra.map(s => `<span class="chip">${esc(s)}</span>`).join("")}</div></div>` : ""}
  </article>`;
  drawGapChart(); drawGapDetail(); drawSkillRows();
}
function drawGapChart() {
  const st = statuses(); $("#gap-chart").innerHTML = ui.gapView === "radar" ? radarSVG(st, { selected: ui.sel }) : barsHTML(st, ui.sel);
}
function drawSkillRows() {
  const st = statuses().filter(s => ui.filter === "all" || s.status === ui.filter);
  $("#skill-rows").innerHTML = st.length ? st.map(s => `<button type="button" class="skill-row${ui.sel === s.skill ? " sel" : ""}" data-skill="${esc(s.skill)}"><span class="dot ${STATUS[s.status].cls}"></span><b>${esc(s.skill)}</b><small>${STATUS[s.status].label}</small></button>`).join("") : `<div class="chart-empty" style="grid-column:1/-1">No skills match this filter yet.</div>`;
}
function drawGapDetail() {
  const s = statuses().find(x => x.skill === ui.sel); if (!s) return;
  const item = roadmapItems().find(i => lc(i.skill) === lc(s.skill)); const meta = STATUS[s.status];
  const why = {
    gap: `You haven't listed this skill yet, and ${state.career} roles require it.${s.passedUndeclared ? " You answered its assessment question correctly, so add it to your profile and re-run the analysis to count it." : ""}`,
    declared: s.assessed ? "You listed this skill." : "You listed this skill. The current assessment doesn't test it yet, so it counts as declared.",
    verified: "You listed this skill and answered its assessment question correctly.",
    shaky: "You listed this skill but missed its assessment question, so it moved up your roadmap."
  }[s.status];
  const hint = item ? item.activity : HINTS[s.skill];
  $("#gap-detail").innerHTML = `<span class="status-tag"><span class="dot ${meta.cls}"></span>${meta.label}</span><h3>${esc(s.skill)}</h3><p>${esc(why)}</p>
    <div class="lvl" role="img" aria-label="Estimated level ${s.level} percent"><i style="width:${Math.max(s.level, 4)}%;background:${meta.color}"></i></div><span class="lvl-note">Estimated level ${s.level}%</span>
    ${hint ? `<div class="todo"><b>${item ? "On your roadmap" : "Suggested practice"}</b>${esc(hint)}</div>` : ""}
    ${item ? `<a class="btn btn-primary btn-sm" href="#/app/roadmap" data-focus="${esc(s.skill)}">Open roadmap step</a>` : ""}`;
}
function selectSkill(skill) {
  ui.sel = skill;
  $$("#page-gaps [data-skill]").forEach(n => n.classList.toggle("sel", n.dataset.skill === skill));
  drawGapDetail();
}
$("#page-gaps").addEventListener("click", e => {
  const v = e.target.closest("[data-view]"); if (v) { ui.gapView = v.dataset.view; $$("[data-view]", $("#page-gaps")).forEach(b => b.setAttribute("aria-selected", String(b === v))); return drawGapChart(); }
  const f = e.target.closest("[data-filter]"); if (f) { ui.filter = f.dataset.filter; $$("[data-filter]", $("#page-gaps")).forEach(b => b.setAttribute("aria-pressed", String(b === f))); return drawSkillRows(); }
  const fo = e.target.closest("[data-focus]"); if (fo) { ui.focusSkill = fo.dataset.focus; return; }
  const s = e.target.closest("[data-skill]"); if (s) selectSkill(s.dataset.skill);
});
$("#page-gaps").addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target.matches(".radar-pt")) { e.preventDefault(); selectSkill(e.target.dataset.skill); } });

/* =========================================================
   Adaptive roadmap
   ========================================================= */
function renderRoadmap() {
  const el = $("#page-roadmap");
  if (!hasAnalysis()) { el.innerHTML = NEEDS_ANALYSIS("roadmap"); return; }
  const items = roadmapItems(), done = doneCount(), pct = items.length ? Math.round((100 * done) / items.length) : 0;
  const cur = items.findIndex(i => !state.done[i.skill]);
  const a = state.assessment;
  el.innerHTML = `<article class="card road-head"><div><h2 id="roadmap-title">${esc(state.career)} roadmap</h2>
      <div class="prog-bar" role="img" aria-label="${pct} percent complete"><i style="width:${pct}%"></i></div><div class="prog-meta"><span>${done} of ${items.length} steps done</span><span>${pct}%</span></div></div>
      <a class="btn btn-soft" href="#/app/assessment">${a ? "Retake assessment" : "Take the assessment"}</a></article>
    <div class="adapt"><span class="note-ic"><svg class="i"><use href="#i-spark"/></svg></span><div>
      <h3>${a ? esc(a.action) : "Starter order"}</h3>
      <p>${a ? esc(a.message) + (a.weak.length ? ` You missed: ${esc(a.weak.join(", "))}. Any of these on your plan are marked Priority and moved to the front.` : "") : "Take the assessment and any skill you miss moves to the front of this plan."}</p></div></div>
    <ol class="timeline" id="roadmap-list">${items.map((it, i) => {
      const d = !!state.done[it.skill], c = i === cur;
      return `<li class="t-item${d ? " done" : ""}${c ? " current" : ""}" data-skill="${esc(it.skill)}">
        <span class="t-dot">${d ? `<svg class="i"><use href="#i-check"/></svg>` : i + 1}</span>
        <div class="t-card"><div class="t-top"><h3>${esc(it.skill)}</h3>${it.priority ? `<span class="tag tag-priority">Priority</span>` : ""}${c ? `<span class="tag">Up next</span>` : ""}</div>
        <p>${esc(it.activity)}</p>
        <div class="t-actions"><button type="button" class="btn ${d ? "btn-ghost" : "btn-primary"} btn-sm" data-action="toggle-done" data-skill="${esc(it.skill)}" aria-pressed="${d}">${d ? "Reopen step" : "Mark as done"}</button></div></div></li>`;
    }).join("")}</ol>`;
  if (ui.focusSkill) {
    const node = $$(".t-item", el).find(n => n.dataset.skill === ui.focusSkill); ui.focusSkill = null;
    if (node) { node.scrollIntoView({ block: "center" }); node.classList.add("flash"); }
  }
}
$("#page-roadmap").addEventListener("click", e => { const t = e.target.closest("[data-action='toggle-done']"); if (t) toggleDone(t.dataset.skill); });

/* =========================================================
   Assessment — same endpoints and payloads as before
   ========================================================= */
function renderAssessment() {
  const el = $("#page-assessment");
  if (!hasAnalysis()) { el.innerHTML = NEEDS_ANALYSIS("assessment"); return; }
  const a = ui.assess;
  if (a.stage === "loading") { el.innerHTML = `<div class="card loading-card"><span class="spinner"></span><p class="muted" style="margin-top:14px">Preparing your assessment</p></div>`; return; }
  if (a.stage === "quiz") return renderQuiz(el);
  if (a.stage === "result") return renderResult(el, a.result);
  const last = state.assessment;
  el.innerHTML = `<div class="intro-grid"><article class="card"><h2>Check what you can actually do</h2>
    <p class="muted" style="margin-top:10px">Listing a skill isn't the same as having it. These questions test the basics and tell your roadmap where to focus.</p>
    <ul class="facts"><li><svg class="i"><use href="#i-quiz"/></svg>Multiple choice, one question at a time</li><li><svg class="i"><use href="#i-route"/></svg>Missed skills move to the top of your roadmap</li><li><svg class="i"><use href="#i-chart"/></svg>Your score feeds your readiness</li></ul>
    ${a.error ? `<p class="form-message" role="alert" style="margin-bottom:14px">${esc(a.error)}</p>` : ""}
    <button class="btn btn-primary btn-lg" id="start-assessment" type="button">${last ? "Retake assessment" : "Start assessment"}</button></article>
    <article class="card side-info">${last ? `<h3>Last result</h3><div style="display:flex;gap:20px;align-items:center;margin-top:8px"><div>${ringHTML(last.score, { size: 110, stroke: 12 })}</div><div><b style="color:var(--forest)">${last.correct} of ${last.total} correct</b><p class="muted" style="font-size:14.5px;margin-top:4px">${esc(last.action)}</p></div></div><p class="info-note">${esc(last.message)}</p>` : `<h3>What it covers</h3><p class="muted" style="margin-top:8px">The starter assessment checks core web and database basics. More skills will be added over time.</p>`}</article></div>`;
  fillRings(el);
}
$("#page-assessment").addEventListener("click", async e => {
  if (e.target.closest("#start-assessment")) return loadAssessment();
  if (e.target.closest("[data-q='next']")) { ui.assess.idx++; return renderCurrent(); }
  if (e.target.closest("[data-q='back']")) { ui.assess.idx--; return renderCurrent(); }
  if (e.target.closest("[data-q='submit']")) return submitAssessment(e.target.closest("button"));
  if (e.target.closest("[data-q='retake']")) { ui.assess = { stage: "intro" }; return loadAssessment(); }
});
$("#page-assessment").addEventListener("change", e => {
  if (e.target.matches(".opt input")) { ui.assess.answers[e.target.dataset.q] = e.target.value; const nb = $("[data-q='next'],[data-q='submit']", $("#page-assessment")); if (nb) nb.disabled = false; }
});
async function loadAssessment() {
  ui.assess = { stage: "loading" }; renderCurrent();
  try {
    const data = await api("/assessment/questions");
    if (!data.questions.length) throw new Error("No assessment questions are available yet.");
    ui.assess = { stage: "quiz", q: data.questions, idx: 0, answers: {} };
  } catch (err) { ui.assess = { stage: "intro", error: err instanceof TypeError ? OFFLINE_MSG : err.message }; }
  renderCurrent();
}
function renderQuiz(el) {
  const a = ui.assess, q = a.q[a.idx], last = a.idx === a.q.length - 1, chosen = a.answers[q.id];
  el.innerHTML = `<div class="quiz-wrap"><article class="card">
    <div class="q-progress" aria-hidden="true">${a.q.map((_, i) => `<i class="${i < a.idx ? "done" : i === a.idx ? "cur" : ""}"></i>`).join("")}</div>
    <div class="q-meta"><span>Question ${a.idx + 1} of ${a.q.length}</span><span class="tag">${esc(q.skill)}</span></div>
    <h2 class="q-text" id="q-title">${esc(q.question)}</h2>
    <div class="opts" role="radiogroup" aria-labelledby="q-title">${q.options.map(o => `<label class="opt"><input type="radio" name="question-${q.id}" data-q="${q.id}" value="${esc(o)}"${chosen === o ? " checked" : ""}/><span class="radio"></span><code>${esc(o)}</code></label>`).join("")}</div>
    <div class="q-nav"><button class="btn btn-ghost" type="button" data-q="back"${a.idx === 0 ? " disabled" : ""}>Back</button>
    <button class="btn ${last ? "btn-accent" : "btn-primary"}" type="button" data-q="${last ? "submit" : "next"}"${chosen ? "" : " disabled"}><span class="spinner" aria-hidden="true"></span><span class="btn-label">${last ? "Submit answers" : "Next question"}</span></button></div>
  </article></div>`;
}
async function submitAssessment(btn) {
  const a = ui.assess; btn.disabled = true; btn.classList.add("is-loading"); $(".btn-label", btn).textContent = "Evaluating your answers";
  try {
    const r = await api("/assessment/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ learner_id: state.learnerId, answers: a.answers }) });
    state.assessment = { score: r.score, correct: r.correct_answers, total: r.total_questions, weak: r.weak_skills, assessed: a.q.map(x => x.skill), action: r.adaptation.recommended_action, message: r.adaptation.message, at: Date.now() };
    if (r.adaptive_roadmap) state.roadmap = r.adaptive_roadmap;
    pushHistory("assessment", `Assessment: ${r.score}%`, { score: r.score }); saveState();
    ui.assess = { stage: "result", result: r }; renderCurrent();
  } catch (err) {
    btn.disabled = false; btn.classList.remove("is-loading"); $(".btn-label", btn).textContent = "Submit answers";
    toast(err instanceof TypeError ? "Can't reach the server. Is the backend running?" : err.status === 404 ? "Your learner profile wasn't found. Re-run your skill analysis." : err.message);
  }
}
function renderResult(el, r) {
  el.innerHTML = `<div class="quiz-wrap"><article class="card result"><div>${ringHTML(r.score, { size: 170, stroke: 16 })}</div>
    <div><h2>${r.correct_answers} of ${r.total_questions} correct</h2><p><b>${esc(r.adaptation.recommended_action)}.</b> ${esc(r.adaptation.message)}</p>
    <h3 style="font-size:16px;margin-top:18px">Skills needing attention</h3><div class="chips">${r.weak_skills.length ? r.weak_skills.map(s => `<span class="chip gap">${esc(s)}</span>`).join("") : `<span class="chip">All questions answered correctly</span>`}</div></div>
    <div class="result-actions"><a class="btn btn-primary" href="#/app/roadmap">See updated roadmap</a><a class="btn btn-soft" href="#/app/gaps">View skill map</a><button class="btn btn-ghost" type="button" data-q="retake">Retake</button></div></article></div>`;
  fillRings(el);
}

/* =========================================================
   AI mentor (rule-based, uses your analysis data)
   ========================================================= */
const PROMPTS = ["What should I learn first?", "Which skills am I missing?", "How is my score calculated?", "Explain my assessment result"];
function mentorReply(text) {
  const t = lc(text), items = roadmapItems(), r = readiness(), b = breakdown(), next = nextStep();
  const skill = [...state.required, ...Object.keys(HINTS)].find(s => new RegExp("(^|[^a-z0-9])" + lc(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9])").test(t));
  if (skill) {
    const it = items.find(i => lc(i.skill) === lc(skill)), isGap = state.gaps.some(g => lc(g) === lc(skill));
    return `${skill}: ${it ? it.activity : HINTS[skill] || "Study the fundamentals and complete a small practical project."} ${isGap ? `It's a gap for ${state.career}, so it's worth prioritizing.` : "You already listed this one, so use projects to show you can apply it."}`;
  }
  if (/thank|thanks|great|awesome/.test(t)) return "You're welcome. Mark your next step as done when you finish it and I'll keep your score up to date.";
  if (/calculat|formula|how.*(score|readiness)|what.*(score|readiness)/.test(t)) return `Your readiness is ${r}%. Skill coverage (${b.cov}%) counts for 50%, your assessment ${b.asmt === null ? "(not taken yet, so it isn't counted)" : `(${b.asmt}%)`} for 30%, and roadmap progress (${b.prog}%) for 20%.`;
  if (/assess|quiz|test|result|weak/.test(t)) return state.assessment ? `You scored ${state.assessment.score}% (${state.assessment.correct} of ${state.assessment.total}). ${state.assessment.message} ${state.assessment.weak.length ? "Skills to revisit: " + state.assessment.weak.join(", ") + "." : "You answered every question correctly."}` : "You haven't taken the assessment yet. It takes a couple of minutes and moves any skill you miss to the front of your roadmap.";
  if (/gap|missing|lack|need/.test(t)) return state.gaps.length ? `For ${state.career} you're still missing ${state.gaps.join(", ")}. ${next ? `Start with ${next.skill}.` : ""}` : `You've listed every skill ${state.career} requires. Next, prove them with the assessment and projects.`;
  if (/first|next|start|begin|focus|learn/.test(t)) return next ? `Start with ${next.skill}. ${next.activity}${next.priority ? " It's a priority because it came up in your assessment." : ""} Mark it done on your roadmap when you finish.` : "You've completed every roadmap step. Build a portfolio project and retake the assessment.";
  if (/roadmap|plan|order|steps/.test(t)) return `Your roadmap has ${items.length} steps: ${items.map(i => i.skill).join(", ")}. ${b.asmt !== null ? "Skills you missed in the assessment are placed first." : "Take the assessment and any skill you miss moves to the front."} You've finished ${doneCount()}.`;
  if (/ready|progress|how am i/.test(t)) return `You're ${r}% career ready (${band(r).toLowerCase()}). ${next ? `The quickest way to move the score is finishing ${next.skill}.` : ""}`;
  if (/hi\b|hello|hey/.test(t)) return `Hi ${state.name || session.name}. I can explain your gaps, your next step or your score. What would you like to know?`;
  return "I can help with your next step, your skill gaps, your readiness score and your assessment result. You can also ask about any skill on your plan, like " + (state.required[0] || "SQL") + ".";
}
function renderMentor() {
  const el = $("#page-mentor");
  if (!hasAnalysis()) { el.innerHTML = NEEDS_ANALYSIS("mentor chat"); return; }
  if (!ui.agents) loadAgents();
  const agents = ui.agents || FALLBACK_AGENTS, r = readiness(), next = nextStep();
  el.innerHTML = `<div class="mentor-layout"><article class="card chat" aria-label="Chat with your mentor">
    <div class="chat-head"><span class="note-ic"><svg class="i"><use href="#i-spark"/></svg></span><div><b>Your AI mentor</b><small>Answers from your analysis, assessment and roadmap</small></div></div>
    <div class="msgs" id="msgs" role="log" aria-live="polite"></div>
    <div class="prompts" id="prompts">${PROMPTS.map(p => `<button type="button" data-prompt="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <form class="chat-form" id="chat-form"><input id="chat-input" type="text" placeholder="Ask about your plan or a skill" autocomplete="off" aria-label="Message your mentor" /><button class="btn btn-primary" type="submit" aria-label="Send"><svg class="i"><use href="#i-send"/></svg></button></form></article>
    <div class="mentor-side"><article class="card"><h3 style="font-size:19px">Your context</h3><ul class="ctx-list"><li><span>Career</span><b>${esc(state.career)}</b></li><li><span>Readiness</span><b>${r}%</b></li><li><span>Next step</span><b>${next ? esc(next.skill) : "All done"}</b></li><li><span>Gaps</span><b>${state.gaps.length}</b></li></ul></article>
    <article class="card"><h3 style="font-size:19px">The agents behind your plan</h3><ul class="agent-mini">${agents.map(a => `<li><span class="dot"></span><div><b>${esc(a.name)}</b><span>${esc(a.role)}</span></div></li>`).join("")}</ul>
    <p class="fine" style="margin-top:16px">Mentor replies are rule-based and use your own data. They aren't from a live language model.</p></article></div></div>`;
  drawMsgs();
}
function drawMsgs() {
  const box = $("#msgs"); if (!box) return;
  box.innerHTML = state.chat.map(m => `<div class="msg ${m.role}">${esc(m.text)}</div>`).join("") + (ui.typing ? `<div class="msg bot typing" aria-label="Mentor is typing"><i></i><i></i><i></i></div>` : "");
  box.scrollTop = box.scrollHeight;
}
function sendChat(text) {
  text = text.trim(); if (!text || ui.typing) return;
  state.chat.push({ role: "user", text, at: Date.now() }); ui.typing = true; drawMsgs();
  setTimeout(() => {
    state.chat.push({ role: "bot", text: mentorReply(text), at: Date.now() }); state.chat = state.chat.slice(-50);
    ui.typing = false; saveState(); drawMsgs();
  }, 650);
}
$("#page-mentor").addEventListener("submit", e => { e.preventDefault(); const i = $("#chat-input"); const v = i.value; i.value = ""; sendChat(v); });
$("#page-mentor").addEventListener("click", e => { const p = e.target.closest("[data-prompt]"); if (p) sendChat(p.dataset.prompt); });
async function loadAgents() {
  try { const d = await api("/agents"); ui.agents = d.agents; if (ui.page === "mentor") renderCurrent(); } catch { ui.agents = FALLBACK_AGENTS; }
}

/* =========================================================
   Progress analytics
   ========================================================= */
function renderAnalytics() {
  const el = $("#page-analytics");
  if (!hasAnalysis()) { el.innerHTML = NEEDS_ANALYSIS("progress analytics"); return; }
  const hist = state.history, r = readiness(), first = hist.length ? hist[0].readiness : r, delta = r - first;
  const st = statuses(), counts = { verified: 0, declared: 0, shaky: 0, gap: 0 }; st.forEach(s => counts[s.status]++);
  const tests = hist.filter(h => h.type === "assessment").length, items = roadmapItems(), a = state.assessment;
  const icon = { analysis: "st-declared", assessment: "st-gap", task: "st-verified" };
  el.innerHTML = `<div class="kpis">
    <article class="card kpi"><p>Career readiness</p><h3>${r}%</h3><small>${band(r)}</small></article>
    <article class="card kpi ${delta > 0 ? "up" : ""}"><p>Change since first analysis</p><h3>${delta > 0 ? "+" : ""}${delta} pts</h3><small>${hist.length} recorded ${hist.length === 1 ? "event" : "events"}</small></article>
    <article class="card kpi"><p>Assessments taken</p><h3>${tests}</h3><small>${a ? `Latest score ${a.score}%` : "None yet"}</small></article>
    <article class="card kpi"><p>Roadmap steps done</p><h3>${doneCount()}<span class="muted" style="font-size:20px"> / ${items.length}</span></h3><small>${items.length - doneCount()} remaining</small></article></div>
  <div class="an-grid">
    <article class="card"><div class="card-head"><h2>Readiness over time</h2></div>${lineChart(hist)}${hist.length < 2 ? `<p class="chart-empty" style="margin-top:14px">Finish a roadmap step or retake the assessment to start drawing your trend.</p>` : ""}</article>
    <article class="card"><div class="card-head"><h2>Skills by status</h2></div><div class="donut-wrap">${donutHTML(counts, st.length)}<ul class="legend">${Object.entries(STATUS).map(([k, s]) => `<li><span class="dot ${s.cls}"></span>${s.label}: <b>${counts[k]}</b></li>`).join("")}</ul></div></article>
    <article class="card"><div class="card-head"><h2>Assessment by skill</h2></div>${a ? `<div class="pf-rows">${a.assessed.map(s => { const bad = a.weak.some(w => lc(w) === lc(s)); return `<div class="pf-row ${bad ? "bad" : "ok"}"><b>${esc(s)}</b><span>${bad ? "Needs practice" : "Correct"}</span></div>`; }).join("")}</div>` : `<p class="chart-empty">Take the assessment to see how you did on each skill.</p>`}</article>
    <article class="card"><div class="card-head"><h2>Recent activity</h2></div><ul class="activity">${[...hist].reverse().slice(0, 7).map(h => `<li><span class="dot ${icon[h.type]}"></span><span>${esc(h.label)}</span><time>${fmtDate(h.at)}</time></li>`).join("")}</ul></article>
  </div>`;
}

/* =========================================================
   Init
   ========================================================= */
resetSim("Full Stack Developer"); renderSim(); renderTracks();
route();
