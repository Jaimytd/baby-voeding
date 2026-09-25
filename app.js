import { maakStore, isGedeeld } from "./store.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const PRESETS = { kolf: [30, 60, 90, 120], kunst: [30, 60, 90, 120], kolfL: [20, 40, 60], kolfR: [20, 40, 60] };
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
    const perKantDuur = "duurL" in v || "duurR" in v;
    const kant = perKantDuur
      ? `L ${L}${getal(v.duurL) ? ` (${getal(v.duurL)}m)` : ""} · R ${R}${getal(v.duurR) ? ` (${getal(v.duurR)}m)` : ""}`
      : (L || R) && `L ${L} · R ${R}`;
    return [{
      soort: "kolven",
      tekst: [`Gekolfd ${L + R} ml`, kant, !perKantDuur && duur && `${duur} min`].filter(Boolean).join(" · "),
    }];
  }
  // Hoeveelheden (ml) eerst, daarna de borstminuten.
  const delen = [];
  if (getal(v.kunst)) delen.push({ soort: "kunst", tekst: `${v.kunst} ml kunstvoeding` });
  if (getal(v.kolf)) delen.push({ soort: "fles", tekst: `${v.kolf} ml moedermelk` });
  const L = getal(v.borstL);
  const R = getal(v.borstR);
  const eind = v.eindKant ? `laatst ${v.eindKant}` : "";
  if (L || R || eind) {
    const tekst = [L && `L ${L}m`, R && `R ${R}m`, eind].filter(Boolean).join(" · ");
    delen.push({ soort: "borst", tekst: L || R ? tekst : `Borst, ${eind}` });
  }
  return delen;
}

// Eén registratie als duidelijke regel(s): wat was het (Fles, Borst, Gekolfd) en hoeveel.
function regels(v) {
  if (isKolven(v)) {
    const L = getal(v.kolfL);
    const R = getal(v.kolfR);
    const perKantDuur = "duurL" in v || "duurR" in v;
    const kant = perKantDuur
      ? `L ${L}${getal(v.duurL) ? ` (${getal(v.duurL)}m)` : ""} · R ${R}${getal(v.duurR) ? ` (${getal(v.duurR)}m)` : ""}`
      : `L ${L} · R ${R}`;
    return [{ soort: "kolven", label: "Gekolfd", hoofd: `${L + R} ml`, detail: [kant, !perKantDuur && getal(v.duur) && `${getal(v.duur)} min`].filter(Boolean).join(" · ") }];
  }
  const uit = [];
  const kunst = getal(v.kunst);
  const mm = getal(v.kolf);
  if (kunst || mm) {
    uit.push({
      soort: "fles",
      label: "Fles",
      hoofd: `${kunst + mm} ml`,
      detail: [kunst && `${kunst} kunstvoeding`, mm && `${mm} moedermelk`].filter(Boolean).join(" + "),
    });
  }
  const L = getal(v.borstL);
  const R = getal(v.borstR);
  if (L || R || v.eindKant) {
    uit.push({
      soort: "borst",
      label: "Borst",
      hoofd: `${L + R} min`,
      detail: [L && `L ${L}m`, R && `R ${R}m`, v.eindKant && `laatst ${v.eindKant}`].filter(Boolean).join(" · "),
    });
  }
  return uit;
}

function totalen(lijst) {
  const t = { L: 0, R: 0, fles: 0, kunst: 0, kolfL: 0, kolfR: 0, kolfDuur: 0, voedingen: 0, kolfsessies: 0, borstKeer: 0, samen: 0, aantal: lijst.length };
  for (const v of lijst) {
    if (isKolven(v)) {
      t.kolfL += getal(v.kolfL);
      t.kolfR += getal(v.kolfR);
      t.kolfDuur += getal(v.duur);
      t.kolfsessies++;
    } else {
      t.L += getal(v.borstL);
      t.R += getal(v.borstR);
      if (getal(v.borstL) || getal(v.borstR)) t.borstKeer++;
      t.fles += getal(v.kolf);
      t.kunst += getal(v.kunst);
      t.voedingen++;
    }
  }
  t.borst = t.L + t.R;
  t.kolf = t.kolfL + t.kolfR;
  t.samen = t.kunst + t.kolf;
  return t;
}

// ---------- registraties opslaan (ook als de database nog laadt) ----------
const nieuwId = () => {
  const tekens = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return [...crypto.getRandomValues(new Uint8Array(20))].map((b) => tekens[b % tekens.length]).join("");
};
const wachtrij = [];
// Een sessie uit een timer krijgt een vaste id (b_<begin> of k_<begin>): slaan beide
// telefoons dezelfde sessie op, bijvoorbeeld de ene offline, dan blijft het één registratie.
function registreer(v, vasteId) {
  if (!Number.isInteger(v.tijd)) v.tijd = Math.round(Number(v.tijd)) || Date.now();
  const id = vasteId || nieuwId();
  if (store) store.add(v, id);
  else wachtrij.push({ id, v });
  return id;
}
function verwijder(id) {
  const i = wachtrij.findIndex((x) => x.id === id);
  if (i >= 0) wachtrij.splice(i, 1);
  else store?.remove(id);
}

// ---------- scherm aan houden ----------
// Zolang er een timer loopt, blijft het scherm aan (Screen Wake Lock). Het besturingssysteem
// geeft de vergrendeling vrij als de app naar de achtergrond gaat; bij terugkomen vragen we opnieuw.
let schermSlot = null;
let slotAanvraag = null;
let slotGeweigerd = 0;
async function houdSchermAan(aan) {
  if (!("wakeLock" in navigator) || slotAanvraag) return;
  try {
    // Geweigerd (bijv. energiebesparing): niet elke seconde opnieuw proberen.
    if (aan && !schermSlot && document.visibilityState === "visible" && Date.now() - slotGeweigerd > 30000) {
      slotAanvraag = navigator.wakeLock.request("screen");
      schermSlot = await slotAanvraag;
      schermSlot.addEventListener("release", () => (schermSlot = null));
    } else if (!aan && schermSlot) {
      const slot = schermSlot;
      schermSlot = null;
      await slot.release();
    }
  } catch {
    schermSlot = null;
    slotGeweigerd = Date.now();
  } finally {
    slotAanvraag = null;
  }
}

// ---------- wekker bij kolven ----------
// Piept, trilt en toont een melding als de kolftimer de gekozen duur bereikt. Werkt zolang de
// app open is (het scherm blijft aan tijdens een timer); na terugkomen gaat hij alsnog af.
let wekkerMin = Number(ls.get("kolfWekker", 0)) || 0;
let geluid = null;
function ontgrendelGeluid() {
  try {
    geluid ??= new (window.AudioContext || window.webkitAudioContext)();
    geluid.resume?.();
  } catch {}
}
function piep() {
  if (!geluid) return;
  const t = geluid.currentTime;
  for (const [start, toon] of [[0, 880], [0.35, 1175], [0.7, 880]]) {
    const osc = geluid.createOscillator();
    const vol = geluid.createGain();
    osc.frequency.value = toon;
    vol.gain.setValueAtTime(0.0001, t + start);
    vol.gain.exponentialRampToValueAtTime(0.4, t + start + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.3);
    osc.connect(vol).connect(geluid.destination);
    osc.start(t + start);
    osc.stop(t + start + 0.32);
  }
}
function wekkerStand() {
  // Tegelijk: de kolftimer. Per kant: de kant die loopt (de wekker geldt dan per kant).
  const k = perKant() ? KOLFTIMERS.slice(1).find(loopt) || (seconden("KL") >= seconden("KR") ? "KL" : "KR") : "K";
  return { k, sec: seconden(k), sleutel: `${timer.kBegin}-${k}` };
}
function controleerWekker() {
  const status = $("#wekker-status");
  if (!wekkerMin || !kolfGebruikt() || !timer.kBegin) return void (status.textContent = "");
  const { k, sec, sleutel } = wekkerStand();
  const rest = wekkerMin * 60 - sec;
  if (ls.get("wekkerAf") === sleutel) return void (status.textContent = "Wekker is afgegaan.");
  if (rest > 0) {
    status.textContent = loopt(k) ? `Wekker gaat af over ${mmss(rest)}${perKant() ? ` (${kantNaam(k[1])})` : ""}.` : `Wekker na ${wekkerMin} min.`;
    return;
  }
  ls.set("wekkerAf", sleutel);
  status.textContent = "Wekker is afgegaan.";
  piep();
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  const herhaal = setInterval(piep, 2000);
  const stop = setTimeout(() => clearInterval(herhaal), 30000);
  kies(`Klaar met kolven: ${wekkerMin} minuten${perKant() ? ` ${kantNaam(k[1])}` : ""}.`, [{ tekst: "Wekker uit", waarde: "ok" }]).then(() => {
    clearInterval(herhaal);
    clearTimeout(stop);
  });
}
// Android: ook een timer in de Klok-app zetten, zodat de wekker afgaat als deze app dicht is.
// Dit gaat via een intent-link; andere telefoons (iPhone) kunnen dat niet.
const isAndroid = /Android/i.test(navigator.userAgent);
let klokAan = ls.get("klokAan", true) !== false;
function zetKlokTimer(seconden, label) {
  if (!isAndroid || !klokAan || !wekkerMin || seconden < 30) return;
  const terug = `${location.origin}${location.pathname}#klokfout`;
  location.href =
    "intent:#Intent;action=android.intent.action.SET_TIMER;" +
    `i.android.intent.extra.alarm.LENGTH=${Math.round(seconden)};` +
    `S.android.intent.extra.alarm.MESSAGE=${encodeURIComponent(label)};` +
    "B.android.intent.extra.alarm.SKIP_UI=true;" +
    `S.browser_fallback_url=${encodeURIComponent(terug)};end`;
}
$("#klok-optie").hidden = !isAndroid;
$("#klok-aan").checked = klokAan;
$("#klok-aan").addEventListener("change", (e) => {
  klokAan = e.target.checked;
  ls.set("klokAan", klokAan);
});
if (location.hash === "#klokfout") {
  history.replaceState(null, "", location.pathname + location.search);
  setTimeout(() => toast("De Klok-app kon geen timer zetten. De wekker in deze app werkt wel zolang hij open is."), 500);
}

