import { maakStore, isGedeeld } from "./store.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const PRESETS = { kolf: [30, 60, 90, 120], kunst: [30, 60, 90, 120], kolfL: [20, 40, 60, 80], kolfR: [20, 40, 60, 80] };
const DAGEN_ZICHTBAAR_START = 7;
const DAG = 864e5;

// ---------- opslag van voorkeuren ----------
const ls = {
  get(k, def = null) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? def : JSON.parse(v);
    } catch {
      return def;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};

// ---------- hulpfuncties ----------
const pad = (n) => String(n).padStart(2, "0");
const uurMin = (t) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dagStart = (t) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
// Tijdzone- en zomertijdveilig een aantal dagen verschuiven.
const plusDagen = (dag, n) => {
  const d = new Date(dag);
  d.setDate(d.getDate() + n);
  return d.getTime();
};
const naarDatetimeLocal = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${uurMin(t)}`;
};
const mmss = (sec) => {
  sec = Math.floor(sec);
  const u = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return u ? `${u}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
const getal = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const kantNaam = (k) => (k === "L" ? "links" : "rechts");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const isKolven = (v) => v.type === "kolven";

function dagLabel(t) {
  const vandaag = dagStart(Date.now());
  const d = dagStart(t);
  if (d === vandaag) return "Vandaag";
  if (d === plusDagen(vandaag, -1)) return "Gisteren";
  return new Date(t).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function geledenTekst(t) {
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 1) return "Zojuist";
  const u = Math.floor(min / 60);
  const m = min % 60;
  if (!u) return `${m} min geleden`;
  return `${u} u ${pad(m)} min geleden`;
}

function onderdelen(v) {
  if (isKolven(v)) {
    const L = getal(v.kolfL);
    const R = getal(v.kolfR);
    const duur = getal(v.duur);
    return [{
      soort: "kolven",
      tekst: [`Gekolfd ${L + R} ml`, (L || R) && `L ${L} · R ${R}`, duur && `${duur} min`].filter(Boolean).join(" · "),
    }];
  }
  const delen = [];
  const L = getal(v.borstL);
  const R = getal(v.borstR);
  const eind = v.eindKant ? `laatst ${v.eindKant}` : "";
  if (L || R || eind) {
    const tekst = [L && `L ${L}m`, R && `R ${R}m`, eind].filter(Boolean).join(" · ");
    delen.push({ soort: "borst", tekst: L || R ? tekst : `Borst, ${eind}` });
  }
  if (getal(v.kolf)) delen.push({ soort: "fles", tekst: `${v.kolf} ml moedermelk` });
  if (getal(v.kunst)) delen.push({ soort: "kunst", tekst: `${v.kunst} ml kunstvoeding` });
  return delen;
}

function totalen(lijst) {
  const t = { L: 0, R: 0, fles: 0, kunst: 0, kolfL: 0, kolfR: 0, kolfDuur: 0, voedingen: 0, kolfsessies: 0 };
  for (const v of lijst) {
    if (isKolven(v)) {
      t.kolfL += getal(v.kolfL);
      t.kolfR += getal(v.kolfR);
      t.kolfDuur += getal(v.duur);
      t.kolfsessies++;
    } else {
      t.L += getal(v.borstL);
      t.R += getal(v.borstR);
      t.fles += getal(v.kolf);
      t.kunst += getal(v.kunst);
      t.voedingen++;
    }
  }
  t.borst = t.L + t.R;
  t.kolf = t.kolfL + t.kolfR;
  return t;
}

// ---------- toast ----------
let toastTimer;
function toast(tekst, actieTekst, actie) {
  const el = $("#toast");
  $("#toast-tekst").textContent = tekst;
  const knop = $("#toast-actie");
  knop.hidden = !actie;
  knop.textContent = actieTekst || "";
  knop.onclick = () => {
    el.hidden = true;
    actie?.();
  };
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), actie ? 6000 : 3000);
}

// ---------- status ----------
let store;
let voedingen = [];
let dagenZichtbaar = DAGEN_ZICHTBAAR_START;
let naam = ls.get("naam", "");
let gezin = ls.get("gezin", "");
let periode = ls.get("periode", 14);

// ---------- tabbladen en modus ----------
function toonTab(tab) {
  for (const b of $$(".tabbar button")) b.classList.toggle("aan", b.dataset.tab === tab);
  $("#tab-registreren").hidden = tab !== "registreren";
  $("#tab-overzicht").hidden = tab !== "overzicht";
  if (tab === "overzicht") renderOverzicht();
  window.scrollTo(0, 0);
}
for (const b of $$(".tabbar button")) b.addEventListener("click", () => toonTab(b.dataset.tab));

