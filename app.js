// ---------- Helpers ----------
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "sxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
}
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function checked(id) { const el = document.getElementById(id); return !!(el && el.checked); }

const WOCHENTAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function fmtDatum(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${WOCHENTAGE_KURZ[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function zeitText(t) {
  if (!t.startZeit) return "";
  return t.endZeit ? `${t.startZeit}–${t.endZeit} Uhr` : `${t.startZeit} Uhr`;
}
function fmtEuro(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
function parseBetrag(s) {
  const n = parseFloat(String(s).replace(",", "."));
  return isNaN(n) ? NaN : n;
}
function terminTyp(id) { return TERMIN_TYPEN.find((t) => t.id === id) || TERMIN_TYPEN[0]; }

// ---------- State ----------
let appData = { meta: {}, teams: [] };
let currentUser = null;
let currentTab = "termine";
let currentTeamId = null;
let termineFilter = "kommend";
let statistikJahr = "alle";
let editingTeamId = null;
let editingSpielerId = null;
let editingTerminId = null;
let detailTerminId = null;
let editingUmfrageId = null;
let editingBuchungId = null;
let persistTimer = null;

// ---------- Normalisierung ----------
function normalizeSpieler(s) {
  const d = s && typeof s === "object" ? s : {};
  return {
    id: d.id || uuid(),
    name: typeof d.name === "string" ? d.name : "",
    position: typeof d.position === "string" ? d.position : "",
    nummer: d.nummer == null ? "" : String(d.nummer),
    linkedUsername: typeof d.linkedUsername === "string" ? d.linkedUsername : ""
  };
}
function normalizeTeilnahme(obj, kaderIds) {
  const out = {};
  if (obj && typeof obj === "object") {
    Object.keys(obj).forEach((sid) => {
      if (!kaderIds.includes(sid)) return;
      const e = obj[sid] || {};
      const status = TEILNAHME_STATUS.some((s) => s.id === e.status) ? e.status : null;
      if (!status) return;
      out[sid] = { status, grund: typeof e.grund === "string" ? e.grund : "", am: typeof e.am === "string" ? e.am : "" };
    });
  }
  return out;
}
function normalizeTermin(t, kaderIds) {
  const d = t && typeof t === "object" ? t : {};
  return {
    id: d.id || uuid(),
    typ: TERMIN_TYPEN.some((x) => x.id === d.typ) ? d.typ : "training",
    titel: typeof d.titel === "string" ? d.titel : "",
    datum: typeof d.datum === "string" ? d.datum : "",
    startZeit: typeof d.startZeit === "string" ? d.startZeit : "",
    endZeit: typeof d.endZeit === "string" ? d.endZeit : "",
    ort: typeof d.ort === "string" ? d.ort : "",
    gegner: typeof d.gegner === "string" ? d.gegner : "",
    treffpunkt: typeof d.treffpunkt === "string" ? d.treffpunkt : "",
    notiz: typeof d.notiz === "string" ? d.notiz : "",
    teilnahme: normalizeTeilnahme(d.teilnahme, kaderIds)
  };
}
function normalizeUmfrage(u, kaderIds) {
  const d = u && typeof u === "object" ? u : {};
  const optionen = Array.isArray(d.optionen)
    ? d.optionen.filter((o) => o && o.id && typeof o.text === "string").map((o) => ({ id: String(o.id), text: o.text }))
    : [];
  const optionIds = optionen.map((o) => o.id);
  const stimmen = {};
  if (d.stimmen && typeof d.stimmen === "object") {
    Object.keys(d.stimmen).forEach((sid) => {
      if (!kaderIds.includes(sid)) return;
      const arr = Array.isArray(d.stimmen[sid]) ? d.stimmen[sid].filter((oid) => optionIds.includes(oid)) : [];
      if (arr.length) stimmen[sid] = arr;
    });
  }
  return {
    id: d.id || uuid(),
    frage: typeof d.frage === "string" ? d.frage : "",
    mehrfach: !!d.mehrfach,
    offen: d.offen !== false,
    erstelltAm: typeof d.erstelltAm === "string" ? d.erstelltAm : new Date().toISOString(),
    optionen,
    stimmen
  };
}
function normalizeStrafe(s) {
  const d = s && typeof s === "object" ? s : {};
  return { id: d.id || uuid(), bezeichnung: typeof d.bezeichnung === "string" ? d.bezeichnung : "", betrag: Number(d.betrag) || 0 };
}
function normalizeBuchung(b, kaderIds) {
  const d = b && typeof b === "object" ? b : {};
  const sid = kaderIds.includes(d.spielerId) ? d.spielerId : null;
  return {
    id: d.id || uuid(),
    datum: typeof d.datum === "string" ? d.datum : "",
    spielerId: sid,
    bezeichnung: typeof d.bezeichnung === "string" ? d.bezeichnung : "",
    betrag: Math.abs(Number(d.betrag) || 0),
    richtung: d.richtung === "aus" ? "aus" : "ein",
    bezahlt: !!d.bezahlt
  };
}
function normalizeKasse(k, kaderIds) {
  const d = k && typeof k === "object" ? k : {};
  return {
    strafenkatalog: Array.isArray(d.strafenkatalog) ? d.strafenkatalog.map(normalizeStrafe) : [],
    buchungen: Array.isArray(d.buchungen) ? d.buchungen.map((b) => normalizeBuchung(b, kaderIds)) : []
  };
}
function normalizeTeam(t) {
  const d = t && typeof t === "object" ? t : {};
  const kader = Array.isArray(d.kader) ? d.kader.map(normalizeSpieler) : [];
  const kaderIds = kader.map((s) => s.id);
  return {
    id: d.id || uuid(),
    name: typeof d.name === "string" ? d.name : "",
    farbe: /^#[0-9a-fA-F]{6}$/.test(d.farbe) ? d.farbe : "#1a56a0",
    kader,
    termine: Array.isArray(d.termine) ? d.termine.map((x) => normalizeTermin(x, kaderIds)) : [],
    umfragen: Array.isArray(d.umfragen) ? d.umfragen.map((x) => normalizeUmfrage(x, kaderIds)) : [],
    kasse: normalizeKasse(d.kasse, kaderIds)
  };
}
function normalizeData(data) {
  const d = data && typeof data === "object" ? data : {};
  const teams = Array.isArray(d.teams) ? d.teams.map(normalizeTeam) : [];
  const meta = d.meta && typeof d.meta === "object" ? Object.assign({}, d.meta) : {};
  if (!teams.some((t) => t.id === meta.currentTeamId)) meta.currentTeamId = teams[0] ? teams[0].id : null;
  return { meta, teams };
}
function seedTeam(name, farbe) {
  return {
    id: uuid(), name, farbe: farbe || "#1a56a0",
    kader: [], termine: [], umfragen: [],
    kasse: { strafenkatalog: clone(DEFAULT_STRAFEN).map((s) => ({ id: uuid(), bezeichnung: s.bezeichnung, betrag: s.betrag })), buchungen: [] }
  };
}

// ---------- Zugriff / Rechte ----------
function currentTeam() { return appData.teams.find((t) => t.id === currentTeamId) || null; }
function canManage() {
  if (!currentUser) return false;
  return currentUser.isAdmin || !!currentUser.canEdit;
}
function myUsername() { return currentUser && currentUser.username ? currentUser.username : null; }
function myPlayerId(team) {
  const u = myUsername();
  if (!u || !team) return null;
  const p = team.kader.find((s) => s.linkedUsername && s.linkedUsername.toLowerCase() === u.toLowerCase());
  return p ? p.id : null;
}
function findSpieler(team, id) { return team.kader.find((s) => s.id === id) || null; }
function terminIstKommend(termin) { return (termin.datum || "") >= todayISO(); }
function canSetStatusFor(team, spielerId, termin) {
  if (canManage()) return true;
  return myPlayerId(team) === spielerId && terminIstKommend(termin);
}

// ---------- Team-Auswahl ----------
function renderTeamSelect() {
  const el = document.getElementById("team-select");
  const teams = appData.teams;
  if (!teams.some((t) => t.id === currentTeamId)) currentTeamId = teams[0] ? teams[0].id : null;
  el.innerHTML = teams.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join("");
  if (currentTeamId) el.value = currentTeamId;
  el.disabled = teams.length === 0;
}
function selectTeam(id) {
  currentTeamId = id;
  appData.meta.currentTeamId = id;
  renderAll();
}
// Blendet den passenden "Noch keine Mannschaft"-Hinweis ein und liefert das aktuelle
// Team (oder null). true -> Inhalt rendern, false -> abbrechen.
function teamOr(noTeamId, contentIds) {
  const team = currentTeam();
  const noTeam = document.getElementById(noTeamId);
  if (noTeam) noTeam.classList.toggle("hidden", !!team);
  contentIds.forEach((cid) => { const el = document.getElementById(cid); if (el) el.classList.toggle("hidden", !team); });
  return team;
}

// ---------- Termine ----------
function bilanz(team, termin) {
  const c = { zu: 0, unsicher: 0, ab: 0, offen: 0 };
  team.kader.forEach((s) => {
    const e = termin.teilnahme[s.id];
    if (e && c[e.status] != null) c[e.status]++;
    else c.offen++;
  });
  return c;
}
function bilanzHtml(c) {
  return `<div class="termin-bilanz">
    <span class="bilanz-chip zu">✓ ${c.zu}</span>
    <span class="bilanz-chip unsicher">? ${c.unsicher}</span>
    <span class="bilanz-chip ab">✗ ${c.ab}</span>
    <span class="bilanz-chip offen">offen ${c.offen}</span>
  </div>`;
}
function terminSubHtml(t) {
  const parts = [fmtDatum(t.datum)];
  const z = zeitText(t);
  if (z) parts.push(z);
  let html = parts.join(" · ");
  const line2 = [];
  if (t.ort) line2.push("📍 " + escapeHtml(t.ort));
  if (t.typ === "spiel" && t.gegner) line2.push("gegen " + escapeHtml(t.gegner));
  if (t.treffpunkt) line2.push("🕑 " + escapeHtml(t.treffpunkt));
  return `${escapeHtml(html)}${line2.length ? `<br>${line2.join(" · ")}` : ""}`;
}
function renderTermine() {
  const team = teamOr("no-team-termine", ["termine-list", "termine-empty"]);
  document.querySelectorAll("#termine-filter button").forEach((b) => b.classList.toggle("active", b.dataset.filter === termineFilter));
  const listEl = document.getElementById("termine-list");
  const emptyEl = document.getElementById("termine-empty");
  if (!team) { listEl.innerHTML = ""; emptyEl.classList.add("hidden"); return; }
  const today = todayISO();
  let list = team.termine.filter((t) => termineFilter === "kommend" ? (t.datum || "") >= today : (t.datum || "") < today);
  list.sort((a, b) => termineFilter === "kommend" ? (a.datum || "").localeCompare(b.datum || "") : (b.datum || "").localeCompare(a.datum || ""));
  emptyEl.classList.toggle("hidden", list.length > 0);
  const myId = myPlayerId(team);
  listEl.innerHTML = list.map((t) => {
    const typ = terminTyp(t.typ);
    const titel = t.titel || typ.label;
    const c = bilanz(team, t);
    let rsvp = "";
    if (myId && termineFilter === "kommend") {
      const mine = t.teilnahme[myId] ? t.teilnahme[myId].status : "";
      rsvp = `<div class="rsvp-row">
        <span class="rsvp-label">Deine Rückmeldung:</span>
        <div class="rsvp-buttons">
          ${TEILNAHME_STATUS.map((s) => `<button class="rsvp-btn${s.id === mine ? " active" : ""}" data-rsvp-termin="${escapeHtml(t.id)}" data-status="${s.id}">${s.kurz} ${s.label}</button>`).join("")}
        </div>
      </div>`;
    }
    return `<div class="termin-card" style="border-left-color:${typ.farbe}">
      <div class="termin-main" data-open-termin="${escapeHtml(t.id)}">
        <div class="termin-info">
          <span class="termin-type-icon">${typ.icon}</span>
          <div>
            <div class="termin-title">${escapeHtml(titel)}</div>
            <div class="termin-sub">${terminSubHtml(t)}</div>
          </div>
        </div>
        ${bilanzHtml(c)}
      </div>
      ${rsvp}
    </div>`;
  }).join("");
}

// gemeinsame Statuslogik (Toggle: gleicher Status erneut -> zurück auf "offen")
function applyStatus(termin, spielerId, status) {
  const cur = termin.teilnahme[spielerId] && termin.teilnahme[spielerId].status;
  if (cur === status) delete termin.teilnahme[spielerId];
  else termin.teilnahme[spielerId] = { status, am: new Date().toISOString() };
}
function setMyStatus(terminId, status) {
  const team = currentTeam();
  if (!team) return;
  const termin = team.termine.find((t) => t.id === terminId);
  if (!termin) return;
  const myId = myPlayerId(team);
  if (!myId || !terminIstKommend(termin)) return;
  applyStatus(termin, myId, status);
  persist();
  renderTermine();
  if (detailTerminId === terminId) renderDetail();
}
function setStatusFor(terminId, spielerId, status) {
  const team = currentTeam();
  if (!team) return;
  const termin = team.termine.find((t) => t.id === terminId);
  if (!termin || !canSetStatusFor(team, spielerId, termin)) return;
  applyStatus(termin, spielerId, status);
  persist();
  renderDetail();
  renderTermine();
}

// ---------- Termin-Detail (Teilnahme je Spieler) ----------
function openDetail(terminId) {
  const team = currentTeam();
  if (!team) return;
  const termin = team.termine.find((t) => t.id === terminId);
  if (!termin) return;
  detailTerminId = terminId;
  renderDetail();
  document.getElementById("detail-modal").classList.remove("hidden");
}
function closeDetail() {
  document.getElementById("detail-modal").classList.add("hidden");
  detailTerminId = null;
}
function renderDetail() {
  const team = currentTeam();
  if (!team || !detailTerminId) return;
  const termin = team.termine.find((t) => t.id === detailTerminId);
  if (!termin) { closeDetail(); return; }
  const typ = terminTyp(termin.typ);
  document.getElementById("detail-modal-title").textContent = termin.titel || typ.label;
  const ctxLines = [`<div class="dc-title">${typ.icon} ${escapeHtml(termin.titel || typ.label)}</div>`];
  ctxLines.push(`${escapeHtml(fmtDatum(termin.datum))}${zeitText(termin) ? " · " + escapeHtml(zeitText(termin)) : ""}`);
  if (termin.ort) ctxLines.push("📍 " + escapeHtml(termin.ort));
  if (termin.typ === "spiel" && termin.gegner) ctxLines.push("Gegner: " + escapeHtml(termin.gegner));
  if (termin.treffpunkt) ctxLines.push("🕑 Treffpunkt: " + escapeHtml(termin.treffpunkt));
  if (termin.notiz) ctxLines.push("📝 " + escapeHtml(termin.notiz));
  document.getElementById("detail-context").innerHTML = ctxLines.join("<br>");

  const myId = myPlayerId(team);
  const selfEl = document.getElementById("detail-self");
  if (myId && terminIstKommend(termin)) {
    const mine = termin.teilnahme[myId] ? termin.teilnahme[myId].status : "";
    selfEl.innerHTML = `<div class="rsvp-row" style="border:none;padding:0 0 14px;">
      <span class="rsvp-label">Deine Rückmeldung:</span>
      <div class="rsvp-buttons">
        ${TEILNAHME_STATUS.map((s) => `<button class="rsvp-btn${s.id === mine ? " active" : ""}" data-detail-self data-status="${s.id}">${s.kurz} ${s.label}</button>`).join("")}
      </div>
    </div>`;
  } else selfEl.innerHTML = "";

  const manage = canManage();
  const rows = team.kader.slice().sort((a, b) => a.name.localeCompare(b.name)).map((s) => {
    const st = termin.teilnahme[s.id] ? termin.teilnahme[s.id].status : "offen";
    const isSelf = s.id === myId;
    const label = TEILNAHME_STATUS.find((x) => x.id === st);
    let right;
    if (manage) {
      right = `<div class="mini-rsvp">${TEILNAHME_STATUS.map((x) => `<button data-set-spieler="${escapeHtml(s.id)}" data-status="${x.id}" class="${x.id === st ? "active" : ""}" title="${x.label}">${x.kurz}</button>`).join("")}</div>`;
    } else {
      right = `<span class="status-pill ${st}">${label ? label.kurz + " " + label.label : "offen"}</span>`;
    }
    return `<div class="teilnahme-row${isSelf ? " is-self" : ""}">
      <span class="tr-name">${escapeHtml(s.name || "—")}${isSelf ? '<span class="self-tag">DU</span>' : ""}</span>
      ${right}
    </div>`;
  }).join("");
  document.getElementById("detail-teilnahme").innerHTML = rows || `<p class="muted">Noch keine Spieler im Kader.</p>`;

  document.getElementById("btn-edit-termin-detail").classList.toggle("hidden", !manage);
  document.getElementById("btn-delete-termin-detail").classList.toggle("hidden", !manage);
}

// ---------- Termin-Formular ----------
function openTerminModal(id) {
  if (!canManage()) return;
  const team = currentTeam();
  if (!team) return;
  const t = id ? team.termine.find((x) => x.id === id) : null;
  editingTerminId = t ? t.id : null;
  document.getElementById("termin-modal-title").textContent = t ? "Termin bearbeiten" : "Neuer Termin";
  document.getElementById("ef-typ").innerHTML = TERMIN_TYPEN.map((x) => `<option value="${x.id}">${x.icon} ${escapeHtml(x.label)}</option>`).join("");
  document.getElementById("ef-typ").value = t ? t.typ : "training";
  document.getElementById("ef-titel").value = t ? t.titel : "";
  document.getElementById("ef-datum").value = t ? t.datum : todayISO();
  document.getElementById("ef-startzeit").value = t ? t.startZeit : "";
  document.getElementById("ef-endzeit").value = t ? t.endZeit : "";
  document.getElementById("ef-ort").value = t ? t.ort : "";
  document.getElementById("ef-gegner").value = t ? t.gegner : "";
  document.getElementById("ef-treffpunkt").value = t ? t.treffpunkt : "";
  document.getElementById("ef-notiz").value = t ? t.notiz : "";
  document.getElementById("btn-delete-termin").classList.toggle("hidden", !t);
  updateGegnerVisibility();
  document.getElementById("termin-modal").classList.remove("hidden");
  document.getElementById("ef-datum").focus();
}
function updateGegnerVisibility() {
  document.getElementById("ef-gegner-field").style.display = val("ef-typ") === "spiel" ? "" : "none";
}
function closeTerminModal() { document.getElementById("termin-modal").classList.add("hidden"); editingTerminId = null; }
function saveTermin() {
  const team = currentTeam();
  if (!team) return;
  const datum = val("ef-datum");
  if (!datum) { alert("Bitte ein Datum angeben."); return; }
  let t = editingTerminId ? team.termine.find((x) => x.id === editingTerminId) : null;
  if (!t) { t = { id: uuid(), teilnahme: {} }; team.termine.push(t); }
  t.typ = val("ef-typ");
  t.titel = val("ef-titel").trim();
  t.datum = datum;
  t.startZeit = val("ef-startzeit");
  t.endZeit = val("ef-endzeit");
  t.ort = val("ef-ort").trim();
  t.gegner = t.typ === "spiel" ? val("ef-gegner").trim() : "";
  t.treffpunkt = val("ef-treffpunkt").trim();
  t.notiz = val("ef-notiz").trim();
  persist();
  renderTermine();
  closeTerminModal();
}
function deleteTermin(id) {
  const team = currentTeam();
  if (!team || !id) return;
  if (!confirm("Diesen Termin mit allen Rückmeldungen wirklich löschen?")) return;
  team.termine = team.termine.filter((x) => x.id !== id);
  persist();
  renderTermine();
  closeTerminModal();
  closeDetail();
}

// ---------- Kader ----------
function renderKader() {
  const team = teamOr("no-team-kader", ["kader-claim-hint", "kader-list", "kader-empty"]);
  const listEl = document.getElementById("kader-list");
  const emptyEl = document.getElementById("kader-empty");
  const hintEl = document.getElementById("kader-claim-hint");
  const titleEl = document.getElementById("kader-title");
  if (!team) { listEl.innerHTML = ""; emptyEl.classList.add("hidden"); return; }
  titleEl.textContent = `Kader — ${team.name} (${team.kader.length})`;
  const myId = myPlayerId(team);
  const hintText = document.getElementById("kader-claim-text");
  if (myId) {
    const me = findSpieler(team, myId);
    hintText.textContent = `Du bist in dieser Mannschaft als „${me ? me.name : ""}“ verknüpft und kannst dich selbst zu Terminen an- und abmelden.`;
  } else {
    hintText.textContent = "Bist du in dieser Mannschaft im Kader? Klicke bei deinem Namen auf „Das bin ich“, um dich selbst an- und abmelden zu können.";
  }
  hintEl.classList.remove("hidden");
  const manage = canManage();
  emptyEl.classList.toggle("hidden", team.kader.length > 0);
  const sorted = team.kader.slice().sort((a, b) => a.name.localeCompare(b.name));
  listEl.innerHTML = sorted.map((s) => {
    const isSelf = s.id === myId;
    let badge;
    if (isSelf) badge = `<span class="link-badge self">Das bist du</span><button class="btn small secondary" data-unclaim="${escapeHtml(s.id)}">Verknüpfung lösen</button>`;
    else if (s.linkedUsername) badge = `<span class="link-badge linked">🔗 ${escapeHtml(s.linkedUsername)}</span>`;
    else badge = `<span class="link-badge free">nicht verknüpft</span>${myId ? "" : `<button class="btn small" data-claim="${escapeHtml(s.id)}">Das bin ich</button>`}`;
    const editBtn = manage ? `<button class="icon-btn edit" data-edit-spieler="${escapeHtml(s.id)}" title="Bearbeiten">✎</button>` : "";
    const initial = s.nummer || (s.name ? s.name.trim().charAt(0).toUpperCase() : "?");
    return `<div class="kader-row">
      <div class="kader-left">
        <span class="kader-nummer">${escapeHtml(initial)}</span>
        <div>
          <div class="kader-name">${escapeHtml(s.name || "—")}</div>
          ${s.position ? `<div class="kader-pos">${escapeHtml(s.position)}</div>` : ""}
        </div>
      </div>
      <div class="kader-right">${badge}${editBtn}</div>
    </div>`;
  }).join("");
}
function claimSpieler(id) {
  const team = currentTeam();
  const u = myUsername();
  if (!team || !u) return;
  const target = findSpieler(team, id);
  if (!target) return;
  if (target.linkedUsername) { alert("Dieser Spieler ist bereits mit einem Konto verknüpft."); return; }
  // pro Team nur einen eigenen Spieler: bestehende eigene Verknüpfung lösen
  team.kader.forEach((s) => { if (s.linkedUsername && s.linkedUsername.toLowerCase() === u.toLowerCase()) s.linkedUsername = ""; });
  target.linkedUsername = u;
  persist();
  renderKader();
  renderTermine();
}
function unclaimSpieler(id) {
  const team = currentTeam();
  if (!team) return;
  const target = findSpieler(team, id);
  if (!target) return;
  target.linkedUsername = "";
  persist();
  renderKader();
  renderTermine();
}
function openSpielerModal(id) {
  if (!canManage()) return;
  const team = currentTeam();
  if (!team) return;
  const s = id ? findSpieler(team, id) : null;
  editingSpielerId = s ? s.id : null;
  document.getElementById("spieler-modal-title").textContent = s ? "Spieler bearbeiten" : "Neuer Spieler";
  document.getElementById("pf-name").value = s ? s.name : "";
  document.getElementById("pf-position").value = s ? s.position : "";
  document.getElementById("pf-nummer").value = s ? s.nummer : "";
  document.getElementById("pf-linked").value = s ? s.linkedUsername : "";
  document.getElementById("btn-delete-spieler").classList.toggle("hidden", !s);
  document.getElementById("spieler-modal").classList.remove("hidden");
  document.getElementById("pf-name").focus();
}
function closeSpielerModal() { document.getElementById("spieler-modal").classList.add("hidden"); editingSpielerId = null; }
function saveSpieler() {
  const team = currentTeam();
  if (!team) return;
  const name = val("pf-name").trim();
  if (!name) { alert("Bitte einen Namen eingeben."); return; }
  let s = editingSpielerId ? findSpieler(team, editingSpielerId) : null;
  if (!s) { s = { id: uuid() }; team.kader.push(s); }
  s.name = name;
  s.position = val("pf-position").trim();
  s.nummer = val("pf-nummer").trim();
  s.linkedUsername = val("pf-linked").trim();
  persist();
  renderKader();
  renderTermine();
  closeSpielerModal();
}
function deleteSpieler() {
  const team = currentTeam();
  if (!team || !editingSpielerId) return;
  if (!confirm("Diesen Spieler wirklich aus dem Kader entfernen? Seine Rückmeldungen und Buchungen werden ebenfalls entfernt.")) return;
  const id = editingSpielerId;
  team.kader = team.kader.filter((s) => s.id !== id);
  team.termine.forEach((t) => { delete t.teilnahme[id]; });
  team.umfragen.forEach((u) => { delete u.stimmen[id]; });
  team.kasse.buchungen.forEach((b) => { if (b.spielerId === id) b.spielerId = null; });
  persist();
  renderKader();
  renderTermine();
  closeSpielerModal();
}

// ---------- Statistik ----------
function fillStatistikJahr() {
  const team = currentTeam();
  const el = document.getElementById("statistik-jahr");
  const jahre = new Set();
  if (team) team.termine.forEach((t) => { if (t.datum && t.datum < todayISO()) jahre.add(t.datum.slice(0, 4)); });
  const opts = ["alle"].concat(Array.from(jahre).sort().reverse());
  if (!opts.includes(statistikJahr)) statistikJahr = "alle";
  el.innerHTML = opts.map((j) => `<option value="${j}">${j === "alle" ? "Alle Jahre" : j}</option>`).join("");
  el.value = statistikJahr;
}
function renderStatistik() {
  const team = teamOr("no-team-statistik", ["statistik-wrap", "statistik-empty"]);
  fillStatistikJahr();
  const wrap = document.getElementById("statistik-wrap");
  const emptyEl = document.getElementById("statistik-empty");
  const countEl = document.getElementById("statistik-count");
  if (!team) { wrap.innerHTML = ""; emptyEl.classList.add("hidden"); countEl.textContent = ""; return; }
  const today = todayISO();
  const past = team.termine.filter((t) => t.datum && t.datum < today && (statistikJahr === "alle" || t.datum.slice(0, 4) === statistikJahr));
  emptyEl.classList.toggle("hidden", past.length > 0);
  if (!past.length) { wrap.innerHTML = ""; countEl.textContent = ""; return; }
  const nTraining = past.filter((t) => t.typ === "training").length;
  const nSpiel = past.filter((t) => t.typ === "spiel").length;
  countEl.textContent = `${past.length} Termine · ${nTraining} Training · ${nSpiel} Spiel`;

  function statFor(spielerId, typ) {
    const rel = past.filter((t) => t.typ === typ);
    let zu = 0, gemeldet = 0;
    rel.forEach((t) => {
      const e = t.teilnahme[spielerId];
      if (!e) return;
      gemeldet++;
      if (e.status === "zu") zu++;
    });
    return { zu, gemeldet, gesamt: rel.length };
  }
  function quote(s) { return s.gemeldet ? Math.round((s.zu / s.gemeldet) * 100) + " %" : "—"; }
  const rows = team.kader.slice().sort((a, b) => a.name.localeCompare(b.name)).map((s) => {
    const tr = statFor(s.id, "training");
    const sp = statFor(s.id, "spiel");
    return `<tr>
      <td class="strong">${escapeHtml(s.name || "—")}</td>
      <td class="num">${tr.zu} / ${tr.gemeldet}</td>
      <td class="num">${quote(tr)}</td>
      <td class="num">${sp.zu} / ${sp.gemeldet}</td>
      <td class="num">${quote(sp)}</td>
    </tr>`;
  }).join("");
  wrap.innerHTML = `<table class="data-table">
    <thead><tr><th>Spieler</th><th class="num">🏃 Zusagen</th><th class="num">🏃 Quote</th><th class="num">⚽ Zusagen</th><th class="num">⚽ Quote</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">Noch keine Spieler im Kader.</td></tr>`}</tbody>
  </table>`;
}

// ---------- Umfragen ----------
function renderUmfragen() {
  const team = teamOr("no-team-umfragen", ["umfragen-list", "umfragen-empty"]);
  const listEl = document.getElementById("umfragen-list");
  const emptyEl = document.getElementById("umfragen-empty");
  if (!team) { listEl.innerHTML = ""; emptyEl.classList.add("hidden"); return; }
  const manage = canManage();
  const myId = myPlayerId(team);
  const umfragen = team.umfragen.slice().sort((a, b) => (b.erstelltAm || "").localeCompare(a.erstelltAm || ""));
  emptyEl.classList.toggle("hidden", umfragen.length > 0);
  listEl.innerHTML = umfragen.map((u) => {
    const counts = {};
    u.optionen.forEach((o) => { counts[o.id] = 0; });
    let voters = 0;
    Object.keys(u.stimmen).forEach((sid) => { if (u.stimmen[sid].length) voters++; u.stimmen[sid].forEach((oid) => { if (counts[oid] != null) counts[oid]++; }); });
    const maxCount = Math.max(1, ...Object.values(counts));
    const myVotes = myId && u.stimmen[myId] ? u.stimmen[myId] : [];
    const canVote = u.offen && myId;
    const options = u.optionen.map((o) => {
      const cnt = counts[o.id];
      const pct = Math.round((cnt / maxCount) * 100);
      const chosen = myVotes.includes(o.id);
      return `<div class="poll-option${canVote ? " votable" : ""}${chosen ? " chosen" : ""}" ${canVote ? `data-vote-umfrage="${escapeHtml(u.id)}" data-option="${escapeHtml(o.id)}"` : ""}>
        <div class="poll-bar-track">
          <div class="poll-bar-fill" style="width:${pct}%"></div>
          <div class="poll-bar-label"><span>${chosen ? "✓ " : ""}${escapeHtml(o.text)}</span><span class="poll-bar-count">${cnt}</span></div>
        </div>
      </div>`;
    }).join("");
    const adminBtns = manage ? `<div class="btn-row" style="justify-content:flex-start;margin-top:12px;">
      <button class="btn small secondary" data-toggle-umfrage="${escapeHtml(u.id)}">${u.offen ? "Abstimmung schließen" : "Wieder öffnen"}</button>
      <button class="btn small secondary" data-edit-umfrage="${escapeHtml(u.id)}">Bearbeiten</button>
    </div>` : "";
    let hint;
    if (!u.offen) hint = "Diese Umfrage ist geschlossen.";
    else if (!myId) hint = "Verknüpfe dich im Kader-Tab mit deinem Spieler, um abzustimmen.";
    else hint = u.mehrfach ? "Mehrfachauswahl — tippe die Optionen an." : "Tippe eine Option an, um abzustimmen.";
    return `<div class="umfrage-card">
      <div class="umfrage-frage">${escapeHtml(u.frage)}${u.offen ? "" : '<span class="umfrage-closed-tag">geschlossen</span>'}</div>
      <div class="umfrage-meta">${voters} von ${team.kader.length} Kaderspielern haben abgestimmt${u.mehrfach ? " · Mehrfachauswahl" : ""}</div>
      ${options}
      <div class="umfrage-open-hint">${escapeHtml(hint)}</div>
      ${adminBtns}
    </div>`;
  }).join("");
}
function vote(umfrageId, optionId) {
  const team = currentTeam();
  if (!team) return;
  const u = team.umfragen.find((x) => x.id === umfrageId);
  if (!u || !u.offen) return;
  const myId = myPlayerId(team);
  if (!myId) return;
  const cur = Array.isArray(u.stimmen[myId]) ? u.stimmen[myId].slice() : [];
  if (u.mehrfach) {
    const i = cur.indexOf(optionId);
    if (i >= 0) cur.splice(i, 1); else cur.push(optionId);
  } else {
    if (cur.length === 1 && cur[0] === optionId) cur.length = 0; // abwählen
    else { cur.length = 0; cur.push(optionId); }
  }
  if (cur.length) u.stimmen[myId] = cur; else delete u.stimmen[myId];
  persist();
  renderUmfragen();
}
function openUmfrageModal(id) {
  if (!canManage()) return;
  const team = currentTeam();
  if (!team) return;
  const u = id ? team.umfragen.find((x) => x.id === id) : null;
  editingUmfrageId = u ? u.id : null;
  document.getElementById("umfrage-modal-title").textContent = u ? "Umfrage bearbeiten" : "Neue Umfrage";
  document.getElementById("uf-frage").value = u ? u.frage : "";
  document.getElementById("uf-mehrfach").checked = u ? u.mehrfach : false;
  const wrap = document.getElementById("uf-optionen");
  wrap.innerHTML = "";
  const opts = u && u.optionen.length ? u.optionen.map((o) => o.text) : ["", ""];
  opts.forEach((txt) => addOptionRow(txt));
  document.getElementById("btn-delete-umfrage").classList.toggle("hidden", !u);
  document.getElementById("umfrage-modal").classList.remove("hidden");
  document.getElementById("uf-frage").focus();
}
function addOptionRow(text) {
  const wrap = document.getElementById("uf-optionen");
  const row = document.createElement("div");
  row.className = "uf-option-row";
  row.innerHTML = `<input type="text" class="uf-opt-input" placeholder="Antwortoption" /><button type="button" class="icon-btn uf-opt-remove" title="Entfernen">×</button>`;
  row.querySelector("input").value = text || "";
  wrap.appendChild(row);
}
function closeUmfrageModal() { document.getElementById("umfrage-modal").classList.add("hidden"); editingUmfrageId = null; }
function saveUmfrage() {
  const team = currentTeam();
  if (!team) return;
  const frage = val("uf-frage").trim();
  if (!frage) { alert("Bitte eine Frage eingeben."); return; }
  const texts = Array.from(document.querySelectorAll("#uf-optionen .uf-opt-input")).map((el) => el.value.trim()).filter(Boolean);
  if (texts.length < 2) { alert("Bitte mindestens zwei Antwortoptionen angeben."); return; }
  let u = editingUmfrageId ? team.umfragen.find((x) => x.id === editingUmfrageId) : null;
  if (!u) { u = { id: uuid(), stimmen: {}, erstelltAm: new Date().toISOString(), offen: true }; team.umfragen.push(u); }
  u.frage = frage;
  u.mehrfach = checked("uf-mehrfach");
  // bestehende Optionen nach Text wiederverwenden (erhält Stimmen), neue anhängen
  const alt = u.optionen ? u.optionen.slice() : [];
  const neu = texts.map((txt) => {
    const match = alt.find((o) => o.text === txt);
    return match ? { id: match.id, text: txt } : { id: uuid(), text: txt };
  });
  const neuIds = neu.map((o) => o.id);
  u.optionen = neu;
  Object.keys(u.stimmen).forEach((sid) => {
    u.stimmen[sid] = u.stimmen[sid].filter((oid) => neuIds.includes(oid));
    if (!u.stimmen[sid].length) delete u.stimmen[sid];
  });
  persist();
  renderUmfragen();
  closeUmfrageModal();
}
function deleteUmfrage() {
  const team = currentTeam();
  if (!team || !editingUmfrageId) return;
  if (!confirm("Diese Umfrage wirklich löschen?")) return;
  team.umfragen = team.umfragen.filter((x) => x.id !== editingUmfrageId);
  persist();
  renderUmfragen();
  closeUmfrageModal();
}
function toggleUmfrageOffen(id) {
  if (!canManage()) return;
  const team = currentTeam();
  const u = team && team.umfragen.find((x) => x.id === id);
  if (!u) return;
  u.offen = !u.offen;
  persist();
  renderUmfragen();
}

// ---------- Kasse ----------
function renderKasse() {
  const team = teamOr("no-team-kasse", ["kasse-summary", "buchungen-wrap", "buchungen-empty", "strafenkatalog-list", "kasse-salden-wrap"]);
  if (!team) {
    document.getElementById("kasse-summary").innerHTML = "";
    document.getElementById("buchungen-wrap").innerHTML = "";
    document.getElementById("strafenkatalog-list").innerHTML = "";
    document.getElementById("kasse-salden-wrap").innerHTML = "";
    return;
  }
  const manage = canManage();
  const buchungen = team.kasse.buchungen;
  let bezahltEin = 0, bezahltAus = 0, offenEin = 0;
  buchungen.forEach((b) => {
    if (b.richtung === "ein") { if (b.bezahlt) bezahltEin += b.betrag; else offenEin += b.betrag; }
    else if (b.bezahlt) bezahltAus += b.betrag;
  });
  const stand = bezahltEin - bezahltAus;
  document.getElementById("kasse-summary").innerHTML = `
    <div class="summary-card strong"><div class="sc-label">Kassenstand</div><div class="sc-value">${escapeHtml(fmtEuro(stand))}</div><div class="sc-sub">bezahlte Ein- minus Ausgaben</div></div>
    <div class="summary-card warn"><div class="sc-label">Offene Beträge</div><div class="sc-value">${escapeHtml(fmtEuro(offenEin))}</div><div class="sc-sub">noch nicht bezahlt</div></div>
    <div class="summary-card"><div class="sc-label">Buchungen</div><div class="sc-value">${buchungen.length}</div></div>`;

  // Buchungen-Tabelle
  const buEmpty = document.getElementById("buchungen-empty");
  buEmpty.classList.toggle("hidden", buchungen.length > 0);
  const spielerName = (id) => { const s = id ? findSpieler(team, id) : null; return s ? s.name : "Mannschaft"; };
  const sorted = buchungen.slice().sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  const buRows = sorted.map((b) => {
    const vorz = b.richtung === "ein" ? "+" : "−";
    const farbe = b.richtung === "ein" ? "var(--green)" : "var(--red)";
    const bezahltCell = manage
      ? `<button class="btn small ${b.bezahlt ? "success" : "secondary"}" data-toggle-bezahlt="${escapeHtml(b.id)}">${b.bezahlt ? "bezahlt" : "offen"}</button>`
      : (b.bezahlt ? "bezahlt" : "offen");
    const editCell = manage ? `<td><button class="icon-btn edit" data-edit-buchung="${escapeHtml(b.id)}" title="Bearbeiten">✎</button></td>` : "";
    return `<tr>
      <td>${escapeHtml(fmtDatum(b.datum))}</td>
      <td>${escapeHtml(spielerName(b.spielerId))}</td>
      <td>${escapeHtml(b.bezeichnung)}</td>
      <td class="num" style="color:${farbe};font-weight:700;">${vorz}${escapeHtml(fmtEuro(b.betrag))}</td>
      <td>${bezahltCell}</td>
      ${editCell}
    </tr>`;
  }).join("");
  document.getElementById("buchungen-wrap").innerHTML = buchungen.length
    ? `<table class="data-table"><thead><tr><th>Datum</th><th>Spieler</th><th>Bezeichnung</th><th class="num">Betrag</th><th>Status</th>${manage ? "<th></th>" : ""}</tr></thead><tbody>${buRows}</tbody></table>`
    : "";

  // Strafenkatalog
  document.getElementById("strafenkatalog-list").innerHTML = team.kasse.strafenkatalog.map((s, i) => `
    <div class="param-row">
      <input class="pg-label" data-strafe-idx="${i}" value="${escapeHtml(s.bezeichnung)}" placeholder="Bezeichnung" ${manage ? "" : "disabled"} />
      <input class="pg-betrag" type="number" min="0" step="0.01" data-strafe-betrag-idx="${i}" value="${escapeHtml(String(s.betrag))}" ${manage ? "" : "disabled"} />
      ${manage ? `<button class="icon-btn" data-remove-strafe="${i}" title="Entfernen">×</button>` : ""}
    </div>`).join("") || `<p class="muted">Noch keine Einträge im Strafenkatalog.</p>`;

  // Offene Salden je Spieler
  const salden = {};
  buchungen.forEach((b) => { if (b.richtung === "ein" && !b.bezahlt && b.spielerId) salden[b.spielerId] = (salden[b.spielerId] || 0) + b.betrag; });
  const saldenRows = Object.keys(salden).map((sid) => ({ name: spielerName(sid), betrag: salden[sid] }))
    .sort((a, b) => b.betrag - a.betrag)
    .map((r) => `<tr><td class="strong">${escapeHtml(r.name)}</td><td class="num" style="color:var(--red);font-weight:700;">${escapeHtml(fmtEuro(r.betrag))}</td></tr>`).join("");
  document.getElementById("kasse-salden-wrap").innerHTML = saldenRows
    ? `<table class="data-table"><thead><tr><th>Spieler</th><th class="num">Offen</th></tr></thead><tbody>${saldenRows}</tbody></table>`
    : `<p class="muted">Aktuell keine offenen Beträge.</p>`;
}
function openBuchungModal(id) {
  if (!canManage()) return;
  const team = currentTeam();
  if (!team) return;
  const b = id ? team.kasse.buchungen.find((x) => x.id === id) : null;
  editingBuchungId = b ? b.id : null;
  document.getElementById("buchung-modal-title").textContent = b ? "Buchung bearbeiten" : "Neue Buchung";
  document.getElementById("bf-vorlage").innerHTML = `<option value="">— frei —</option>` +
    team.kasse.strafenkatalog.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.bezeichnung)} (${escapeHtml(fmtEuro(s.betrag))})</option>`).join("");
  document.getElementById("bf-vorlage").value = "";
  document.getElementById("bf-spieler").innerHTML = `<option value="">— Mannschaft allgemein —</option>` +
    team.kader.slice().sort((a, b2) => a.name.localeCompare(b2.name)).map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("");
  document.getElementById("bf-spieler").value = b && b.spielerId ? b.spielerId : "";
  document.getElementById("bf-richtung").value = b ? b.richtung : "ein";
  document.getElementById("bf-betrag").value = b ? String(b.betrag) : "";
  document.getElementById("bf-datum").value = b && b.datum ? b.datum : todayISO();
  document.getElementById("bf-bezeichnung").value = b ? b.bezeichnung : "";
  document.getElementById("bf-bezahlt").checked = b ? b.bezahlt : false;
  document.getElementById("btn-delete-buchung").classList.toggle("hidden", !b);
  document.getElementById("buchung-modal").classList.remove("hidden");
}
function applyVorlage() {
  const team = currentTeam();
  if (!team) return;
  const s = team.kasse.strafenkatalog.find((x) => x.id === val("bf-vorlage"));
  if (!s) return;
  document.getElementById("bf-bezeichnung").value = s.bezeichnung;
  document.getElementById("bf-betrag").value = String(s.betrag);
  document.getElementById("bf-richtung").value = "ein";
}
function closeBuchungModal() { document.getElementById("buchung-modal").classList.add("hidden"); editingBuchungId = null; }
function saveBuchung() {
  const team = currentTeam();
  if (!team) return;
  const betrag = parseBetrag(val("bf-betrag"));
  const bezeichnung = val("bf-bezeichnung").trim();
  if (isNaN(betrag) || betrag < 0) { alert("Bitte einen gültigen Betrag angeben."); return; }
  if (!bezeichnung) { alert("Bitte eine Bezeichnung angeben."); return; }
  let b = editingBuchungId ? team.kasse.buchungen.find((x) => x.id === editingBuchungId) : null;
  if (!b) { b = { id: uuid() }; team.kasse.buchungen.push(b); }
  b.spielerId = val("bf-spieler") || null;
  b.richtung = val("bf-richtung") === "aus" ? "aus" : "ein";
  b.betrag = Math.abs(betrag);
  b.datum = val("bf-datum");
  b.bezeichnung = bezeichnung;
  b.bezahlt = checked("bf-bezahlt");
  persist();
  renderKasse();
  closeBuchungModal();
}
function deleteBuchung() {
  const team = currentTeam();
  if (!team || !editingBuchungId) return;
  if (!confirm("Diese Buchung wirklich löschen?")) return;
  team.kasse.buchungen = team.kasse.buchungen.filter((x) => x.id !== editingBuchungId);
  persist();
  renderKasse();
  closeBuchungModal();
}
function toggleBezahlt(id) {
  if (!canManage()) return;
  const team = currentTeam();
  const b = team && team.kasse.buchungen.find((x) => x.id === id);
  if (!b) return;
  b.bezahlt = !b.bezahlt;
  persist();
  renderKasse();
}

// ---------- Einstellungen: Mannschaften ----------
function renderTeamAdmin() {
  const manage = canManage();
  const list = document.getElementById("team-admin-list");
  const empty = document.getElementById("team-admin-empty");
  list.innerHTML = appData.teams.map((t) => `
    <div class="team-admin-row">
      <div class="team-admin-left"><span class="team-dot" style="background:${/^#[0-9a-fA-F]{6}$/.test(t.farbe) ? t.farbe : "#1a56a0"}"></span>
        <div><div class="kader-name">${escapeHtml(t.name)}</div><div class="kader-pos">${t.kader.length} Spieler · ${t.termine.length} Termine</div></div>
      </div>
      ${manage ? `<button class="icon-btn edit" data-edit-team="${escapeHtml(t.id)}" title="Bearbeiten">✎</button>` : ""}
    </div>`).join("");
  empty.classList.toggle("hidden", appData.teams.length > 0 || !manage);
}
function openTeamModal(id) {
  if (!canManage()) return;
  const t = id ? appData.teams.find((x) => x.id === id) : null;
  editingTeamId = t ? t.id : null;
  document.getElementById("team-modal-title").textContent = t ? "Mannschaft bearbeiten" : "Neue Mannschaft";
  document.getElementById("tf-name").value = t ? t.name : "";
  document.getElementById("tf-farbe").value = /^#[0-9a-fA-F]{6}$/.test(t && t.farbe) ? t.farbe : "#1a56a0";
  document.getElementById("btn-delete-team").classList.toggle("hidden", !t);
  document.getElementById("team-modal").classList.remove("hidden");
  document.getElementById("tf-name").focus();
}
function closeTeamModal() { document.getElementById("team-modal").classList.add("hidden"); editingTeamId = null; }
function saveTeam() {
  const name = val("tf-name").trim();
  if (!name) { alert("Bitte einen Namen eingeben."); return; }
  let t = editingTeamId ? appData.teams.find((x) => x.id === editingTeamId) : null;
  if (!t) { t = seedTeam(name, val("tf-farbe")); appData.teams.push(t); if (!currentTeamId) { currentTeamId = t.id; appData.meta.currentTeamId = t.id; } }
  t.name = name;
  t.farbe = val("tf-farbe");
  persist();
  renderAll();
  closeTeamModal();
}
function deleteTeam() {
  if (!editingTeamId) return;
  if (!confirm("Diese Mannschaft mit Kader, Terminen, Umfragen und Kasse wirklich löschen?")) return;
  appData.teams = appData.teams.filter((x) => x.id !== editingTeamId);
  if (currentTeamId === editingTeamId) { currentTeamId = appData.teams[0] ? appData.teams[0].id : null; appData.meta.currentTeamId = currentTeamId; }
  persist();
  renderAll();
  closeTeamModal();
}

// ---------- Meta / Changelog / Nutzer ----------
function renderMeta() {
  const m = appData.meta || {};
  const rows = [
    ["Mannschaften", String(appData.teams.length)],
    ["Letzter Stand", m.stand ? new Date(m.stand).toLocaleString("de-DE") : "—"]
  ];
  document.getElementById("meta-view").innerHTML = rows.map(([k, v]) =>
    `<div class="form-field"><label>${escapeHtml(k)}</label><span>${escapeHtml(v)}</span></div>`).join("");
}
function renderVersionInfo() {
  document.querySelectorAll("#version-badge, #version-badge-2, #version-badge-nav").forEach((el) => { if (el) el.textContent = "v" + APP_VERSION; });
  const list = document.getElementById("changelog-list");
  if (!list) return;
  list.innerHTML = APP_CHANGELOG.map((entry) => `
    <div class="changelog-entry">
      <div class="cv">Version ${escapeHtml(entry.version)}</div>
      ${entry.groups.map((g) => `
        <div class="changelog-group">
          <div class="cg-title">${escapeHtml(g.title)}</div>
          <ul class="cg-items">${g.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
}
function renderHeaderUser() {
  const el = document.getElementById("header-user");
  const el2 = document.getElementById("einstellungen-user");
  if (!currentUser) { if (el) el.textContent = ""; if (el2) el2.textContent = ""; return; }
  const name = (currentUser.vorname || currentUser.nachname)
    ? `${currentUser.vorname || ""} ${currentUser.nachname || ""}`.trim()
    : currentUser.username;
  const rolle = currentUser.isAdmin ? " (Admin)" : (canManage() ? " (Bearbeiter)" : "");
  if (el) el.textContent = "👤 " + name + rolle;
  if (el2) el2.textContent = "Angemeldet als " + name + rolle +
    (canManage() ? "" : " — Verwalten (Termine/Kader/Kasse anlegen) ist Trainern und Betreuern vorbehalten. Für deinen eigenen Kaderplatz kannst du dich selbst an- und abmelden.");
}
function applyEditVisibility() {
  const editable = canManage();
  document.body.classList.toggle("can-edit", editable);
  document.querySelectorAll(".editor-only").forEach((el) => el.classList.toggle("hidden", !editable));
}

function renderAll() {
  renderTeamSelect();
  renderTermine();
  renderKader();
  renderStatistik();
  renderUmfragen();
  renderKasse();
  renderTeamAdmin();
  renderMeta();
  renderVersionInfo();
  applyEditVisibility();
}

// ---------- Tabs ----------
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-section").forEach((s) => s.classList.toggle("active", s.id === "tab-" + tab));
  if (tab === "termine") renderTermine();
  if (tab === "kader") renderKader();
  if (tab === "statistik") renderStatistik();
  if (tab === "umfragen") renderUmfragen();
  if (tab === "kasse") renderKasse();
  if (tab === "einstellungen") { renderTeamAdmin(); renderMeta(); renderVersionInfo(); }
}

// ---------- Gateway: Laden / Speichern / Konflikte ----------
function setSaveStatus(text, kind) {
  const el = document.getElementById("save-status");
  if (!el) return;
  el.textContent = text;
  el.className = "header-status" + (kind ? " is-" + kind : "");
}
function persist() {
  clearTimeout(persistTimer);
  setSaveStatus("Änderung noch nicht gespeichert…", "pending");
  persistTimer = setTimeout(doPersist, 300);
}
async function saveNow() { clearTimeout(persistTimer); return doPersist(); }
async function doPersist() {
  setSaveStatus("Speichern…", "pending");
  try {
    appData.meta = Object.assign({}, appData.meta, { stand: new Date().toISOString(), currentTeamId });
    await gatewaySave(appData);
    const t = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    setSaveStatus("Gespeichert " + t, "ok");
    return true;
  } catch (e) {
    if (e instanceof ConflictError) { await reloadAfterConflict(); setSaveStatus("Von anderem Gerät aktualisiert", ""); return false; }
    if (e instanceof NotLoggedInError) { showConnectScreen("Sitzung abgelaufen — bitte neu anmelden."); return false; }
    console.error("Speichern fehlgeschlagen", e);
    setSaveStatus("Nicht gespeichert", "error");
    alert("Speichern fehlgeschlagen: " + e.message);
    return false;
  }
}
async function reloadAfterConflict() {
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    currentTeamId = appData.meta.currentTeamId;
    renderAll();
    if (detailTerminId) renderDetail();
    alert("Die Daten wurden zwischenzeitlich auf einem anderen Gerät geändert — die aktuelle Version wurde neu geladen. Bitte die letzte Änderung bei Bedarf erneut vornehmen.");
  } catch (e) {
    console.error("Neuladen nach Konflikt fehlgeschlagen", e);
  }
}

// ---------- Start ----------
function showConnectScreen(errorMsg) {
  document.getElementById("connect-screen").style.display = "";
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("cloud-error").textContent = errorMsg ? "Fehler: " + errorMsg : "";
}
async function startApp() {
  document.getElementById("connect-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "";
  currentTeamId = appData.meta.currentTeamId;
  renderAll();
  try { currentUser = await fetchMe(); } catch (_) { /* best effort */ }
  renderHeaderUser();
  renderAll();
}
async function init() {
  setupListeners();
  if (!getSessionToken()) { showConnectScreen(); return; }
  try {
    const data = await gatewayLoad();
    appData = normalizeData(data);
    await startApp();
  } catch (e) {
    if (e instanceof NotLoggedInError) { showConnectScreen(); return; }
    console.error("Nextcloud-Zugriff über Login fehlgeschlagen", e);
    showConnectScreen(e.message);
  }
}

function setupListeners() {
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.getElementById("team-select").addEventListener("change", (e) => selectTeam(e.target.value));

  // Termine
  document.getElementById("termine-filter").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (btn) { termineFilter = btn.dataset.filter; renderTermine(); }
  });
  document.getElementById("btn-new-termin").addEventListener("click", () => openTerminModal(null));
  document.getElementById("termine-list").addEventListener("click", (e) => {
    const rsvp = e.target.closest("[data-rsvp-termin]");
    if (rsvp) { setMyStatus(rsvp.dataset.rsvpTermin, rsvp.dataset.status); return; }
    const open = e.target.closest("[data-open-termin]");
    if (open) openDetail(open.dataset.openTermin);
  });

  // Termin-Modal
  document.getElementById("ef-typ").addEventListener("change", updateGegnerVisibility);
  document.getElementById("termin-modal-close").addEventListener("click", closeTerminModal);
  document.getElementById("btn-cancel-termin").addEventListener("click", closeTerminModal);
  document.getElementById("btn-save-termin").addEventListener("click", saveTermin);
  document.getElementById("btn-delete-termin").addEventListener("click", () => deleteTermin(editingTerminId));
  document.getElementById("termin-modal").addEventListener("click", (e) => { if (e.target.id === "termin-modal") closeTerminModal(); });
  document.getElementById("termin-form").addEventListener("submit", (e) => { e.preventDefault(); saveTermin(); });

  // Termin-Detail
  document.getElementById("detail-modal-close").addEventListener("click", closeDetail);
  document.getElementById("btn-close-detail").addEventListener("click", closeDetail);
  document.getElementById("detail-modal").addEventListener("click", (e) => { if (e.target.id === "detail-modal") closeDetail(); });
  document.getElementById("detail-self").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-detail-self]");
    if (btn && detailTerminId) setMyStatus(detailTerminId, btn.dataset.status);
  });
  document.getElementById("detail-teilnahme").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-set-spieler]");
    if (btn && detailTerminId) setStatusFor(detailTerminId, btn.dataset.setSpieler, btn.dataset.status);
  });
  document.getElementById("btn-edit-termin-detail").addEventListener("click", () => { if (detailTerminId) { const id = detailTerminId; closeDetail(); openTerminModal(id); } });
  document.getElementById("btn-delete-termin-detail").addEventListener("click", () => { if (detailTerminId) deleteTermin(detailTerminId); });

  // Kader
  document.getElementById("btn-new-spieler").addEventListener("click", () => openSpielerModal(null));
  document.getElementById("kader-list").addEventListener("click", (e) => {
    const claim = e.target.closest("[data-claim]"); if (claim) { claimSpieler(claim.dataset.claim); return; }
    const unclaim = e.target.closest("[data-unclaim]"); if (unclaim) { unclaimSpieler(unclaim.dataset.unclaim); return; }
    const edit = e.target.closest("[data-edit-spieler]"); if (edit) openSpielerModal(edit.dataset.editSpieler);
  });
  document.getElementById("spieler-modal-close").addEventListener("click", closeSpielerModal);
  document.getElementById("btn-cancel-spieler").addEventListener("click", closeSpielerModal);
  document.getElementById("btn-save-spieler").addEventListener("click", saveSpieler);
  document.getElementById("btn-delete-spieler").addEventListener("click", deleteSpieler);
  document.getElementById("spieler-modal").addEventListener("click", (e) => { if (e.target.id === "spieler-modal") closeSpielerModal(); });
  document.getElementById("spieler-form").addEventListener("submit", (e) => { e.preventDefault(); saveSpieler(); });

  // Statistik
  document.getElementById("statistik-jahr").addEventListener("change", (e) => { statistikJahr = e.target.value; renderStatistik(); });

  // Umfragen
  document.getElementById("btn-new-umfrage").addEventListener("click", () => openUmfrageModal(null));
  document.getElementById("umfragen-list").addEventListener("click", (e) => {
    const opt = e.target.closest("[data-vote-umfrage]"); if (opt) { vote(opt.dataset.voteUmfrage, opt.dataset.option); return; }
    const tog = e.target.closest("[data-toggle-umfrage]"); if (tog) { toggleUmfrageOffen(tog.dataset.toggleUmfrage); return; }
    const ed = e.target.closest("[data-edit-umfrage]"); if (ed) openUmfrageModal(ed.dataset.editUmfrage);
  });
  document.getElementById("umfrage-modal-close").addEventListener("click", closeUmfrageModal);
  document.getElementById("btn-cancel-umfrage").addEventListener("click", closeUmfrageModal);
  document.getElementById("btn-save-umfrage").addEventListener("click", saveUmfrage);
  document.getElementById("btn-delete-umfrage").addEventListener("click", deleteUmfrage);
  document.getElementById("btn-add-option").addEventListener("click", () => addOptionRow(""));
  document.getElementById("uf-optionen").addEventListener("click", (e) => {
    const rm = e.target.closest(".uf-opt-remove");
    if (rm) rm.closest(".uf-option-row").remove();
  });
  document.getElementById("umfrage-modal").addEventListener("click", (e) => { if (e.target.id === "umfrage-modal") closeUmfrageModal(); });

  // Kasse
  document.getElementById("btn-new-buchung").addEventListener("click", () => openBuchungModal(null));
  document.getElementById("btn-add-strafe").addEventListener("click", () => {
    currentTeam().kasse.strafenkatalog.push({ id: uuid(), bezeichnung: "Neue Strafe", betrag: 0 });
    persist(); renderKasse();
  });
  document.getElementById("buchungen-wrap").addEventListener("click", (e) => {
    const tog = e.target.closest("[data-toggle-bezahlt]"); if (tog) { toggleBezahlt(tog.dataset.toggleBezahlt); return; }
    const ed = e.target.closest("[data-edit-buchung]"); if (ed) openBuchungModal(ed.dataset.editBuchung);
  });
  const sk = document.getElementById("strafenkatalog-list");
  sk.addEventListener("input", (e) => {
    const team = currentTeam(); if (!team) return;
    const li = e.target.dataset.strafeIdx;
    if (li != null) { team.kasse.strafenkatalog[Number(li)].bezeichnung = e.target.value; persist(); return; }
    const bi = e.target.dataset.strafeBetragIdx;
    if (bi != null) { const n = parseBetrag(e.target.value); team.kasse.strafenkatalog[Number(bi)].betrag = isNaN(n) ? 0 : n; persist(); }
  });
  sk.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove-strafe]");
    if (!rm) return;
    if (!confirm("Diesen Eintrag aus dem Strafenkatalog entfernen?")) return;
    currentTeam().kasse.strafenkatalog.splice(Number(rm.dataset.removeStrafe), 1);
    persist(); renderKasse();
  });
  document.getElementById("bf-vorlage").addEventListener("change", applyVorlage);
  document.getElementById("buchung-modal-close").addEventListener("click", closeBuchungModal);
  document.getElementById("btn-cancel-buchung").addEventListener("click", closeBuchungModal);
  document.getElementById("btn-save-buchung").addEventListener("click", saveBuchung);
  document.getElementById("btn-delete-buchung").addEventListener("click", deleteBuchung);
  document.getElementById("buchung-modal").addEventListener("click", (e) => { if (e.target.id === "buchung-modal") closeBuchungModal(); });
  document.getElementById("buchung-form").addEventListener("submit", (e) => { e.preventDefault(); saveBuchung(); });

  // Einstellungen: Mannschaften
  document.getElementById("btn-new-team").addEventListener("click", () => openTeamModal(null));
  document.getElementById("team-admin-list").addEventListener("click", (e) => {
    const ed = e.target.closest("[data-edit-team]"); if (ed) openTeamModal(ed.dataset.editTeam);
  });
  document.getElementById("team-modal-close").addEventListener("click", closeTeamModal);
  document.getElementById("btn-cancel-team").addEventListener("click", closeTeamModal);
  document.getElementById("btn-save-team").addEventListener("click", saveTeam);
  document.getElementById("btn-delete-team").addEventListener("click", deleteTeam);
  document.getElementById("team-modal").addEventListener("click", (e) => { if (e.target.id === "team-modal") closeTeamModal(); });
  document.getElementById("team-form").addEventListener("submit", (e) => { e.preventDefault(); saveTeam(); });

  // ESC schließt das oberste offene Modal
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const modals = ["buchung-modal", "umfrage-modal", "detail-modal", "termin-modal", "spieler-modal", "team-modal"];
    for (const m of modals) {
      const el = document.getElementById(m);
      if (el && !el.classList.contains("hidden")) {
        if (m === "detail-modal") closeDetail();
        else el.classList.add("hidden");
        return;
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