for (const knop of $$(".wekkerchips .pil")) {
  knop.addEventListener("click", () => {
    wekkerMin = Number(knop.dataset.wekker);
    ls.set("kolfWekker", wekkerMin);
    if (wekkerMin) ontgrendelGeluid();
    werkTimersBij();
  });
}

// ---------- gekolfde melk als suggestie bij de fles ----------
// Wat er nog klaarstaat: opbrengst van de kolfsessies (laatste 48 uur) min de moedermelk die
// daarna uit de fles gegeven is, oudste melk eerst.
function voorraad() {
  const grens = Date.now() - 48 * 36e5;
  const partijen = [];
  for (const v of [...voedingen].filter((x) => x.tijd >= grens).sort((a, b) => a.tijd - b.tijd)) {
    if (isKolven(v)) {
      const ml = getal(v.kolfL) + getal(v.kolfR);
      if (ml) partijen.push({ tijd: v.tijd, rest: ml });
    } else {
      let n = getal(v.kolf);
      for (const p of partijen) {
        const deel = Math.min(p.rest, n);
        p.rest -= deel;
        n -= deel;
        if (!n) break;
      }
    }
  }
  return partijen.filter((p) => p.rest > 0);
}
function werkVoorraadBij() {
  const knop = $("#voorraad");
  const lijst = voorraad();
  knop.hidden = !lijst.length;
  if (!lijst.length) return;
  const oudste = lijst[0];
  const totaal = lijst.reduce((s, p) => s + p.rest, 0);
  knop.dataset.ml = oudste.rest;
  knop.classList.toggle("gebruikt", waardeVan("kolf") === Math.min(1000, oudste.rest));
  knop.innerHTML = `Gekolfd ${dagLabel(oudste.tijd) === "Vandaag" ? "om" : dagLabel(oudste.tijd).toLowerCase()} ${uurMin(oudste.tijd)}: nog <b>${oudste.rest} ml</b>` +
    (lijst.length > 1 ? ` (klaar in totaal ${totaal} ml)` : "") + `<br><span class="klein-grijs">Tik om als moedermelk in te vullen</span>`;
}
$("#voorraad").addEventListener("click", (e) => {
  $("#kolf").value = Math.min(1000, Number(e.currentTarget.dataset.ml));
  werkKnoppenBij();
  werkVoorraadBij();
});