let modus = "voeding";
function toonModus(m) {
  modus = m;
  for (const b of $$(".modus button")) {
    b.classList.toggle("aan", b.dataset.modus === m);
    b.setAttribute("aria-selected", b.dataset.modus === m);
  }
  $("#invoer").hidden = m !== "voeding";
  $("#kolfinvoer").hidden = m !== "kolven";
  werkTimersBij();
}
for (const b of $$(".modus button")) b.addEventListener("click", () => toonModus(b.dataset.modus));

// ---------- timers (gedeeld tussen de telefoons) ----------
// Alles is gebaseerd op tijdstempels, dus de timer loopt door als het scherm vergrendelt
// of de app sluit, en het blijft dezelfde sessie.
const leegTimer = () => ({
  L: { acc: 0, start: null },
  R: { acc: 0, start: null },
  begin: null,
  laatst: null,
  K: { acc: 0, start: null },
  kBegin: null,
  door: "",
  bijgewerkt: 0,
});
let timer = { ...leegTimer(), ...(ls.get("timers", null) || ls.get("borsttimer", null) || {}) };
const seconden = (k) => timer[k].acc + (timer[k].start ? Math.max(0, Date.now() - timer[k].start) / 1000 : 0);
const minutenVan = (k) => {
  const s = seconden(k);
  return s > 0 ? Math.min(240, Math.max(1, Math.round(s / 60))) : 0;
};
const loopt = (k) => Boolean(timer[k].start);
const borstLoopt = () => loopt("L") || loopt("R");

function bewaarTimer() {
  timer.door = naam || "";
  timer.bijgewerkt = Date.now();
  ls.set("timers", timer);
  store?.zetTimer?.(timer);
}

function pauzeer(k) {
  if (!timer[k].start) return;
  timer[k].acc = seconden(k);
  timer[k].start = null;
}

function wisselBorst(k) {
  if (loopt(k)) {
    pauzeer(k);
  } else {
    pauzeer(k === "L" ? "R" : "L");
    timer[k].start = Date.now();
    timer.laatst = k;
    if (!timer.begin) timer.begin = Date.now();
  }
  bewaarTimer();
  zetTijden();
  werkTimersBij();
}

function wisselKolf() {
  if (loopt("K")) {
    pauzeer("K");
  } else {
    timer.K.start = Date.now();
    if (!timer.kBegin) timer.kBegin = Date.now();
  }
  bewaarTimer();
  zetTijden();
  werkTimersBij();
}

function timerKnop(knop, k) {
  const actief = loopt(k);
  const s = seconden(k);
  knop.classList.toggle("actief", actief);
  $(".timer-icoon", knop).textContent = actief ? "❚❚" : "▶";
  $(".timer-tijd", knop).textContent = s > 0 ? mmss(s) : "Start";
}

function werkTimersBij() {
  for (const kant of $$(".kant")) {
    const k = kant.dataset.kant;
    kant.classList.toggle("actief", loopt(k));
    timerKnop($(".timer", kant), k);
    const inp = $(".minuten input", kant);
    if (document.activeElement !== inp) inp.value = seconden(k) > 0 ? minutenVan(k) : "";
  }
  for (const knop of $$(".laatstekant .segment button")) {
    const aan = knop.dataset.eind === timer.laatst;
    knop.classList.toggle("aan", aan);
    knop.setAttribute("aria-pressed", aan);
  }
  timerKnop($("#kolftimer"), "K");
  $(".kolfduur").classList.toggle("actief", loopt("K"));
  const duurInp = $("#kolfduur");
  if (document.activeElement !== duurInp) duurInp.value = seconden("K") > 0 ? minutenVan("K") : "";

  // Melding als er een timer loopt in de modus die je nu niet ziet.
  const banner = $("#loopt");
  const andere = modus === "voeding" ? loopt("K") && "kolven" : borstLoopt() && "voeding";
  banner.hidden = !andere;
  if (andere) {
    const k = andere === "kolven" ? "K" : loopt("L") ? "L" : "R";
    const wat = andere === "kolven" ? "Kolven" : `Borstvoeding ${kantNaam(k)}`;
    banner.textContent = `${wat} loopt: ${mmss(seconden(k))}. Tik om te openen.`;
    banner.dataset.modus = andere;
  }
  werkKnoppenBij();
}
$("#loopt").addEventListener("click", (e) => toonModus(e.currentTarget.dataset.modus));

for (const kant of $$(".kant")) {
  const k = kant.dataset.kant;
  $(".timer", kant).addEventListener("click", () => wisselBorst(k));
  const inp = $(".minuten input", kant);
  inp.addEventListener("input", () => {
    // Handmatig typen overschrijft de timer van deze kant.
    timer[k].start = null;
    timer[k].acc = getal(inp.value) * 60;
    if (getal(inp.value) && !timer.laatst) timer.laatst = k;
    bewaarTimer();
    werkTimersBij();
  });
  inp.addEventListener("focus", () => inp.select());
}
for (const knop of $$(".laatstekant .segment button")) {
  knop.addEventListener("click", () => {
    timer.laatst = timer.laatst === knop.dataset.eind ? null : knop.dataset.eind;
    bewaarTimer();
    werkTimersBij();
  });
}
$("#kolftimer").addEventListener("click", wisselKolf);
$("#kolfduur").addEventListener("input", (e) => {
  timer.K.start = null;
  timer.K.acc = getal(e.target.value) * 60;
  bewaarTimer();
  werkTimersBij();
});
$("#kolfduur").addEventListener("focus", (e) => e.target.select());

// ---------- tijdvelden ----------
const formulieren = {
  voeding: { form: $("#invoer"), tijd: $("#tijd"), handmatig: false, begin: () => timer.begin },
  kolven: { form: $("#kolfinvoer"), tijd: $("#kolftijd"), handmatig: false, begin: () => timer.kBegin },
};

function zetTijden() {
  for (const f of Object.values(formulieren)) {
    if (!f.handmatig) f.tijd.value = uurMin(f.begin() || Date.now());
  }
}

function tijdUitInvoer(input) {
  const [u, m] = input.value.split(":").map(Number);
  const d = new Date();
  d.setHours(u, m, 0, 0);
  // Tijd in de toekomst (bijv. 23:50 ingevuld om 00:10): dan was het gisteren.
  if (d.getTime() > Date.now() + 5 * 60000) d.setDate(d.getDate() - 1);
  return d.getTime();
}

for (const [m, f] of Object.entries(formulieren)) {
  f.tijd.addEventListener("input", () => (f.handmatig = true));
  $(".knop-nu", f.form).addEventListener("click", () => {
    f.handmatig = true;
    f.tijd.value = uurMin(Date.now());
    if (m === "voeding") timer.begin = borstLoopt() || seconden("L") || seconden("R") ? Date.now() : null;
    else timer.kBegin = seconden("K") ? Date.now() : null;
    bewaarTimer();
  });
}

// ---------- hoeveelheden (stepper + snelkeuzes) ----------
for (const blok of $$(".soort[data-soort]")) {
  const input = $("input", blok);
  const chips = $(".chips", blok);
  for (const ml of PRESETS[blok.dataset.soort]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pil";
    b.textContent = ml;
    b.dataset.ml = ml;
    b.addEventListener("click", () => {
      input.value = getal(input.value) === ml ? 0 : ml;
      werkKnoppenBij();
    });
    chips.append(b);
  }
  for (const s of $$(".stap", blok)) {
    s.addEventListener("click", () => {
      input.value = Math.min(1000, Math.max(0, getal(input.value) + Number(s.dataset.stap)));
      werkKnoppenBij();
    });
  }
  input.addEventListener("input", werkKnoppenBij);
  input.addEventListener("focus", () => input.select());
}

const waardeVan = (id) => getal($("#" + id).value);

function werkKnoppenBij() {
  for (const blok of $$(".soort[data-soort]")) {
    const v = getal($("input", blok).value);
    for (const c of $$(".pil", blok)) c.classList.toggle("gekozen", Number(c.dataset.ml) === v);
  }
  $("#kolftotaal").textContent = `${waardeVan("kolfL") + waardeVan("kolfR")} ml`;
  $("#invoer .opslaan").disabled =
    !(waardeVan("kolf") || waardeVan("kunst") || seconden("L") > 0 || seconden("R") > 0 || timer.laatst);
  $("#kolfinvoer .opslaan").disabled = !(waardeVan("kolfL") || waardeVan("kolfR") || seconden("K") > 0);
}

// ---------- opslaan ----------
function tijdVoor(m) {
  const f = formulieren[m];
  if (!f.tijd.value) f.tijd.value = uurMin(Date.now());
  return tijdUitInvoer(f.tijd);
}

function naOpslaan(id, herstel) {
  navigator.vibrate?.(30);
  toast("Opgeslagen", "Ongedaan maken", () => {
    store.remove(id);
    herstel();
  });
}