// ---------- keuzevraag ----------
// Een eigen venster met duidelijk benoemde knoppen; de eerste is de hoofdkeuze.
// Geeft de waarde van de gekozen knop, of null bij wegtikken.
function kies(tekst, knoppen) {
  const dlg = $("#dlg-kies");
  $("#kies-tekst").textContent = tekst;
  const rij = $("#kies-knoppen");
  rij.replaceChildren();
  return new Promise((klaar) => {
    knoppen.forEach((k, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = i === 0 ? "primair" : "secundair";
      b.textContent = k.tekst;
      b.dataset.waarde = k.waarde;
      b.addEventListener("click", () => {
        dlg.close();
        klaar(k.waarde);
      });
      rij.append(b);
    });
    dlg.oncancel = (e) => {
      e.preventDefault();
      dlg.close();
      klaar(null);
    };
    dlg.showModal();
  });
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

// Drie modi: borst en fles delen één formulier, kolven heeft een eigen formulier.
let modus = ["borst", "fles", "kolven"].includes(ls.get("modus")) ? ls.get("modus") : "borst";
function toonModus(m) {
  modus = m;
  ls.set("modus", m);
  for (const b of $$(".modus button")) {
    b.classList.toggle("aan", b.dataset.modus === m);
    b.setAttribute("aria-selected", b.dataset.modus === m);
  }
  $("#invoer").hidden = m === "kolven";
  $("#kolfinvoer").hidden = m !== "kolven";
  $(".deel-borst").hidden = m !== "borst";
  $(".deel-fles").hidden = m !== "fles";
  $("#invoer .opslaan").textContent = m === "fles" ? "Fles opslaan" : "Borstvoeding opslaan";
  document.body.dataset.modus = m;
  if (typeof zetTijden === "function") zetTijden();
  werkTimersBij();
}
for (const b of $$(".modus button")) b.addEventListener("click", () => toonModus(b.dataset.modus));

// ---------- timers (gedeeld tussen de telefoons) ----------
// Alles is gebaseerd op tijdstempels, dus de timer loopt door als het scherm vergrendelt
// of de app sluit, en het blijft dezelfde sessie.
const MAX_MIN = { L: 180, R: 180, K: 240, KL: 240, KR: 240 };
const leegTimer = () => ({
  L: { acc: 0, start: null },
  R: { acc: 0, start: null },
  begin: null,
  laatst: null,
  K: { acc: 0, start: null },
  // Kolven per kant (om de beurt of apart gemeten); kModus kiest tussen "samen" en "kant".
  KL: { acc: 0, start: null },
  KR: { acc: 0, start: null },
  kModus: ls.get("kolfModus", "samen") === "kant" ? "kant" : "samen",
  kBegin: null,
  // Wie de sessie startte en wanneer hij voor het laatst gepauzeerd werd.
  bDoor: null,
  gepauzeerd: null,
  kDoor: null,
  kGepauzeerd: null,
});
const TIMERVELDEN = Object.keys(leegTimer());
const alleenTimervelden = (t) => Object.fromEntries(TIMERVELDEN.filter((k) => k in (t || {})).map((k) => [k, t[k]]));
const standVan = (velden) => JSON.stringify(velden.map((k) => timer[k]));
let timer = { ...leegTimer(), ...alleenTimervelden(ls.get("timers", null) || ls.get("borsttimer", null)) };
const seconden = (k) => timer[k].acc + (timer[k].start ? Math.max(0, Date.now() - timer[k].start) / 1000 : 0);
// Minder dan 15 seconden telt niet (per ongeluk getikt); daarboven minstens 1 minuut.
const minutenVan = (k) => {
  const s = seconden(k);
  return s < 15 ? 0 : Math.min(MAX_MIN[k], Math.max(1, Math.round(s / 60)));
};
const loopt = (k) => Boolean(timer[k].start);
const borstLoopt = () => loopt("L") || loopt("R");
const borstGebruikt = () => borstLoopt() || seconden("L") > 0 || seconden("R") > 0;
const BORST = ["L", "R", "begin", "laatst", "bDoor", "gepauzeerd"];
const KOLF = ["K", "KL", "KR", "kModus", "kBegin", "kDoor", "kGepauzeerd"];
const KOLFTIMERS = ["K", "KL", "KR"];
const perKant = () => timer.kModus === "kant";
const kolfLoopt = () => KOLFTIMERS.some(loopt);
const kolfGebruikt = () => KOLFTIMERS.some((k) => seconden(k) > 0);
const kolfMin = () => (perKant() ? minutenVan("KL") + minutenVan("KR") : minutenVan("K"));
const lopendeKolf = () => KOLFTIMERS.find(loopt);
const LANGE_PAUZE = 20 * 60000;

// Alleen de gewijzigde velden delen, zodat je nooit de timer van de ander overschrijft.
// Wijzigingen van voor de database klaar is, worden bewaard en daarna alsnog gedeeld.
// Alleen velden die echt veranderd zijn t.o.v. de laatst gedeelde stand worden geschreven.
// Zo overschrijft een telefoon met een verouderde stand nooit een timer die hij niet aanraakte.
const nogTeDelen = new Set();
let gedeeld = structuredClone(timer);
let sessieVoorWachtrij = null;
function bewaarTimer(velden) {
  ls.set("timers", timer);
  const gewijzigd = velden.filter((k) => JSON.stringify(timer[k]) !== JSON.stringify(gedeeld[k]));
  if (!gewijzigd.length) return;
  // De sessie zoals deze telefoon hem kende; de server weigert als die intussen anders is.
  const sessie = { bSessie: gedeeld.begin ?? null, kSessie: gedeeld.kBegin ?? null };
  for (const k of gewijzigd) gedeeld[k] = structuredClone(timer[k]);
  if (!store) {
    sessieVoorWachtrij ??= sessie;
    return gewijzigd.forEach((k) => nogTeDelen.add(k));
  }
  store.zetTimer?.({ ...Object.fromEntries(gewijzigd.map((k) => [k, timer[k]])), ...sessie }, naam || "");
}

function pauzeer(k) {
  if (!timer[k].start) return;
  timer[k].acc = seconden(k);
  timer[k].start = null;
  if (KOLFTIMERS.includes(k)) {
    if (!kolfLoopt()) timer.kGepauzeerd = Date.now();
  }
  else if (!borstLoopt()) timer.gepauzeerd = Date.now();
}

const borstTekst = () => [minutenVan("L") && `links ${minutenVan("L")} min`, minutenVan("R") && `rechts ${minutenVan("R")} min`].filter(Boolean).join(", ");

async function wisselBorst(k) {
  if (loopt(k)) {
    pauzeer(k);
  } else {
    // Lang gepauzeerd en niet opgeslagen: waarschijnlijk een nieuwe voeding.
    if (!borstLoopt() && timer.begin && timer.gepauzeerd && Date.now() - timer.gepauzeerd > LANGE_PAUZE && borstGebruikt()) {
      const keuze = await kies(`De vorige borstvoeding van ${uurMin(timer.begin)} (${borstTekst()}) is nog niet opgeslagen.`, [
        { tekst: "Opslaan en nieuwe voeding beginnen", waarde: "apart" },
        { tekst: "Doorgaan met dezelfde voeding", waarde: "door" },
      ]);
      if (!keuze) return;
      if (keuze === "apart") slaVorigeBorstOp();
    }
    pauzeer(k === "L" ? "R" : "L");
    timer[k].start = Date.now();
    timer.laatst = k;
    timer.gepauzeerd = null;
    if (!timer.begin) {
      timer.begin = Date.now();
      timer.bDoor = naam || "";
    }
  }
  bewaarTimer(BORST);
  zetTijden();
  werkTimersBij();
}

function slaVorigeBorstOp() {
  registreer({
    tijd: timer.begin,
    borstL: minutenVan("L"),
    borstR: minutenVan("R"),
    kolf: 0,
    kunst: 0,
    eindKant: timer.laatst || null,
    door: timer.bDoor || naam || "",
  }, `b_${timer.begin}`);
  Object.assign(timer, Object.fromEntries(BORST.map((k) => [k, leegTimer()[k]])));
  formulieren.voeding.handmatig = false;
  toast("Vorige voeding apart opgeslagen");
}

// Kolftimers lopen onafhankelijk: per kant mogen links en rechts tegelijk lopen (dubbel kolven).
async function wisselKolf(k = "K") {
  if (loopt(k)) {
    pauzeer(k);
  } else {
    if (!kolfLoopt() && timer.kBegin && timer.kGepauzeerd && Date.now() - timer.kGepauzeerd > LANGE_PAUZE && kolfGebruikt()) {
      const keuze = await kies(`De vorige kolfsessie van ${uurMin(timer.kBegin)} (${kolfMin()} min) is nog niet opgeslagen.`, [
        { tekst: "Eerst afronden (opbrengst invullen)", waarde: "af" },
        { tekst: "Doorgaan met dezelfde sessie", waarde: "door" },
      ]);
      if (!keuze) return;
      if (keuze === "af") {
        toonModus("kolven");
        $("#kolfL").focus();
        $("#kolfL").scrollIntoView({ block: "center" });
        return;
      }
    }
    // Nieuwe start van deze kolftimer met wekker: ook de Klok-app instellen (Android).
    const nogTeGaan = wekkerMin * 60 - seconden(k);
    const nieuw = seconden(k) === 0;
    timer[k].start = Date.now();
    timer.kGepauzeerd = null;
    if (nieuw) setTimeout(() => zetKlokTimer(nogTeGaan, perKant() ? `Kolven ${kantNaam(k[1])}` : "Kolven"), 50);
    if (!timer.kBegin) {
      timer.kBegin = Date.now();
      timer.kDoor = naam || "";
    }
  }
  bewaarTimer(KOLF);
  zetTijden();
  werkTimersBij();
}

// Per ongeluk gestart of vergeten: de timer leegmaken, met ongedaan maken.
function wisTimer(velden) {
  const vorig = structuredClone(Object.fromEntries(velden.map((k) => [k, timer[k]])));
  const leeg = leegTimer();
  for (const k of velden) timer[k] = leeg[k];
  bewaarTimer(velden);
  zetTijden();
  werkTimersBij();
  const na = standVan(velden);
  toast("Timer gewist", "Ongedaan maken", () => {
    if (standVan(velden) !== na) return toast("De timer is intussen al opnieuw gebruikt; niet teruggezet.");
    Object.assign(timer, vorig);
    bewaarTimer(velden);
    zetTijden();
    werkTimersBij();
  });
}
$("#wis-borst").addEventListener("click", () => wisTimer(BORST));
$("#wis-kolf").addEventListener("click", () => wisTimer(KOLF));

// Tegelijk of per kant kolven. Wisselen kan alleen zolang er nog geen tijd op staat.
for (const knop of $$(".kolfmodus button")) {
  knop.addEventListener("click", () => {
    if (knop.dataset.kmodus === timer.kModus) return;
    if (kolfGebruikt()) return toast("Wis eerst de kolftimer om te wisselen.");
    timer.kModus = knop.dataset.kmodus;
    ls.set("kolfModus", timer.kModus);
    bewaarTimer(["kModus"]);
    werkTimersBij();
  });
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
  $("#wis-borst").hidden = !(borstGebruikt() || timer.laatst);
  timerKnop($("#kolftimer"), "K");
  $(".kolfduur").classList.toggle("actief", loopt("K"));
  $("#wis-kolf").hidden = !kolfGebruikt();
  const duurInp = $("#kolfduur");
  if (document.activeElement !== duurInp) duurInp.value = seconden("K") > 0 ? minutenVan("K") : "";
  for (const knop of $$(".kolfmodus button")) knop.classList.toggle("aan", knop.dataset.kmodus === timer.kModus);
  $(".kolfduur").hidden = perKant();
  $(".kolfperkant").hidden = !perKant();
  for (const kant of $$(".kkant")) {
    const k = kant.dataset.k;
    kant.classList.toggle("actief", loopt(k));
    timerKnop($(".timer", kant), k);
    const inp = $(".minuten input", kant);
    if (document.activeElement !== inp) inp.value = seconden(k) > 0 ? minutenVan(k) : "";
  }

  // Melding als er een timer loopt in de modus die je nu niet ziet.
  const banner = $("#loopt");
  const andere = modus !== "kolven" && kolfLoopt() ? "kolven" : modus !== "borst" && borstLoopt() ? "borst" : null;
  banner.hidden = !andere;
  if (andere) {
    const k = andere === "kolven" ? lopendeKolf() : loopt("L") ? "L" : "R";
    const wat = andere === "kolven" ? "Kolven" : `Borstvoeding ${kantNaam(k)}`;
    banner.textContent = `${wat} loopt ${mmss(seconden(k))} · openen`;
    banner.dataset.modus = andere;
  }
  // Lopende sessie ook bij "Laatste voeding" tonen, met wie hem startte.
  const bezig = $("#bezig");
  const delen = [];
  if (borstLoopt()) {
    const k = loopt("L") ? "L" : "R";
    delen.push(`borstvoeding ${kantNaam(k)} ${mmss(seconden(k))}${timer.bDoor && timer.bDoor !== naam ? ` (${timer.bDoor})` : ""}`);
  }
  if (kolfLoopt()) delen.push(`kolven ${mmss(seconden(lopendeKolf()))}${timer.kDoor && timer.kDoor !== naam ? ` (${timer.kDoor})` : ""}`);
  bezig.hidden = !delen.length;
  houdSchermAan(delen.length > 0);
  for (const knop of $$(".wekkerchips .pil")) knop.classList.toggle("gekozen", Number(knop.dataset.wekker) === wekkerMin);
  controleerWekker();
  bezig.textContent = delen.length ? "Nu bezig: " + delen.join(", ") : "";
  werkKnoppenBij();
}
$("#loopt").addEventListener("click", (e) => toonModus(e.currentTarget.dataset.modus));

for (const kant of $$(".kant")) {
  const k = kant.dataset.kant;
  $(".timer", kant).addEventListener("click", () => wisselBorst(k));
  const inp = $(".minuten input", kant);
  // Een leeg veld (bijv. tijdens corrigeren) doet niets; pas bij verlaten telt leeg als 0,
  // en een lopende timer blijft dan gewoon staan.
  inp.addEventListener("focus", () => (voorBijstellen = structuredClone(Object.fromEntries(BORST.map((x) => [x, timer[x]])))));
  inp.addEventListener("change", () => {
    if (inp.value === "" && !loopt(k)) inp.dispatchEvent(new Event("input"));
    else if (inp.value === "") werkTimersBij();
    meldBijgesteld(BORST);
  });
  inp.addEventListener("input", () => {
    if (inp.value === "" && (document.activeElement === inp || loopt(k))) return;
    const min = Math.min(MAX_MIN[k], getal(inp.value));
    if (loopt(k)) {
      // Loopt de timer: bijstellen zonder te stoppen.
      timer[k].acc = 0;
      timer[k].start = Date.now() - min * 60000;
    } else {
      timer[k].acc = min * 60;
    }
    if (min && !timer.laatst) timer.laatst = k;
    if (!borstGebruikt()) timer.begin = null;
    else {
      // Handmatige invoer is ook een sessie: met begin en pauze, zodat de vraag bij een
      // lange pauze en het tijdstip kloppen.
      if (!timer.begin) timer.begin = Date.now() - min * 60000;
      if (!borstLoopt()) timer.gepauzeerd = Date.now();
      if (!timer.bDoor) timer.bDoor = naam || "";
    }
    // Vergeten timer bijgesteld: het tijdstip is dan nu min de duur, niet het oude begin.
    const duur = (seconden("L") + seconden("R")) * 1000;
    if (timer.begin && timer.begin < Date.now() - duur - 5 * 60000) timer.begin = Date.now() - duur;
    bewaarTimer(BORST);
    zetTijden();
    werkTimersBij();
  });
  inp.addEventListener("focus", () => inp.select());
}
for (const knop of $$(".laatstekant .segment button")) {
  knop.addEventListener("click", () => {
    timer.laatst = timer.laatst === knop.dataset.eind ? null : knop.dataset.eind;
    bewaarTimer(["laatst"]);
    werkTimersBij();
  });
}
$("#kolftimer").addEventListener("click", () => {
  ontgrendelGeluid();
  wisselKolf("K");
});
for (const kant of $$(".kkant")) $(".timer", kant).addEventListener("click", () => {
  ontgrendelGeluid();
  wisselKolf(kant.dataset.k);
});

// Na handmatig bijstellen: melding met ongedaan maken.
let voorBijstellen = null;
function meldBijgesteld(velden) {
  const vorig = voorBijstellen;
  voorBijstellen = null;
  if (!vorig || velden.every((x) => JSON.stringify(vorig[x]) === JSON.stringify(timer[x]))) return;
  const na = standVan(velden);
  toast("Minuten aangepast", "Ongedaan maken", () => {
    if (standVan(velden) !== na) return toast("De timer is intussen al veranderd; niet teruggezet.");
    Object.assign(timer, vorig);
    bewaarTimer(velden);
    zetTijden();
    werkTimersBij();
  });
}
// Minuten intypen bij kolven (tegelijk of per kant); zelfde regels als bij de borst.
function koppelKolfMinuten(inp, k) {
  inp.addEventListener("focus", () => {
    voorBijstellen = structuredClone(Object.fromEntries(KOLF.map((x) => [x, timer[x]])));
    inp.select();
  });
  inp.addEventListener("change", () => {
    if (inp.value === "" && !loopt(k)) inp.dispatchEvent(new Event("input"));
    else if (inp.value === "") werkTimersBij();
    meldBijgesteld(KOLF);
  });
  inp.addEventListener("input", () => {
    if (inp.value === "" && (document.activeElement === inp || loopt(k))) return;
    const min = Math.min(MAX_MIN[k], getal(inp.value));
    if (loopt(k)) {
      timer[k].acc = 0;
      timer[k].start = Date.now() - min * 60000;
    } else {
      timer[k].acc = min * 60;
    }
    if (!kolfGebruikt()) timer.kBegin = null;
    else {
      const duur = KOLFTIMERS.reduce((m, x) => Math.max(m, seconden(x)), 0) * 1000;
      if (!timer.kBegin) timer.kBegin = Date.now() - duur;
      if (timer.kBegin < Date.now() - duur - 5 * 60000) timer.kBegin = Date.now() - duur;
      if (!kolfLoopt()) timer.kGepauzeerd = Date.now();
      if (!timer.kDoor) timer.kDoor = naam || "";
    }
    bewaarTimer(KOLF);
    zetTijden();
    werkTimersBij();
  });
}
koppelKolfMinuten($("#kolfduur"), "K");
for (const kant of $$(".kkant")) koppelKolfMinuten($(".minuten input", kant), kant.dataset.k);

// ---------- tijdvelden ----------
const formulieren = {
  voeding: { form: $("#invoer"), tijd: $("#tijd"), handmatig: false, begin: () => (modus === "borst" ? timer.begin : null) },
  kolven: { form: $("#kolfinvoer"), tijd: $("#kolftijd"), handmatig: false, begin: () => timer.kBegin },
};

function tijdUitInvoer(input) {
  const [u, m] = input.value.split(":").map(Number);
  // Leeg of ongeldig tijdveld (bijv. "Wissen" in de tijdkiezer): dan nu.
  if (!Number.isInteger(u) || !Number.isInteger(m)) return Date.now();
  const d = new Date();
  d.setHours(u, m, 0, 0);
  // Tijd in de toekomst (bijv. 23:50 ingevuld om 00:10): dan was het gisteren.
  // Dit wordt naast het tijdveld getoond, zodat het nooit stil gebeurt.
  if (d.getTime() > Date.now() + 5 * 60000) d.setDate(d.getDate() - 1);
  return d.getTime();
}

function werkDaghintBij(f) {
  const hint = $(".daghint", f.form);
  if (!f.tijd.value) return (hint.textContent = "");
  const t = tijdUitInvoer(f.tijd);
  const label = dagLabel(t);
  hint.textContent = label === "Vandaag" ? "vandaag" : label.toLowerCase();
  hint.classList.toggle("anders", label !== "Vandaag");
}

function zetTijden() {
  for (const f of Object.values(formulieren)) {
    if (!f.handmatig) f.tijd.value = uurMin(f.begin() || Date.now());
    werkDaghintBij(f);
  }
}

for (const [m, f] of Object.entries(formulieren)) {
  f.tijd.addEventListener("input", () => {
    f.handmatig = true;
    werkDaghintBij(f);
  });
  $(".knop-nu", f.form).addEventListener("click", () => {
    f.handmatig = true;
    f.tijd.value = uurMin(Date.now());
    werkDaghintBij(f);
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
  input.addEventListener("input", () => {
    if (getal(input.value) > 1000) input.value = 1000;
    werkKnoppenBij();
  });
  input.addEventListener("focus", () => input.select());
}

// Nooit meer dan 1000 ml: dat weigert de database, en dan zou de invoer verloren gaan.
const waardeVan = (id) => Math.min(1000, getal($("#" + id).value));

function werkKnoppenBij() {
  for (const blok of $$(".soort[data-soort]")) {
    const v = getal($("input", blok).value);
    for (const c of $$(".pil", blok)) c.classList.toggle("gekozen", Number(c.dataset.ml) === v);
  }
  const kolfTot = waardeVan("kolfL") + waardeVan("kolfR");
  $("#kolftotaal").textContent = kolfTot ? `· ${kolfTot} ml` : "";
  $("#invoer .opslaan").disabled = modus === "fles" ? !(waardeVan("kolf") || waardeVan("kunst")) : !(borstGebruikt() || timer.laatst);
  $("#kolfinvoer .opslaan").disabled = !(waardeVan("kolfL") || waardeVan("kolfR") || kolfGebruikt());
  if (!$("#voorraad").hidden) $("#voorraad").classList.toggle("gebruikt", waardeVan("kolf") === Number($("#voorraad").dataset.ml));
}

// ---------- opslaan ----------
// Tijd voor een losse fles terwijl de borsttimer van de ander loopt: niet diens begintijd.
function tijdUitNu(m) {
  const f = formulieren[m];
  return f.handmatig ? tijdUitInvoer(f.tijd) : Date.now();
}

function tijdVoor(m) {
  const f = formulieren[m];
  if (!f.tijd.value) f.tijd.value = uurMin(Date.now());
  return tijdUitInvoer(f.tijd);
}

function naOpslaan(id, herstel) {
  navigator.vibrate?.(30);
  toast("Opgeslagen", "Ongedaan maken", () => {
    verwijder(id);
    herstel();
  });
}

// Controles tegen vergissingen om 3 uur 's nachts. Geeft false als de ouder annuleert.
async function vergeten(begin, minuten) {
  if (!begin) return true;
  const uren = (Date.now() - begin) / 36e5;
  if (uren < 3 && minuten <= 90) return true;
  return (await kies(`Deze sessie begon ${dagLabel(begin).toLowerCase()} om ${uurMin(begin)} en duurde ${minuten} min. Klopt dat?`, [
    { tekst: `Klopt, opslaan om ${uurMin(begin)}`, waarde: "ja" },
    { tekst: "Nee, eerst aanpassen", waarde: "nee" },
  ])) === "ja";
}
// Zelfde soort registratie binnen 15 minuten, van wie dan ook: waarschijnlijk dubbel.
const soortVan = (v) => (isKolven(v) ? "kolven" : getal(v.borstL) || getal(v.borstR) || v.eindKant ? "borst" : "fles");
async function dubbel(v) {
  const soort = soortVan(v);
  const ander = voedingen.find((x) => soortVan(x) === soort && Math.abs(x.tijd - v.tijd) <= 15 * 60000);
  if (!ander) return true;
  const wat = { kolven: "een kolfsessie", borst: "een borstvoeding", fles: "een fles" }[soort];
  const wie = ander.door === naam ? "Je" : ander.door || "";
  return (await kies(`${wie || "Er"} ${wie ? "registreerde" : "is"} om ${uurMin(ander.tijd)} al ${wat}${wie ? "" : " geregistreerd"}.`, [
    { tekst: "Toch opslaan", waarde: "ja" },
    { tekst: "Niet opslaan", waarde: "nee" },
  ])) === "ja";
}

$("#invoer").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("#dlg-kies").open) return;
  // Borst en fles zijn aparte registraties; een fles laat een lopende borsttimer met rust.
  const metBorst = modus === "borst";
  const voeding = {
    tijd: metBorst ? tijdVoor("voeding") : tijdUitNu("voeding"),
    borstL: metBorst ? minutenVan("L") : 0,
    borstR: metBorst ? minutenVan("R") : 0,
    kolf: metBorst ? 0 : waardeVan("kolf"),
    kunst: metBorst ? 0 : waardeVan("kunst"),
    eindKant: metBorst ? timer.laatst || null : null,
    door: naam || "",
  };
  if (metBorst && !voeding.borstL && !voeding.borstR &&
      (await kies(`Borstvoeding zonder minuten opslaan${voeding.eindKant ? ` (alleen geëindigd met ${kantNaam(voeding.eindKant)})` : ""}?`, [
        { tekst: "Opslaan zonder minuten", waarde: "ja" },
        { tekst: "Terug", waarde: "nee" },
      ])) !== "ja") return;
  if (!(await vergeten(metBorst ? timer.begin : null, voeding.borstL + voeding.borstR)) || !(await dubbel(voeding))) return;
  const vorig = structuredClone(Object.fromEntries(BORST.map((k) => [k, timer[k]])));
  const vorigeTijd = $("#tijd").value;
  const id = registreer(voeding, metBorst && timer.begin ? `b_${timer.begin}` : null);
  // Alleen de borsttimer leegmaken als die bij deze voeding hoorde.
  if (metBorst) {
    Object.assign(timer, Object.fromEntries(BORST.map((k) => [k, leegTimer()[k]])));
    bewaarTimer(BORST);
  }
  if (!metBorst) {
    $("#kolf").value = 0;
    $("#kunst").value = 0;
  }
  formulieren.voeding.handmatig = false;
  zetTijden();
  werkTimersBij();
  naOpslaan(id, () => {
    if (metBorst) {
      // Is er intussen al een nieuwe borstvoeding gestart (door wie dan ook), dan die niet overschrijven.
      if (borstGebruikt()) {
        toast("Er loopt al een nieuwe borstvoeding. De opgeslagen voeding is verwijderd; de timer is niet teruggezet.");
      } else {
        Object.assign(timer, vorig);
        bewaarTimer(BORST);
      }
    }
    if (!metBorst) {
      $("#kolf").value = voeding.kolf;
      $("#kunst").value = voeding.kunst;
    }
    $("#tijd").value = vorigeTijd;
    formulieren.voeding.handmatig = true;
    zetTijden();
    werkTimersBij();
  });
});