$("#invoer").addEventListener("submit", (e) => {
  e.preventDefault();
  const voeding = {
    tijd: tijdVoor("voeding"),
    borstL: minutenVan("L"),
    borstR: minutenVan("R"),
    kolf: waardeVan("kolf"),
    kunst: waardeVan("kunst"),
    eindKant: timer.laatst || null,
    door: naam || "",
  };
  const vorig = { L: { ...timer.L }, R: { ...timer.R }, begin: timer.begin, laatst: timer.laatst, tijd: $("#tijd").value };
  const id = store.add(voeding);
  timer.L = { acc: 0, start: null };
  timer.R = { acc: 0, start: null };
  timer.begin = null;
  timer.laatst = null;
  bewaarTimer();
  $("#kolf").value = 0;
  $("#kunst").value = 0;
  formulieren.voeding.handmatig = false;
  zetTijden();
  werkTimersBij();
  naOpslaan(id, () => {
    Object.assign(timer, { L: vorig.L, R: vorig.R, begin: vorig.begin, laatst: vorig.laatst });
    bewaarTimer();
    $("#kolf").value = voeding.kolf;
    $("#kunst").value = voeding.kunst;
    $("#tijd").value = vorig.tijd;
    formulieren.voeding.handmatig = true;
    werkTimersBij();
  });
});

$("#kolfinvoer").addEventListener("submit", (e) => {
  e.preventDefault();
  const sessie = {
    type: "kolven",
    tijd: tijdVoor("kolven"),
    kolfL: waardeVan("kolfL"),
    kolfR: waardeVan("kolfR"),
    duur: minutenVan("K"),
    door: naam || "",
  };
  const vorig = { K: { ...timer.K }, kBegin: timer.kBegin, tijd: $("#kolftijd").value };
  const id = store.add(sessie);
  timer.K = { acc: 0, start: null };
  timer.kBegin = null;
  bewaarTimer();
  $("#kolfL").value = 0;
  $("#kolfR").value = 0;
  formulieren.kolven.handmatig = false;
  zetTijden();
  werkTimersBij();
  naOpslaan(id, () => {
    Object.assign(timer, { K: vorig.K, kBegin: vorig.kBegin });
    bewaarTimer();
    $("#kolfL").value = sessie.kolfL;
    $("#kolfR").value = sessie.kolfR;
    $("#kolftijd").value = vorig.tijd;
    formulieren.kolven.handmatig = true;
    werkTimersBij();
  });
});

// ---------- weergave: registreren ----------
function renderLaatste() {
  const alleenVoeding = voedingen.filter((v) => !isKolven(v));
  const laatste = alleenVoeding[0];
  if (!laatste) {
    $("#laatste-sinds").textContent = "Nog niets geregistreerd";
    $("#laatste-detail").textContent = "";
  } else {
    $("#laatste-sinds").textContent = geledenTekst(laatste.tijd);
    $("#laatste-detail").textContent =
      `${dagLabel(laatste.tijd) === "Vandaag" ? "om" : dagLabel(laatste.tijd).toLowerCase()} ${uurMin(laatste.tijd)} · ` +
      onderdelen(laatste).map((o) => o.tekst).join(", ");
  }
  const metKant = alleenVoeding.find((v) => v.eindKant);
  const pil = $("#laatste-kant");
  pil.hidden = !metKant;
  if (metKant) pil.innerHTML = `Laatst gebruikte borst: <b>${kantNaam(metKant.eindKant)}</b> <span>(${uurMin(metKant.tijd)})</span>`;
}

function totaalRijen(t) {
  const rij = (kleur, label, waarde, detail = "") =>
    `<div class="totrij"><span class="stip ${kleur}"></span><span class="totlabel">${label}</span><b>${waarde}</b><span class="totdetail">${detail}</span></div>`;
  return (
    rij("borst", "Borst", `${t.borst} min`, `L ${t.L} · R ${t.R}`) +
    rij("kunst", "Kunstvoeding", `${t.kunst} ml`) +
    rij("fles", "Moedermelk fles", `${t.fles} ml`) +
    rij("kolf", "Gekolfd", `${t.kolf} ml`, `L ${t.kolfL} · R ${t.kolfR}`) +
    `<p class="klein-grijs totvoet">${t.voedingen} voedingen · ${t.kolfsessies} keer gekolfd${t.kolfDuur ? ` (${t.kolfDuur} min)` : ""}</p>`
  );
}

function renderLijst() {
  const vandaag = dagStart(Date.now());
  $("#totalen-vandaag").innerHTML = totaalRijen(totalen(voedingen.filter((v) => dagStart(v.tijd) === vandaag)));

  const perDag = new Map();
  for (const v of voedingen) {
    const d = dagStart(v.tijd);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(v);
  }
  const dagen = [...perDag.entries()];
  const html = dagen.slice(0, dagenZichtbaar).map(([d, lijst]) => {
    const t = totalen(lijst);
    const samenvatting = [
      t.borst && `borst ${t.borst} min`,
      t.kunst && `kunst ${t.kunst} ml`,
      t.kolf && `gekolfd ${t.kolf} ml`,
    ].filter(Boolean).join(" · ");
    const rijen = lijst.map((v) => `
      <button class="item" data-id="${esc(v.id)}">
        <span class="item-tijd">${uurMin(v.tijd)}</span>
        <span class="item-delen">${onderdelen(v).map((o) => `<span class="badge ${o.soort}">${esc(o.tekst)}</span>`).join("")}</span>
        <span class="item-door">${esc((v.door || "").slice(0, 1).toUpperCase())}</span>
      </button>`).join("");
    return `<div class="dag"><div class="dagkop"><span>${dagLabel(d)}</span><span>${samenvatting}</span></div>${rijen}</div>`;
  }).join("");
  const meer = dagen.length > dagenZichtbaar ? `<button id="meer" class="secundair breed">Meer dagen tonen</button>` : "";
  $("#geschiedenis").innerHTML = html + meer || `<p class="leeg">Nog niets geregistreerd. Begin hierboven.</p>`;
}

$("#geschiedenis").addEventListener("click", (e) => {
  if (e.target.closest("#meer")) {
    dagenZichtbaar += 7;
    renderLijst();
    return;
  }
  const item = e.target.closest(".item");
  if (item) openBewerk(item.dataset.id);
});

// ---------- weergave: overzicht ----------
function dagreeks(n) {
  const vandaag = dagStart(Date.now());
  const perDag = new Map();
  for (const v of voedingen) {
    const d = dagStart(v.tijd);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(v);
  }
  const eerste = voedingen.length ? dagStart(Math.min(...voedingen.map((v) => v.tijd))) : vandaag;
  const reeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = plusDagen(vandaag, -i);
    reeks.push({ d, t: totalen(perDag.get(d) || []), actief: d >= eerste, vandaag: d === vandaag });
  }
  return reeks;
}

// Vergelijk de laatste volle dagen met de dagen ervoor (vandaag telt niet mee, die loopt nog).
function trend(sleutel) {
  const reeks = dagreeks(15).filter((x) => x.actief && !x.vandaag);
  const w = Math.min(7, Math.floor(reeks.length / 2));
  if (w < 2) return null;
  const gem = (arr) => arr.reduce((s, x) => s + x.t[sleutel], 0) / arr.length;
  const nu = gem(reeks.slice(-w));
  const toen = gem(reeks.slice(-2 * w, -w));
  return { w, nu, toen, pct: toen ? Math.round(((nu - toen) / toen) * 100) : nu ? 100 : 0 };
}

function trendTekst(sleutel, eenheid, goedAls) {
  const t = trend(sleutel);
  if (!t) return `<span class="trend">Nog te weinig dagen voor een trend</span>`;
  const richting = Math.abs(t.pct) < 5 ? "gelijk" : t.pct > 0 ? "op" : "af";
  const pijl = { op: "↑", af: "↓", gelijk: "→" }[richting];
  const woord = { op: "neemt toe", af: "neemt af", gelijk: "blijft gelijk" }[richting];
  const kleur = richting === "gelijk" ? "" : richting === goedAls ? "goed" : "let";
  const pct = richting === "gelijk" ? "" : ` (${t.pct > 0 ? "+" : ""}${t.pct}%)`;
  return `<span class="trend ${kleur}">${pijl} ${woord}${pct}</span>
    <span class="trenduitleg">gem. ${Math.round(t.nu)} ${eenheid}/dag laatste ${t.w} dagen, was ${Math.round(t.toen)}</span>`;
}

function renderGisteren() {
  const gist = plusDagen(dagStart(Date.now()), -1);
  const t = totalen(voedingen.filter((v) => dagStart(v.tijd) === gist));
  const datum = new Date(gist).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  $("#gisteren").innerHTML = `
    <h2>Gisteren <span class="klein-grijs">${datum}</span></h2>
    <div class="blik">
      <div class="blikvak kunst"><span>Kunstvoeding</span><b>${t.kunst} ml</b>${trendTekst("kunst", "ml", "af")}</div>
      <div class="blikvak kolf"><span>Gekolfd</span><b>${t.kolf} ml</b><small>L ${t.kolfL} · R ${t.kolfR} ml</small>${trendTekst("kolf", "ml", "op")}</div>
      <div class="blikvak borst"><span>Borstvoeding</span><b>${t.borst} min</b><small>L ${t.L} · R ${t.R} min</small>${trendTekst("borst", "min", "op")}</div>
    </div>`;
}