$("#kolfinvoer").addEventListener("submit", async (e) => {
  e.preventDefault();
  if ($("#dlg-kies").open) return;
  const sessie = {
    type: "kolven",
    tijd: tijdVoor("kolven"),
    kolfL: waardeVan("kolfL"),
    kolfR: waardeVan("kolfR"),
    duur: Math.min(240, kolfMin()),
    ...(perKant() ? { duurL: minutenVan("KL"), duurR: minutenVan("KR") } : {}),
    door: naam || "",
  };
  if (!sessie.kolfL && !sessie.kolfR &&
      (await kies("Er is geen opbrengst ingevuld.", [
        { tekst: "Opslaan met alleen de duur", waarde: "ja" },
        { tekst: "Opbrengst invullen", waarde: "nee" },
      ])) !== "ja") return;
  if (!(await vergeten(timer.kBegin, sessie.duur)) || !(await dubbel(sessie))) return;
  const vorig = structuredClone(Object.fromEntries(KOLF.map((k) => [k, timer[k]])));
  const vorigeTijd = $("#kolftijd").value;
  const id = registreer(sessie, timer.kBegin ? `k_${timer.kBegin}` : null);
  Object.assign(timer, Object.fromEntries(KOLF.map((k) => [k, leegTimer()[k]])));
  bewaarTimer(KOLF);
  $("#kolfL").value = 0;
  $("#kolfR").value = 0;
  formulieren.kolven.handmatig = false;
  zetTijden();
  werkTimersBij();
  naOpslaan(id, () => {
    if (kolfGebruikt()) {
      toast("Er loopt al een nieuwe kolfsessie. De opgeslagen sessie is verwijderd; de timer is niet teruggezet.");
    } else {
      Object.assign(timer, vorig);
      bewaarTimer(KOLF);
    }
    $("#kolfL").value = sessie.kolfL;
    $("#kolfR").value = sessie.kolfR;
    $("#kolftijd").value = vorigeTijd;
    formulieren.kolven.handmatig = true;
    zetTijden();
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
  if (metKant) pil.innerHTML = `Vorige keer geëindigd met: <b>${kantNaam(metKant.eindKant)}</b> <span>(${uurMin(metKant.tijd)})</span>`;
}

// Vandaag in drie vragen: wat is gevoed, wat is gekolfd, wat is er nog over.
function dagBlok(t) {
  const regel = (hoofd, wat, detail) => `<div class="bregel"><b>${hoofd}</b><span class="bwat">${wat}</span>${detail ? `<span class="bdetail">${detail}</span>` : ""}</div>`;
  const flesMl = t.kunst + t.fles;
  const gevoed = [
    flesMl && regel(`${flesMl} ml`, "fles", [t.kunst && `${t.kunst} kunstvoeding`, t.fles && `${t.fles} moedermelk`].filter(Boolean).join(" + ")),
    t.borst && regel(`${t.borst} min`, "borst", `L ${t.L} · R ${t.R}`),
  ].filter(Boolean).join("") || `<div class="bleeg">Nog niets gevoed</div>`;
  const gekolfd = t.kolf
    ? regel(`${t.kolf} ml`, "", `L ${t.kolfL} · R ${t.kolfR} · ${t.kolfsessies} keer`)
    : `<div class="bleeg">Nog niet gekolfd</div>`;
  const over = voorraad().reduce((s, p) => s + p.rest, 0);
  return `
    <div class="blok gevoed"><div class="bkop">Gevoed${t.voedingen ? `<span>${t.voedingen} keer</span>` : ""}</div>${gevoed}</div>
    <div class="blok gekolfd"><div class="bkop">Gekolfd</div>${gekolfd}</div>
    ${over || t.kolf ? `<div class="blok over"><div class="bkop">Over</div>${regel(`${over} ml`, "gekolfde melk", "nog niet gegeven")}</div>` : ""}`;
}

function renderLijst() {
  const vandaag = dagStart(Date.now());
  $("#totalen-vandaag").innerHTML = dagBlok(totalen(voedingen.filter((v) => dagStart(v.tijd) === vandaag)));

  const perDag = new Map();
  for (const v of voedingen) {
    const d = dagStart(v.tijd);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(v);
  }
  const dagen = [...perDag.entries()];
  const html = dagen.slice(0, dagenZichtbaar).map(([d, lijst]) => {
    const t = totalen(lijst);
    const samenvatting = [t.kunst + t.fles && `fles ${t.kunst + t.fles} ml`, t.borst && `borst ${t.borst} min`, t.kolf && `gekolfd ${t.kolf} ml`].filter(Boolean).join(" · ");
    const rijen = lijst.map((v) => `
      <button class="item" data-id="${esc(v.id)}">
        <span class="item-tijd">${uurMin(v.tijd)}</span>
        <span class="item-delen">${regels(v).map((g) => `<span class="iregel ${g.soort}"><span class="ilabel">${g.label}</span><b>${esc(g.hoofd)}</b><span class="idetail">${esc(g.detail)}</span></span>`).join("")}</span>
        <span class="item-door">${esc(v.door || "")}</span>
      </button>`).join("");
    return `<div class="dag" data-dag="${d}"><div class="dagkop"><span>${dagLabel(d)}</span><span>${samenvatting}</span></div>${rijen}</div>`;
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
// Richtlijn: bij minder dan 500 ml kunstvoeding per dag krijgt een baby extra vitamine K.
// De app toont alleen de cijfers en de lijn; het besluit hoort bij het consultatiebureau.
const VITK_ML = 500;

function perDagIndex() {
  const perDag = new Map();
  for (const v of voedingen) {
    const d = dagStart(v.tijd);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(v);
  }
  return perDag;
}
const eersteDag = () => (voedingen.length ? dagStart(Math.min(...voedingen.map((v) => v.tijd))) : dagStart(Date.now()));

function dagreeks(n) {
  const vandaag = dagStart(Date.now());
  const perDag = perDagIndex();
  const eerste = eersteDag();
  const reeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = plusDagen(vandaag, -i);
    const dt = new Date(d);
    reeks.push({
      d,
      t: totalen(perDag.get(d) || []),
      // Alleen dagen met registraties tellen mee in gemiddelden en trends.
      actief: perDag.has(d),
      binnen: d >= eerste,
      lopend: d === vandaag,
      as: n <= 7 ? dt.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2) : String(dt.getDate()),
      naam: d === vandaag ? "Vandaag" : dt.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric" }),
    });
  }
  return reeks;
}

// Per week (maandag t/m zondag): gemiddelde per dag, over de dagen met gegevens.
function weekreeks(n) {
  const vandaag = dagStart(Date.now());
  const dagen = dagreeks(n * 7 + 6).filter((x) => x.actief);  // alleen dagen met registraties
  const maandag = plusDagen(vandaag, -((new Date(vandaag).getDay() + 6) % 7));
  const reeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const van = plusDagen(maandag, -7 * i);
    const tot = plusDagen(van, 7);
    const inWeek = dagen.filter((x) => x.d >= van && x.d < tot && !x.lopend);
    const t = {};
    for (const k of Object.keys(totalen([]))) t[k] = inWeek.length ? Math.round(inWeek.reduce((s, x) => s + x.t[k], 0) / inWeek.length) : 0;
    const dt = new Date(van);
    reeks.push({
      d: van,
      t,
      actief: inWeek.length > 0,
      binnen: inWeek.length > 0,
      lopend: i === 0,
      as: `${dt.getDate()}/${dt.getMonth() + 1}`,
      naam: `${i === 0 ? "Deze week" : "Week " + dt.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}`,
    });
  }
  // Lege weken van voor de eerste registratie weglaten (minimaal 4 weken tonen).
  while (reeks.length > 4 && !reeks[0].actief) reeks.shift();
  return reeks;
}

// Vergelijk de laatste volle dagen met de dagen ervoor (vandaag telt niet mee, die loopt nog).
function trend(sleutel) {
  // Half bijgehouden dagen (minder dan de helft van het gebruikelijke aantal registraties) tellen niet mee.
  const volle = dagreeks(15).filter((x) => x.actief && !x.lopend);
  const aantallen = volle.map((x) => x.t.aantal).sort((a, b) => a - b);
  const mediaan = aantallen[Math.floor(aantallen.length / 2)] || 0;
  const reeks = volle.filter((x) => x.t.aantal >= mediaan / 2);
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
  const kleur = richting === "gelijk" || !goedAls ? "" : richting === goedAls ? "goed" : "let";
  const pct = richting === "gelijk" ? "" : ` (${t.pct > 0 ? "+" : ""}${t.pct}%)`;
  return `<span class="trend ${kleur}">${pijl} ${woord}${pct}</span>
    <span class="trenduitleg">gem. ${Math.round(t.nu)} ${eenheid}/dag over de laatste ${t.w} volle dagen, daarvoor ${Math.round(t.toen)}</span>`;
}

function renderGisteren() {
  const gist = plusDagen(dagStart(Date.now()), -1);
  const t = totalen(voedingen.filter((v) => dagStart(v.tijd) === gist));
  const datum = new Date(gist).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  if (!t.aantal) {
    $("#gisteren").innerHTML = `<h2>Gisteren <span class="klein-grijs">${datum}</span></h2>
      <p class="leeg">Gisteren is niets geregistreerd. Deze dag telt niet mee in gemiddelden, trends en de vitamine K-telling.</p>`;
    return;
  }
  const week = dagreeks(8).filter((x) => x.actief && !x.lopend);
  const onder = week.filter((x) => x.t.kunst < VITK_ML).length;
  const vitk = (t.kunst >= VITK_ML ? `${VITK_ML} ml of meer` : `onder de ${VITK_ML} ml-grens`) +
    (week.length ? `; ${onder} van de laatste ${week.length} dagen onder ${VITK_ML} ml` : "");
  $("#gisteren").innerHTML = `
    <h2>Gisteren <span class="klein-grijs">${datum}</span></h2>
    <div class="blik">
      <div class="blikvak kunst"><span>Kunstvoeding</span><b>${t.kunst} ml</b><small>${vitk} (vitamine K)</small>${trendTekst("kunst", "ml", null)}</div>
      <div class="blikvak kolf"><span>Gekolfd</span><b>${t.kolf} ml</b><small>L ${t.kolfL} · R ${t.kolfR} ml · ${t.kolfsessies} keer</small>${trendTekst("kolf", "ml", "op")}</div>
      <div class="blikvak samen"><span>Kunstvoeding + gekolfd samen</span><b>${t.samen} ml</b></div>
      <div class="blikvak borst"><span>Borstvoeding</span><b>${t.borst} min</b><small>L ${t.L} · R ${t.R} min · ${t.borstKeer} keer</small>${trendTekst("borst", "min", "op")}</div>
    </div>`;
}

function staafgrafiek(el, { titel, eenheid, reeks, delen, kleuren, legenda, lijn }) {
  const W = 340, H = 170, pl = 30, pb = 20, pt = 16, pr = 4;
  const n = reeks.length;
  const waarden = reeks.map((x) => delen.reduce((s, k) => s + x.t[k], 0));
  // De lopende dag of week bepaalt de schaal niet (die kan uitschieten); zo'n staaf wordt afgekapt.
  const max = Math.max(10, ...waarden.filter((_, i) => !reeks[i].lopend || reeks.every((x) => x.lopend || !x.actief)), lijn ? lijn.waarde * 1.05 : 0);
  const stap = [10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => max / s <= 4) || 1000;
  const top = Math.ceil(max / stap) * stap;
  const bw = (W - pl - pr) / n;
  const y = (v) => pt + (H - pt - pb) * (1 - v / top);
  let svg = "";
  for (let v = 0; v <= top; v += stap) {
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="rast"/><text x="${pl - 4}" y="${y(v) + 3}" class="as" text-anchor="end">${v}</text>`;
  }
  const volle = reeks.filter((x) => x.actief && !x.lopend);
  reeks.forEach((x, i) => {
    const cx = pl + bw * i + bw / 2;
    const breed = Math.max(3, bw * 0.68);
    let basis = 0;
    delen.forEach((k, j) => {
      const v = x.t[k];
      if (!v || basis >= top) return;
      const tot = Math.min(top, basis + v);
      svg += `<rect x="${cx - breed / 2}" width="${breed}" y="${y(tot)}" height="${y(basis) - y(tot)}" rx="2" fill="${kleuren[j]}" ${x.lopend ? 'opacity=".45"' : ""}/>`;
      basis = tot;
    });
    if (n <= 14 && waarden[i]) svg += `<text x="${cx}" y="${Math.max(9, y(Math.min(top, waarden[i])) - 3)}" class="waardelabel" text-anchor="middle">${waarden[i]}</text>`;
    if (n <= 14 || i % 5 === (n - 1) % 5) svg += `<text x="${cx}" y="${H - 6}" class="as${x.lopend ? " nu" : ""}" text-anchor="middle">${x.as}</text>`;
  });
  let gemTekst = "";
  if (volle.length) {
    const gem = volle.reduce((s, x) => s + delen.reduce((a, k) => a + x.t[k], 0), 0) / volle.length;
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(gem)}" y2="${y(gem)}" class="gemlijn"/>`;
    gemTekst = `gem. ${Math.round(gem)} ${eenheid}/dag`;
  }
  if (lijn) {
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(lijn.waarde)}" y2="${y(lijn.waarde)}" class="grenslijn"/>
      <text x="${W - pr - 2}" y="${y(lijn.waarde) - 4}" class="grenslabel" text-anchor="end">${lijn.waarde} ${eenheid}</text>`;
  }
  const leg = legenda.map((l, j) => `<span><i style="background:${kleuren[j]}"></i>${l}</span>`).join("");
  el.innerHTML = `<div class="grafiekkop"><h2>${titel}</h2><span class="klein-grijs">${gemTekst}</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titel} per ${reeks.length > 30 ? "week" : "dag"}">${svg}</svg>
    <div class="legenda">${leg}<span><i class="streep"></i>gemiddelde</span>${lijn ? `<span><i class="streep grens"></i>${lijn.uitleg}</span>` : ""}</div>`;
}

function renderOverzicht() {
  if ($("#tab-overzicht").hidden) return;
  renderGisteren();
  for (const b of $$(".periode button")) b.classList.toggle("aan", b.dataset.dagen === String(periode));
  const perWeek = periode === "w";
  const reeks = perWeek ? weekreeks(12) : dagreeks(periode);
  const css = getComputedStyle(document.documentElement);
  const kleur = (v) => css.getPropertyValue(v).trim();
  const per = perWeek ? " (gem. per dag, per week)" : "";
  staafgrafiek($("#g-borst"), { titel: "Borstvoeding" + per, eenheid: "min", reeks, delen: ["L", "R"], kleuren: [kleur("--borst"), kleur("--borst-licht")], legenda: ["links", "rechts"] });
  staafgrafiek($("#g-kunst"), {
    titel: "Kunstvoeding" + per, eenheid: "ml", reeks, delen: ["kunst"], kleuren: [kleur("--kunst")], legenda: ["kunstvoeding"],
    lijn: { waarde: VITK_ML, uitleg: `${VITK_ML} ml (vitamine K-richtlijn)` },
  });
  staafgrafiek($("#g-samen"), { titel: "Kunstvoeding en gekolfd samen" + per, eenheid: "ml", reeks, delen: ["kunst", "kolf"], kleuren: [kleur("--kunst"), kleur("--kolf")], legenda: ["kunstvoeding", "gekolfd"] });
  staafgrafiek($("#g-kolf"), { titel: "Kolfopbrengst" + per, eenheid: "ml", reeks, delen: ["kolfL", "kolfR"], kleuren: [kleur("--kolf"), kleur("--kolf-licht")], legenda: ["links", "rechts"] });

  const rijen = [...reeks].reverse().filter((x) => x.binnen || (x.lopend && !perWeek));
  const som = (k) => rijen.reduce((s, x) => s + x.t[k], 0);
  const volle = rijen.filter((x) => x.actief && !x.lopend);
  const gem = (k) => (volle.length ? Math.round(volle.reduce((s, x) => s + x.t[k], 0) / volle.length) : 0);
  // Moedermelk uit de fles alleen tonen als die in deze periode gegeven is.
  const metFles = som("fles") > 0;
  const tabel = (el, groepen) => {
    const kol = groepen.flatMap((g) => g.kol);
    const cel = (x) => kol.map((k) => `<td class="${k.nadruk ? "sub" : ""}${k.sleutel === "samen" ? " samen" : ""}">${x[k.sleutel] || "·"}</td>`).join("");
    const rij = (label, waarden) => `<tr><th>${label}</th>${cel(waarden)}</tr>`;
    const somRij = Object.fromEntries(kol.map((k) => [k.sleutel, som(k.sleutel)]));
    const gemRij = Object.fromEntries(kol.map((k) => [k.sleutel, gem(k.sleutel)]));
    el.innerHTML = `
      <thead>
        <tr><th></th>${groepen.map((g) => `<th colspan="${g.kol.length}" class="gk ${g.klasse}">${g.titel}</th>`).join("")}</tr>
        <tr><th>${perWeek ? "Week" : "Dag"}</th>${kol.map((k) => `<th>${k.kop}</th>`).join("")}</tr>
      </thead>
      <tbody>${rijen.map((x) => `<tr class="${x.lopend ? "nu" : ""}${perWeek ? "" : " tikbaar"}" data-dag="${x.d}"><th>${x.naam}</th>${cel(x.t)}</tr>`).join("") || `<tr><td colspan="${kol.length + 1}" class="leeg">Nog geen gegevens</td></tr>`}</tbody>
      <tfoot>${perWeek ? "" : rij("Totaal", somRij)}${rij("Gem./dag", gemRij)}</tfoot>`;
  };
  const k = (sleutel, kop, nadruk = false) => ({ sleutel, kop, nadruk });
  $("#tabeltitel").textContent = perWeek ? "Melk per week (gem. per dag)" : "Melk per dag (ml)";
  tabel($("#melktabel"), [
    { titel: "Fles", klasse: "kunst", kol: [k("kunst", "kunst"), ...(metFles ? [k("fles", "mm")] : [])] },
    { titel: "Gekolfd", klasse: "kolf", kol: [k("kolfL", "L"), k("kolfR", "R"), k("kolf", "tot", true)] },
    { titel: "Samen", klasse: "samen", kol: [k("samen", "k+k", true)] },
  ]);
  $("#borsttitel").textContent = perWeek ? "Borstvoeding per week (gem. per dag)" : "Borstvoeding per dag (min)";
  tabel($("#borsttabel"), [
    { titel: "Borst (min)", klasse: "borst", kol: [k("L", "L"), k("R", "R"), k("borst", "tot", true), k("borstKeer", "keer")] },
  ]);
  $("#tabeluitleg").textContent =
    "k+k = kunstvoeding + gekolfd. " + (metFles ? "mm = moedermelk uit de fles. " : "") +
    (perWeek ? "Per week het gemiddelde per dag, over de dagen met registraties; de lopende week telt niet mee in Gem./dag." : "Gemiddelde over dagen met registraties, vandaag telt niet mee.");
}

// Tik op een dag in de tabel: naar die dag in de geschiedenis, om registraties te controleren.
for (const t of ["#melktabel", "#borsttabel"]) {
  $(t).addEventListener("click", (e) => {
    const rij = e.target.closest("tr.tikbaar");
    if (!rij) return;
    const dagen = [...new Set(voedingen.map((v) => dagStart(v.tijd)))];
    const index = dagen.indexOf(Number(rij.dataset.dag));
    if (index < 0) return;
    dagenZichtbaar = Math.max(dagenZichtbaar, index + 1);
    toonTab("registreren");
    renderLijst();
    $(`.dag[data-dag="${rij.dataset.dag}"]`)?.scrollIntoView({ block: "start" });
  });
}

for (const b of $$(".periode button")) {
  b.addEventListener("click", () => {
    periode = b.dataset.dagen === "w" ? "w" : Number(b.dataset.dagen);
    ls.set("periode", periode);
    renderOverzicht();
  });
}

function renderAlles() {
  werkVoorraadBij();
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
  const perKantDuur = "duurL" in v || "duurR" in v;
  $(".b-perkant", dlgBewerk).hidden = !perKantDuur;
  $("#b-duur").closest("label").hidden = perKantDuur;
  $("#b-duurL").value = getal(v.duurL) || "";
  $("#b-duurR").value = getal(v.duurR) || "";
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
      ? {
          ...basis,
          kolfL: getal($("#b-kolfL").value),
          kolfR: getal($("#b-kolfR").value),
          ...("duurL" in oud || "duurR" in oud
            ? { duurL: getal($("#b-duurL").value), duurR: getal($("#b-duurR").value), duur: Math.min(240, getal($("#b-duurL").value) + getal($("#b-duurR").value)) }
            : { duur: getal($("#b-duur").value) }),
        }
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

$("#b-verwijder").addEventListener("click", async () => {
  const id = bewerkId;
  const v = voedingen.find((x) => x.id === id);
  if (!v || (await kies("Deze registratie verwijderen?", [
    { tekst: "Verwijderen", waarde: "ja" },
    { tekst: "Annuleren", waarde: "nee" },
  ])) !== "ja") return;
  bewerkId = null;
  dlgBewerk.close();
  store.remove(id);
  const { id: _, ...kopie } = v;
  toast("Verwijderd", "Ongedaan maken", () => registreer(kopie));
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

$("#i-kopieer").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(gezin);
    toast("Code gekopieerd");
  } catch {
    prompt("Kopieer deze code:", gezin);
  }
});

// Koppelen aan het gezin van de andere telefoon, met de keuze om de eigen registraties mee te nemen.
$("#i-koppel").addEventListener("click", async () => {
  const code = normaliseerCode($("#i-nieuw").value);
  if (!geldigeCode(code)) return toast("Deze link of code klopt niet. Een code is 16 tot 40 letters en cijfers.");
  if (code === gezin) return toast("Deze telefoon is al aan dit gezin gekoppeld.");
  const eigen = voedingen.length;
  let keuze = "nee";
  if (eigen) {
    keuze = await kies(`Op deze telefoon staan ${eigen} registraties. Meenemen naar het gezamenlijke overzicht?`, [
      { tekst: "Meenemen", waarde: "ja" },
      { tekst: "Niet meenemen", waarde: "nee" },
    ]);
    if (!keuze) return;
  }
  if (keuze === "ja") {
    toast("Registraties overzetten...");
    try {
      await store.kopieer(code, voedingen);
    } catch (e) {
      console.error(e);
      return toast("Overzetten lukte niet. Controleer de verbinding en probeer het opnieuw.");
    }
  }
  ls.set("gezin", code);
  dlgInst.close();
  location.replace(`${location.pathname}?gezin=${code}`);
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
  // De code blijft in de adresbalk staan: zet iemand de app via Safari op het beginscherm,
  // dan neemt iOS dit adres mee en is de app daar meteen gekoppeld.
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
  const wacht = meta?.wachtend || meta?.uitCache || !navigator.onLine;
  el.className = "sync " + (wacht ? "wacht" : "ok");
  el.title = wacht ? "Nog niet gesynchroniseerd: wacht op verbinding" : "Gesynchroniseerd";
}

// ---------- opstarten ----------
async function start() {
  const urlCode = codeUitUrl();
  const nieuwGekoppeld = urlCode && urlCode !== gezin;
  if (urlCode) {
    gezin = urlCode;
    ls.set("gezin", gezin);
  }
  if (!isGedeeld()) {
    gezin = gezin || "lokaal";
    $("#melding-lokaal").hidden = false;
  }
  if (!naam || !gezin) await eersteKeer();
  if (nieuwGekoppeld && naam) toast("Gekoppeld aan jullie gezin");

  toonModus(kolfLoopt() && !borstLoopt() ? "kolven" : borstLoopt() ? "borst" : modus);
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
  // Registraties van voor de database klaar was alsnog wegschrijven.
  for (const { id, v } of wachtrij.splice(0)) store.add(v, id);
  // Timeracties van voor de database klaar was alsnog delen, vóór we gaan luisteren.
  if (nogTeDelen.size) {
    store.zetTimer?.({ ...Object.fromEntries([...nogTeDelen].map((k) => [k, timer[k]])), ...sessieVoorWachtrij }, naam || "");
    nogTeDelen.clear();
    sessieVoorWachtrij = null;
  }
  // De servertoestand is leidend zodra er geen eigen wijziging meer onderweg is.
  store.volgTimer?.((extern) => {
    const had = { borst: borstGebruikt(), kolf: kolfGebruikt() };
    timer = { ...leegTimer(), ...alleenTimervelden(extern) };
    gedeeld = structuredClone(timer);
    if (extern.door && extern.door !== naam) {
      if (had.borst && !borstGebruikt()) toast(`${extern.door} heeft de borstvoeding opgeslagen of gewist`);
      else if (had.kolf && !kolfGebruikt()) toast(`${extern.door} heeft het kolven opgeslagen of gewist`);
    }
    ls.set("timers", timer);
    zetTijden();
    werkTimersBij();
  });
  window.addEventListener("online", () => zetSync(laatsteMeta));
  window.addEventListener("offline", () => zetSync(laatsteMeta));
  window.addEventListener("timerverouderd", () => toast("Deze telefoon liep achter. De actuele timerstand is teruggehaald."));
  window.addEventListener("alopgeslagen", () => toast("Deze sessie was al opgeslagen op de andere telefoon."));
  window.addEventListener("opslagfout", (e) => {
    const { fout, doc, id } = e.detail || {};
    if (doc) toast("Opslaan mislukt: " + (fout?.code || "onbekende fout"), "Opnieuw", () => store.add(doc, id));
    else toast("Opslaan mislukt: " + (fout?.code || "onbekende fout"));
  });

  setInterval(() => {
    if (borstLoopt() || kolfLoopt()) werkTimersBij();
  }, 1000);
  let dag = dagStart(Date.now());
  setInterval(() => {
    // Na middernacht de dagtotalen en het overzicht opnieuw opbouwen.
    if (dagStart(Date.now()) !== dag) {
      dag = dagStart(Date.now());
      renderAlles();
    }
    renderLaatste();
    zetTijden();
  }, 30000);
  let verborgenSinds = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return void (verborgenSinds = Date.now());
    // Na een tijd weg: een eerder handmatig ingevulde tijd niet laten staan.
    if (verborgenSinds && Date.now() - verborgenSinds > 10 * 60000) {
      for (const f of Object.values(formulieren)) f.handmatig = false;
    }
    zetTijden();
    werkTimersBij();
    renderAlles();
  });
}

start();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