function staafgrafiek(el, { titel, eenheid, reeks, delen, kleuren, legenda }) {
  const W = 340, H = 170, pl = 30, pb = 20, pt = 16, pr = 4;
  const n = reeks.length;
  const waarden = reeks.map((x) => delen.reduce((s, k) => s + x.t[k], 0));
  const max = Math.max(10, ...waarden);
  const stap = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => max / s <= 4) || 1000;
  const top = Math.ceil(max / stap) * stap;
  const bw = (W - pl - pr) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  let svg = "";
  for (let v = 0; v <= top; v += stap) {
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="rast"/><text x="${pl - 4}" y="${y(v) + 3}" class="as" text-anchor="end">${v}</text>`;
  }
  const volle = reeks.filter((x) => x.actief && !x.vandaag);
  reeks.forEach((x, i) => {
    const cx = pl + bw * i + bw / 2;
    const breed = Math.max(3, bw * 0.68);
    let basis = 0;
    delen.forEach((k, j) => {
      const v = x.t[k];
      if (!v) return;
      svg += `<rect x="${cx - breed / 2}" width="${breed}" y="${y(basis + v)}" height="${y(basis) - y(basis + v)}" rx="2" fill="${kleuren[j]}" ${x.vandaag ? 'opacity=".45"' : ""}/>`;
      basis += v;
    });
    if (n <= 14 && waarden[i]) svg += `<text x="${cx}" y="${y(waarden[i]) - 3}" class="waardelabel" text-anchor="middle">${waarden[i]}</text>`;
    const dt = new Date(x.d);
    const toon = n <= 7 || n <= 14 || i % 5 === (n - 1) % 5;
    if (toon) {
      const lab = n <= 7 ? dt.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2) : dt.getDate();
      svg += `<text x="${cx}" y="${H - 6}" class="as${x.vandaag ? " nu" : ""}" text-anchor="middle">${lab}</text>`;
    }
  });
  let gemTekst = "";
  if (volle.length) {
    const gem = volle.reduce((s, x) => s + delen.reduce((a, k) => a + x.t[k], 0), 0) / volle.length;
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(gem)}" y2="${y(gem)}" class="gemlijn"/>`;
    gemTekst = `gem. ${Math.round(gem)} ${eenheid}/dag`;
  }
  const leg = legenda.map((l, j) => `<span><i style="background:${kleuren[j]}"></i>${l}</span>`).join("");
  el.innerHTML = `<div class="grafiekkop"><h2>${titel}</h2><span class="klein-grijs">${gemTekst}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titel} per dag">${svg}</svg>
    <div class="legenda">${leg}<span><i class="streep"></i>gemiddelde</span></div>`;
}

function renderOverzicht() {
  if ($("#tab-overzicht").hidden) return;
  renderGisteren();
  for (const b of $$(".periode button")) b.classList.toggle("aan", Number(b.dataset.dagen) === periode);
  const reeks = dagreeks(periode);
  const css = getComputedStyle(document.documentElement);
  const kleur = (v) => css.getPropertyValue(v).trim();
  staafgrafiek($("#g-borst"), { titel: "Borstvoeding", eenheid: "min", reeks, delen: ["L", "R"], kleuren: [kleur("--borst"), kleur("--borst-licht")], legenda: ["links", "rechts"] });
  staafgrafiek($("#g-kunst"), { titel: "Kunstvoeding", eenheid: "ml", reeks, delen: ["kunst"], kleuren: [kleur("--kunst")], legenda: ["kunstvoeding"] });
  staafgrafiek($("#g-kolf"), { titel: "Kolfopbrengst", eenheid: "ml", reeks, delen: ["kolfL", "kolfR"], kleuren: [kleur("--kolf"), kleur("--kolf-licht")], legenda: ["links", "rechts"] });

  const rijen = [...reeks].reverse().filter((x) => x.actief);
  const som = (k) => rijen.reduce((s, x) => s + x.t[k], 0);
  const volle = rijen.filter((x) => !x.vandaag);
  const gem = (k) => (volle.length ? Math.round(volle.reduce((s, x) => s + x.t[k], 0) / volle.length) : 0);
  // Moedermelk uit de fles alleen tonen als die in deze periode gegeven is.
  const metFles = som("fles") > 0;
  const kol = ["L", "R", "borst", "kunst", ...(metFles ? ["fles"] : []), "kolfL", "kolfR", "kolf"];
  const cel = (x) => kol.map((k) => `<td class="${k === "borst" || k === "kolf" ? "sub" : ""}">${x[k] || "·"}</td>`).join("");
  const dagNaam = (x) => (x.vandaag ? "Vandaag" : new Date(x.d).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" }));
  $("#dagtabel").innerHTML = `
    <thead>
      <tr><th></th><th colspan="3" class="gk borst">Borst (min)</th><th colspan="${metFles ? 2 : 1}" class="gk kunst">Fles (ml)</th><th colspan="3" class="gk kolf">Gekolfd (ml)</th></tr>
      <tr><th>Dag</th><th>L</th><th>R</th><th>tot</th><th>kunst</th>${metFles ? "<th>mm</th>" : ""}<th>L</th><th>R</th><th>tot</th></tr>
    </thead>
    <tbody>${rijen.map((x) => `<tr${x.vandaag ? ' class="nu"' : ""}><th>${dagNaam(x)}</th>${cel(x.t)}</tr>`).join("") || `<tr><td colspan="9" class="leeg">Nog geen gegevens</td></tr>`}</tbody>
    <tfoot>
      <tr><th>Totaal</th>${cel(Object.fromEntries(kol.map((k) => [k, som(k)])))}</tr>
      <tr><th>Gem./dag</th>${cel(Object.fromEntries(kol.map((k) => [k, gem(k)])))}</tr>
    </tfoot>`;
  $("#tabeluitleg").textContent = metFles ? "mm = moedermelk uit de fles. Gemiddelde over volle dagen, vandaag telt niet mee." : "Gemiddelde over volle dagen, vandaag telt niet mee.";
}

for (const b of $$(".periode button")) {
  b.addEventListener("click", () => {
    periode = Number(b.dataset.dagen);
    ls.set("periode", periode);
    renderOverzicht();
  });
}

function renderAlles() {
  renderLaatste();
  renderLijst();
  renderOverzicht();
}

// ---------- bewerken ----------
const dlgBewerk = $("#dlg-bewerk");
let bewerkId = null;

function openBewerk(id) {
  const v = voedingen.find((x) => x.id === id);
  if (!v) return;
  bewerkId = id;
  const kolven = isKolven(v);
  $("#b-titel").textContent = kolven ? "Kolven aanpassen" : "Voeding aanpassen";
  $(".b-voeding", dlgBewerk).hidden = kolven;
  $(".b-kolven", dlgBewerk).hidden = !kolven;
  $("#b-tijd").value = naarDatetimeLocal(v.tijd);
  $("#b-links").value = getal(v.borstL) || "";
  $("#b-rechts").value = getal(v.borstR) || "";
  $("#b-kolf").value = getal(v.kolf) || "";
  $("#b-kunst").value = getal(v.kunst) || "";
  $("#b-eind").value = v.eindKant || "";
  $("#b-duur").value = getal(v.duur) || "";
  $("#b-kolfL").value = getal(v.kolfL) || "";
  $("#b-kolfR").value = getal(v.kolfR) || "";
  $("#b-door").textContent = v.door ? `Geregistreerd door ${v.door}` : "";
  dlgBewerk.showModal();
}

dlgBewerk.addEventListener("close", () => {
  const oud = voedingen.find((x) => x.id === bewerkId);
  if (dlgBewerk.returnValue === "opslaan" && oud) {
    const tijd = new Date($("#b-tijd").value).getTime();
    const basis = { tijd: Number.isFinite(tijd) ? tijd : oud.tijd };
    store.update(bewerkId, isKolven(oud)
      ? { ...basis, duur: getal($("#b-duur").value), kolfL: getal($("#b-kolfL").value), kolfR: getal($("#b-kolfR").value) }
      : {
          ...basis,
          borstL: getal($("#b-links").value),
          borstR: getal($("#b-rechts").value),
          kolf: getal($("#b-kolf").value),
          kunst: getal($("#b-kunst").value),
          eindKant: $("#b-eind").value || null,
        });
    toast("Aangepast");
  }
  dlgBewerk.returnValue = "";
  bewerkId = null;
});

$("#b-verwijder").addEventListener("click", () => {
  const id = bewerkId;
  const v = voedingen.find((x) => x.id === id);
  if (!v || !confirm("Deze registratie verwijderen?")) return;
  bewerkId = null;
  dlgBewerk.close();
  store.remove(id);
  const { id: _, ...kopie } = v;
  toast("Verwijderd", "Ongedaan maken", () => store.add(kopie));
});

// ---------- instellingen ----------
const dlgInst = $("#dlg-instellingen");
const koppelLink = () => `${location.origin}${location.pathname}?gezin=${encodeURIComponent(gezin)}`;

$("#knop-instellingen").addEventListener("click", () => {
  $("#i-naam").value = naam;
  $("#i-gedeeld").hidden = !isGedeeld();
  $("#i-code").textContent = gezin;
  $("#i-status").textContent = isGedeeld()
    ? "Gegevens en lopende timers worden gedeeld via Firebase en werken ook offline."
    : "Lokale modus: gegevens staan alleen op dit toestel.";
  dlgInst.showModal();
});

dlgInst.addEventListener("close", () => {
  const n = $("#i-naam").value.trim();
  if (n) {
    naam = n;
    ls.set("naam", naam);
  }
});

$("#i-deel").addEventListener("click", async () => {
  const url = koppelLink();
  try {
    if (navigator.share) {
      await navigator.share({ title: "Babyvoeding", text: "Open deze link om onze voedingen te delen:", url });
      return;
    }
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Link gekopieerd");
  } catch {
    prompt("Kopieer deze link:", url);
  }
});

$("#i-wissel").addEventListener("click", () => {
  const code = normaliseerCode(prompt("Gezinscode van de andere telefoon:") || "");
  if (!code) return;
  if (!geldigeCode(code)) return alert("Deze code klopt niet. Een code is 16 tot 40 letters en cijfers.");
  ls.set("gezin", code);
  location.reload();
});

// ---------- gezinscode ----------
const normaliseerCode = (c) => {
  c = c.trim();
  const m = c.match(/[?&]gezin=([a-z0-9]+)/i);
  return (m ? m[1] : c).toLowerCase().replace(/[^a-z0-9]/g, "");
};
const geldigeCode = (c) => /^[a-z0-9]{16,40}$/.test(c);
function nieuweCode() {
  const tekens = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map((b) => tekens[b % tekens.length]).join("");
}

function codeUitUrl() {
  const p = new URLSearchParams(location.search);
  const code = normaliseerCode(p.get("gezin") || "");
  if (p.has("gezin")) history.replaceState(null, "", location.pathname);
  return geldigeCode(code) ? code : "";
}

async function eersteKeer() {
  const dlg = $("#dlg-start");
  $("#s-gezin").hidden = !isGedeeld() || Boolean(gezin);
  $("#s-naam").value = naam;
  dlg.addEventListener("cancel", (e) => e.preventDefault());
  dlg.showModal();
  await new Promise((klaar) => {
    $("#form-start").addEventListener("submit", (e) => {
      const code = normaliseerCode($("#s-code").value);
      if (code && !geldigeCode(code)) {
        e.preventDefault();
        alert("Deze gezinscode klopt niet. Laat het veld leeg voor een nieuwe.");
        return;
      }
      naam = $("#s-naam").value.trim();
      ls.set("naam", naam);
      if (!gezin) gezin = code || nieuweCode();
      ls.set("gezin", gezin);
      klaar();
    });
  });
}

// ---------- synchronisatiestatus ----------
function zetSync(meta) {
  const el = $("#sync");
  if (!store.gedeeld) {
    el.className = "sync lokaal";
    el.title = "Alleen lokaal";
    return;
  }
  const wacht = meta?.wachtend || (!navigator.onLine && meta?.uitCache);
  el.className = "sync " + (wacht ? "wacht" : "ok");
  el.title = wacht ? "Wacht op verbinding, wordt later gedeeld" : "Gesynchroniseerd";
}

// ---------- opstarten ----------
async function start() {
  const urlCode = codeUitUrl();
  if (urlCode) {
    gezin = urlCode;
    ls.set("gezin", gezin);
  }
  if (!isGedeeld()) {
    gezin = gezin || "lokaal";
    $("#melding-lokaal").hidden = false;
  }
  if (!naam || !gezin) await eersteKeer();
  if (urlCode && naam) toast("Gekoppeld aan jullie gezin");

  if (loopt("K") && !borstLoopt()) toonModus("kolven");
  zetTijden();
  werkTimersBij();

  try {
    store = await maakStore(gezin);
  } catch (e) {
    console.error(e);
    toast("Kon de database niet laden. Controleer de verbinding.");
    return;
  }
  let laatsteMeta;
  store.subscribe(
    (lijst, meta) => {
      voedingen = lijst;
      laatsteMeta = meta;
      zetSync(meta);
      renderAlles();
    },
    (fout) => {
      console.error(fout);
      toast("Synchronisatie mislukt: " + (fout.code || fout.message));
    },
  );
  store.volgTimer?.((extern) => {
    // Negeer oudere versies (bijv. de late bevestiging van een eigen eerdere wijziging).
    if (!extern || (extern.bijgewerkt || 0) < (timer.bijgewerkt || 0)) return;
    timer = { ...leegTimer(), ...extern };
    ls.set("timers", timer);
    zetTijden();
    werkTimersBij();
  });
  window.addEventListener("online", () => zetSync(laatsteMeta));
  window.addEventListener("offline", () => zetSync(laatsteMeta));
  window.addEventListener("opslagfout", (e) => toast("Opslaan mislukt: " + (e.detail?.code || "onbekende fout")));

  setInterval(() => {
    if (borstLoopt() || loopt("K")) werkTimersBij();
  }, 1000);
  setInterval(() => {
    renderLaatste();
    zetTijden();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    zetTijden();
    werkTimersBij();
    renderAlles();
  });
}

start();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
