import { maakStore, isGedeeld, isKapot } from "./store.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const PRESETS = { kolf: [35, 70, 105, 140], kunst: [35, 70, 105, 140], kolfL: [20, 40, 60], kolfR: [20, 40, 60] };
const DAGEN_ZICHTBAAR_START = 7;
const DAG = 864e5;
const APP_VERSIE = "39";

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
const isLuier = (v) => v.type === "luier";
const isSlaap = (v) => v.type === "slaap";
const isMeting = (v) => v.type === "meting";
const isHapje = (v) => v.type === "hapje";
// Een voeding: borst en/of fles (oude registraties hebben geen type).
const isVoeding = (v) => !v.type || v.type === "voeding";
const slaapDuur = (v) => (v.eind || Date.now()) - v.tijd;
const REACTIES = { goed: "lekker", matig: "zo zo", niet: "wilde niet", allergie: "reactie" };
const luierTekst = (v) => (v.nat && v.poep ? "nat + poep" : v.nat ? "nat" : v.poep ? "poep" : "droog");

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

// Eén registratie als korte regel: wat was het en hoeveel, met alleen de nodige uitsplitsing.
function regels(v) {
  if (isLuier(v)) return [{ soort: "luier", wat: "Luier", hoeveel: luierTekst(v), detail: v.opmerking || "" }];
  if (isSlaap(v)) return [{ soort: "slaap", wat: "Slaap", hoeveel: v.eind ? duurTekst(slaapDuur(v)) : "", detail: v.eind ? `tot ${uurMin(v.eind)}` : "slaapt nog" }];
  if (isMeting(v)) return [{ soort: "meting", wat: "Meting", hoeveel: [v.gewicht && `${(v.gewicht / 1000).toFixed(2).replace(".", ",")} kg`, v.lengte && `${(v.lengte / 10).toFixed(1).replace(".", ",")} cm`].filter(Boolean).join(" · "), detail: "" }];
  if (isHapje(v)) return [{ soort: "hapje", wat: "Hapje", hoeveel: v.wat, detail: REACTIES[v.reactie] || "" }];
  if (isKolven(v)) {
    const L = getal(v.kolfL);
    const R = getal(v.kolfR);
    const perKantDuur = "duurL" in v || "duurR" in v;
    const kant = perKantDuur
      ? `L ${L} (${getal(v.duurL)}m) · R ${R} (${getal(v.duurR)}m)`
      : `L ${L} · R ${R}${getal(v.duur) ? ` · ${getal(v.duur)} min` : ""}`;
    return [{ soort: "kolven", wat: "Gekolfd", hoeveel: `${L + R} ml`, detail: kant }];
  }
  const uit = [];
  const kunst = getal(v.kunst);
  const mm = getal(v.kolf);
  if (kunst && mm) uit.push({ soort: "fles", wat: "Fles", hoeveel: `${kunst + mm} ml`, detail: `${kunst} kunstvoeding + ${mm} moedermelk` });
  else if (kunst) uit.push({ soort: "fles", wat: "Kunstvoeding", hoeveel: `${kunst} ml`, detail: "" });
  else if (mm) uit.push({ soort: "mm", wat: "Moedermelk", hoeveel: `${mm} ml`, detail: "" });
  const L = getal(v.borstL);
  const R = getal(v.borstR);
  if (L || R || v.eindKant) {
    uit.push({
      soort: "borst",
      wat: "Borst",
      hoeveel: L || R ? `${L + R} min` : "",
      detail: [L && `L ${L}`, R && `R ${R}`, v.eindKant && `laatst ${v.eindKant === "L" ? "links" : "rechts"}`].filter(Boolean).join(" · "),
    });
  }
  return uit;
}

function totalen(lijst) {
  const t = { L: 0, R: 0, fles: 0, kunst: 0, kolfL: 0, kolfR: 0, kolfDuur: 0, voedingen: 0, kolfsessies: 0, borstKeer: 0, flessen: 0, samen: 0, aantal: 0, luiers: 0, nat: 0, poep: 0, natAlleen: 0, droog: 0, slaapMin: 0, dutjes: 0, langsteSlaap: 0, slaapUur: 0 };
  for (const v of lijst) {
    if (isSlaap(v)) {
      // Slaap telt bij de dag waarop hij begon; een lopende slaap telt tot nu.
      const min = Math.round(slaapDuur(v) / 60000);
      t.slaapMin += min;
      t.dutjes++;
      t.langsteSlaap = Math.max(t.langsteSlaap, min);
      continue;
    }
    if (isMeting(v) || isHapje(v)) continue;
    if (isLuier(v)) {
      t.luiers++;
      if (v.nat) t.nat++;
      if (v.poep) t.poep++;
      if (v.nat && !v.poep) t.natAlleen++;
      if (!v.nat && !v.poep) t.droog++;
      continue;
    }
    t.aantal++;
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
      if (getal(v.kolf) || getal(v.kunst)) t.flessen++;
      t.voedingen++;
    }
  }
  t.borst = t.L + t.R;
  t.kolf = t.kolfL + t.kolfR;
  t.samen = t.kunst + t.kolf;
  t.slaapUur = Math.round(t.slaapMin / 6) / 10;
  return t;
}

// Voedmomenten: borst en fles vlak na elkaar (binnen 45 minuten) zijn samen één voeding.
function voedmomenten(lijst) {
  const momenten = [];
  for (const v of lijst.filter(isVoeding).sort((a, b) => a.tijd - b.tijd)) {
    const vorig = momenten[momenten.length - 1];
    if (vorig && v.tijd - vorig.tijd <= 45 * 60000) vorig.items.push(v);
    else momenten.push({ tijd: v.tijd, items: [v] });
  }
  return momenten;
}
const tussenpozen = (momenten) => momenten.slice(1).map((m, i) => ({ van: momenten[i].tijd, tot: m.tijd, duur: m.tijd - momenten[i].tijd }));
// Pauzes tussen voedingen die eindigen tussen van en tot. De pauze vanaf de laatste voeding
// van de dag ervoor telt mee (de nacht). Langer dan 12 uur is vrijwel zeker een vergeten
// registratie en telt niet mee.
const MAX_PAUZE = 12 * 36e5;
function pauzesIn(van, tot) {
  const momenten = voedmomenten(voedingen.filter((v) => v.tijd >= van - MAX_PAUZE && v.tijd < tot));
  return tussenpozen(momenten).filter((p) => p.tot >= van && p.duur <= MAX_PAUZE);
}
function pauzeStats(pauzes) {
  if (!pauzes.length) return null;
  const duren = pauzes.map((p) => p.duur);
  return {
    gem: duren.reduce((s, d) => s + d, 0) / duren.length,
    min: pauzes.reduce((x, p) => (p.duur < x.duur ? p : x)),
    max: pauzes.reduce((x, p) => (p.duur > x.duur ? p : x)),
    n: pauzes.length,
  };
}
const uurKort = (ms) => {
  const min = Math.round(ms / 60000);
  return `${Math.floor(min / 60)}:${pad(min % 60)}`;
};
function duurTekst(ms) {
  const min = Math.round(ms / 60000);
  const u = Math.floor(min / 60);
  return u ? `${u} u ${pad(min % 60)}` : `${min} min`;
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
// uit de fles gegeven is, oudste melk eerst. De ouder kiest zelf welke portie(s) hij geeft.
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
        if (!n) break;
        const deel = Math.min(p.rest, n);
        p.rest -= deel;
        n -= deel;
      }
    }
  }
  return partijen.filter((p) => p.rest > 0);
}
function werkVoorraadBij() {
  // Is er gekolfde melk klaar, dan staan de porties als snelkeuze bij moedermelk
  // (in plaats van de vaste hoeveelheden).
  const vak = $("#voorraad");
  const vast = $('.soort[data-soort="kolf"] .chips');
  const lijst = voorraad();
  vak.hidden = !lijst.length;
  vast.hidden = Boolean(lijst.length);
  $("#voorraad-kop").textContent = "";
  if (!lijst.length) return;
  const totaal = lijst.reduce((s, p) => s + p.rest, 0);
  $("#voorraad-kop").textContent = `gekolfd klaar: ${totaal} ml`;
  const wanneer = (p) => (dagLabel(p.tijd) === "Vandaag" ? uurMin(p.tijd) : `${dagLabel(p.tijd) === "Gisteren" ? "gist." : dagLabel(p.tijd).toLowerCase()} ${uurMin(p.tijd)}`);
  const knop = (ml, tekst) => `<button type="button" class="pil" data-ml="${ml}">${tekst}</button>`;
  const knoppen = lijst.map((p) => knop(p.rest, `${wanneer(p)} · <b>${p.rest}</b>`));
  if (lijst.length > 1) knoppen.push(knop(totaal, `Alles · <b>${totaal}</b>`));
  vak.innerHTML = knoppen.join("");
  const gekozen = waardeVan("kolf");
  for (const b of $$("button", vak)) b.classList.toggle("gekozen", Number(b.dataset.ml) === gekozen);
}
$("#voorraad").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-ml]");
  if (!b) return;
  $("#kolf").value = Math.min(1000, Number(b.dataset.ml));
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
let kind = ls.get("kind", {});  // { kind, geboortedatum }, gedeeld via de database

// ---------- onderdelen aan/uit (per telefoon) ----------
// Wat je niet bijhoudt, verdwijnt uit beeld; eerdere registraties blijven gewoon bestaan.
const ONDERDELEN = ["fles", "luiers", "borst", "kolven", "slaap", "hapjes"];
// Hapjes staan standaard uit: die komen pas na een maand of 4 tot 6.
let aanUit = { ...Object.fromEntries(ONDERDELEN.map((o) => [o, o !== "hapjes"])), ...ls.get("onderdelen", {}) };
const heeft = (o) => aanUit[o] !== false;
// De fles is er voor kunstvoeding en voor gekolfde moedermelk.
const modusAan = (m) => (m === "fles" ? heeft("fles") || heeft("kolven") : heeft(m));
const MODI = ["fles", "kolven", "borst"];

// ---------- het kind: naam, geboortedatum, leeftijd ----------
const geboren = () => (kind.geboortedatum ? dagStart(new Date(kind.geboortedatum + "T12:00:00").getTime()) : null);
const kindNaam = () => kind.kind || "";
// Leeftijd in hele maanden en dagen (kalendermaanden, zoals het consultatiebureau rekent).
function leeftijd(op = Date.now()) {
  const g = geboren();
  if (!g || op < g) return null;
  const a = new Date(g), b = new Date(dagStart(op));
  let maanden = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
  let anker = new Date(a); anker.setMonth(a.getMonth() + maanden);
  if (anker > b) { maanden--; anker = new Date(a); anker.setMonth(a.getMonth() + maanden); }
  const dagen = Math.round((b - anker) / DAG);
  const weken = Math.floor((b - a) / DAG / 7);
  return { maanden, dagen, weken, dagenTotaal: Math.round((b - a) / DAG) };
}
function leeftijdTekst() {
  const l = leeftijd();
  if (!l) return "";
  if (l.dagenTotaal < 14) return `${l.dagenTotaal} dag${l.dagenTotaal === 1 ? "" : "en"}`;
  if (l.maanden < 3) return `${l.weken} weken`;
  if (l.maanden >= 12 && l.maanden % 12 === 0 && l.dagen === 0) return `${l.maanden / 12} jaar`;
  if (l.maanden < 24) return `${l.maanden} maand${l.maanden === 1 ? "" : "en"}${l.dagen ? ` en ${l.dagen} dag${l.dagen === 1 ? "" : "en"}` : ""}`;
  return `${Math.floor(l.maanden / 12)} jaar${l.maanden % 12 ? ` en ${l.maanden % 12} maand${l.maanden % 12 === 1 ? "" : "en"}` : ""}`;
}
// Vandaag jarig (maand of jaar)?
function verjaardagVandaag() {
  const l = leeftijd();
  if (!l || l.dagen !== 0 || l.maanden === 0) return null;
  return l.maanden % 12 === 0 ? { jaar: l.maanden / 12 } : { maanden: l.maanden };
}
function renderKind() {
  $("#leeftijd").textContent = [kindNaam(), leeftijdTekst()].filter(Boolean).join(" · ");
}

// ---------- thema (per telefoon) ----------
// "Auto" kiest het thema bij de tijd van het jaar. Een nieuw thema: een blok in styles.css
// (body[data-thema="..."]), een periode hieronder en een knop in Instellingen.
// Paaszondag (Gregoriaans, algoritme van Meeus).
function paaszondag(jaar) {
  const a = jaar % 19, b = Math.floor(jaar / 100), c = jaar % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const maand = Math.floor((h + l - 7 * m + 114) / 31), dag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jaar, maand - 1, dag);
}
const SEIZOENEN = [
  { thema: "halloween", naam: "Halloween", van: [10, 10], tot: [11, 1], uitleg: "10 oktober tot en met 1 november" },
  { thema: "sinterklaas", naam: "Sinterklaas", van: [11, 12], tot: [12, 5], uitleg: "12 november tot en met 5 december" },
  { thema: "kerst", naam: "Kerst", van: [12, 6], tot: [1, 6], uitleg: "6 december tot en met 6 januari" },
  // Pasen: van Witte Donderdag tot en met Tweede Paasdag (datum verschilt per jaar).
  { thema: "pasen", naam: "Pasen", periode: (d) => { const p = paaszondag(d.getFullYear()); return [plusDagen(p.getTime(), -3), plusDagen(p.getTime(), 1)]; }, uitleg: "van Witte Donderdag tot en met Tweede Paasdag" },
  { thema: "zomer", naam: "Zomer", van: [6, 21], tot: [8, 31], uitleg: "21 juni tot en met 31 augustus" },
  // Herfst vult de gaten rond Halloween en Sinterklaas (die gaan voor).
  { thema: "herfst", naam: "Herfst", van: [9, 21], tot: [12, 5], uitleg: "21 september tot en met 5 december, buiten Halloween en Sinterklaas" },
  { thema: "lente", naam: "Lente", van: [3, 21], tot: [6, 20], uitleg: "21 maart tot en met 20 juni, buiten Pasen" },
  { thema: "winter", naam: "Winter", van: [12, 21], tot: [3, 20], uitleg: "21 december tot en met 20 maart, buiten kerst" },
];
const STATUSBALK = {
  "": ["#fbf7f4", "#1a1716"], halloween: ["#fbf0e4", "#16111b"], kerst: ["#f6f3ec", "#0f1a16"], sinterklaas: ["#fdf2f2", "#1c1214"],
  pasen: ["#f7fbef", "#141a10"], zomer: ["#f3f9fc", "#0f1a20"], verjaardag: ["#fbf3f8", "#1c1220"], herfst: ["#faf4ec", "#1a1410"],
  lente: ["#f4fbf2", "#101a12"], winter: ["#f1f6fb", "#0e1620"],
};
// Welk moment hoort bij het thema: iets dat voorbijvliegt (met klappende vleugels) of iets dat valt.
const MOMENT = { halloween: "vlieg", kerst: "val", sinterklaas: "val", pasen: "val", zomer: "vlieg", verjaardag: "val", herfst: "val", lente: "vlieg", winter: "val" };
function seizoensThema(d = new Date()) {
  // Verjaardag van het kind (vanaf 1 jaar) gaat voor.
  const j = verjaardagVandaag();
  if (j?.jaar) return "verjaardag";
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  for (const s of SEIZOENEN) {
    if (s.periode) {
      const [van, tot] = s.periode(d);
      if (dagStart(d.getTime()) >= van && dagStart(d.getTime()) <= tot) return s.thema;
      continue;
    }
    const van = s.van[0] * 100 + s.van[1];
    const tot = s.tot[0] * 100 + s.tot[1];
    // Een periode over de jaarwisseling heen (kerst) loopt door tot in januari.
    if (van <= tot ? md >= van && md <= tot : md >= van || md <= tot) return s.thema;
  }
  return "";
}
// Standaard "Auto": in het seizoen vanzelf het passende thema. Wie zelf iets kiest, houdt dat.
let themaKeuze = ls.get("themaKeuze", "auto");
const actiefThema = () => (themaKeuze === "auto" ? seizoensThema() : themaKeuze === "gewoon" ? "" : themaKeuze);
function pasThemaToe(metMoment = false) {
  const t = actiefThema();
  if ((document.body.dataset.thema || "") !== t) {
    // Ander thema: het vorige moment opruimen, zodat het nieuwe meteen te zien is.
    $(".themamoment")?.remove();
    laatsteMoment = 0;
    if (t) document.body.dataset.thema = t;
    else delete document.body.dataset.thema;
  } else if (!metMoment) return;
  for (const m of $$('meta[name="theme-color"]')) m.content = STATUSBALK[t][m.media.includes("dark") || document.body.classList.contains("nacht") ? 1 : 0];
  // Alleen als het thema intussen niet is gewisseld.
  if (t && metMoment) setTimeout(() => document.body.dataset.thema === t && themaMoment(t), 600);
}
// Even iets in beeld bij het openen: vleermuizen vliegen voorbij, of sneeuw dwarrelt.
let laatsteMoment = 0;
function themaMoment(t) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || $(".themamoment") || Date.now() - laatsteMoment < 15000) return;
  laatsteMoment = Date.now();
  const vak = document.createElement("div");
  vak.className = "themamoment";
  vak.setAttribute("aria-hidden", "true");
  if (MOMENT[t] === "val") {
    for (let i = 0; i < 16; i++) {
      const v = document.createElement("i");
      v.className = "val";
      const maat = 8 + Math.random() * 8;
      Object.assign(v.style, { left: `${Math.random() * 95}%`, width: `${maat}px`, height: `${maat}px`, animationDelay: `${Math.random() * 2.5}s`, animationDuration: `${5 + Math.random() * 3}s` });
      vak.append(v);
    }
  } else {
    for (const [vertraging, schaal, hoogte] of [[0, 1, 90], [0.9, 0.7, 130]]) {
      const v = document.createElement("i");
      v.className = "vlieg";
      // Lijf met twee vleugels die klappen; de tweede vleermuis klapt net iets anders.
      v.innerHTML = `<b class="vl"></b><b class="lijf"></b><b class="vl vr"></b>`;
      for (const w of v.querySelectorAll(".vl")) w.style.animationDuration = `${0.38 + vertraging * 0.06}s`;
      Object.assign(v.style, { animationDelay: `${vertraging}s`, top: `${hoogte}px`, scale: String(schaal) });
      vak.append(v);
    }
  }
  document.body.append(vak);
  setTimeout(() => vak.remove(), 11000);
}
pasThemaToe(true);

// ---------- tabbladen en modus ----------
function toonTab(tab) {
  for (const b of $$(".tabbar button")) b.classList.toggle("aan", b.dataset.tab === tab);
  $("#tab-registreren").hidden = tab !== "registreren";
  $("#tab-overzicht").hidden = tab !== "overzicht";
  if (tab === "overzicht") renderOverzicht();
  window.scrollTo(0, 0);
  if (document.body.dataset.thema) themaMoment(document.body.dataset.thema);
}
for (const b of $$(".tabbar button")) b.addEventListener("click", () => toonTab(b.dataset.tab));

// Drie modi: borst en fles delen één formulier, kolven heeft een eigen formulier.
let modus = ["borst", "fles", "kolven"].includes(ls.get("modus")) ? ls.get("modus") : "borst";
function toonModus(m) {
  if (!modusAan(m)) m = MODI.find(modusAan) || m;
  const geen = !MODI.some(modusAan);
  modus = m;
  ls.set("modus", m);
  for (const b of $$(".modus button")) {
    b.classList.toggle("aan", b.dataset.modus === m);
    b.setAttribute("aria-selected", b.dataset.modus === m);
  }
  $("#invoer").hidden = geen || m === "kolven";
  $("#kolfinvoer").hidden = geen || m !== "kolven";
  $(".deel-borst").hidden = m !== "borst";
  $(".deel-fles").hidden = m !== "fles";
  $("#invoer .opslaan").textContent = m === "fles" ? "Fles opslaan" : "Borstvoeding opslaan";
  document.body.dataset.modus = m;
  if (m === "fles" && typeof werkVoorraadBij === "function" && store) werkVoorraadBij();
  if (typeof zetTijden === "function") zetTijden();
  werkTimersBij();
}
for (const b of $$(".modus button")) b.addEventListener("click", () => toonModus(b.dataset.modus));

function pasOnderdelenToe() {
  for (const o of ONDERDELEN) document.body.classList.toggle("zonder-" + o, !heeft(o));
  for (const b of $$(".modus button")) b.hidden = !modusAan(b.dataset.modus);
  $(".modus").hidden = MODI.filter(modusAan).length < 2;
  $("#melksectie").hidden = !modusAan("fles");
  $("#groei").hidden = oppas;
  $(".deelkaart").hidden = oppas;
  $(".laatste .labeltekst").textContent = MODI.some(modusAan) ? "Laatste voeding" : "Laatste luier";
  toonModus(modus);
}

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
    timer[k].start = Date.now();
    timer.kGepauzeerd = null;
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
  const andere = modus !== "kolven" && kolfLoopt() && heeft("kolven") ? "kolven" : modus !== "borst" && borstLoopt() && heeft("borst") ? "borst" : null;
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
  $("#wekker-uitleg").hidden = !wekkerMin;
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
  for (const b of $$("#voorraad button")) b.classList.toggle("gekozen", Number(b.dataset.ml) === waardeVan("kolf"));
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
const soortVan = (v) => (v.type && v.type !== "voeding" ? v.type : getal(v.borstL) || getal(v.borstR) || v.eindKant ? "borst" : "fles");
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

// ---------- oppasstand ----------
// Alleen vandaag en registreren; geen instellingen om te koppelen. Het is een weergave, geen slot:
// wie de link heeft, kent de gezinscode.
let oppas = ls.get("oppas", false) === true;
if (new URLSearchParams(location.search).get("oppas") === "1") {
  oppas = true;
  ls.set("oppas", true);
}
function pasOppasToe() {
  document.body.classList.toggle("oppas", oppas);
  $("#oppas-melding").hidden = !oppas;
}
$("#oppas-uit").addEventListener("click", () => {
  oppas = false;
  ls.set("oppas", false);
  pasOppasToe();
  renderAlles();
});

// ---------- nachtstand ----------
// Tussen 22 en 7 uur een donker, rustig scherm met grotere knoppen. Uit te zetten in Instellingen.
let nachtAan = ls.get("nachtstand", true) !== false;
const isNacht = () => nachtAan && (new Date().getHours() >= 22 || new Date().getHours() < 7);
function pasNachtToe() {
  const nu = isNacht();
  if (document.body.classList.contains("nacht") === nu) return;
  document.body.classList.toggle("nacht", nu);
  pasThemaToe();
}

// Mijlpalen: één keer per telefoon een feestje, met confetti.
const MIJLPALEN_FLES = [50, 100, 250, 500, 1000, 2000];
const MIJLPALEN_LUIER = [100, 250, 500, 1000, 2000, 3000];
let feestWachtrij = [];
function mijlpalen() {
  const gezien = new Set(ls.get("mijlpalenGezien", []));
  const nieuw = [];
  const kandidaat = (sleutel, tekst) => { if (!gezien.has(sleutel)) nieuw.push({ sleutel, tekst }); };
  const naam = kindNaam();
  const wie = naam || "jullie kleintje";
  if (heeft("fles")) {
    const flessen = voedingen.filter((v) => isVoeding(v) && (getal(v.kunst) || getal(v.kolf))).length;
    for (const m of MIJLPALEN_FLES) if (flessen >= m) kandidaat(`fles${m}`, `De ${m}e fles voor ${wie}!`);
  }
  if (heeft("luiers")) {
    const luiers = voedingen.filter(isLuier).length;
    for (const m of MIJLPALEN_LUIER) if (luiers >= m) kandidaat(`luier${m}`, `Luier nummer ${m}. Goed bezig!`);
  }
  if (MODI.some(modusAan)) {
    const pauzes = tussenpozen(voedmomenten(voedingen.filter(isVoeding)));
    for (const [uren, tekst] of [[6, "Eerste keer 6 uur aan één stuk 's nachts"], [8, "Eerste keer 8 uur aan één stuk 's nachts"]]) {
      const p = pauzes.find((x) => x.duur >= uren * 36e5 && x.duur <= MAX_PAUZE && new Date(x.tot).getHours() < 12);
      if (p) kandidaat(`nacht${uren}`, `${tekst}: van ${uurMin(p.van)} tot ${uurMin(p.tot)}!`);
    }
  }
  const j = verjaardagVandaag();
  if (j) {
    kandidaat(`jarig${leeftijd().maanden}`, j.jaar ? `${naam || "Jullie kleintje"} is vandaag ${j.jaar} jaar!` : `${naam || "Jullie kleintje"} is vandaag ${j.maanden} maand${j.maanden === 1 ? "" : "en"}!`);
  }
  // Oude mijlpalen die al bereikt waren bij de allereerste keer: stil markeren, niet allemaal vieren.
  return nieuw;
}
function toonFeest() {
  if ($("#feest").hidden === false || oppas) return;
  if (!feestWachtrij.length) feestWachtrij = mijlpalen();
  const f = feestWachtrij.shift();
  if (!f) return;
  const gezien = ls.get("mijlpalenGezien", []);
  // De eerste keer dat de app mijlpalen kent: alles tot nu toe als gezien markeren, behalve
  // een verjaardag van vandaag; anders komen alle oude feestjes in één keer.
  if (!ls.get("mijlpalenStart")) {
    ls.set("mijlpalenStart", Date.now());
    ls.set("mijlpalenGezien", [...gezien, ...mijlpalen().filter((m) => !m.sleutel.startsWith("jarig")).map((m) => m.sleutel)]);
    feestWachtrij = [];
    if (!f.sleutel.startsWith("jarig")) return;
  }
  ls.set("mijlpalenGezien", [...ls.get("mijlpalenGezien", []), f.sleutel]);
  $("#feest-tekst").textContent = f.tekst;
  $("#feest").hidden = false;
  confetti();
}
$("#feest-ok").addEventListener("click", () => {
  $("#feest").hidden = true;
  setTimeout(toonFeest, 400);
});
function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || $(".confetti")) return;
  const vak = document.createElement("div");
  vak.className = "themamoment confetti";
  vak.setAttribute("aria-hidden", "true");
  const kleuren = ["#f97316", "#2563eb", "#db2777", "#16a34a", "#facc15", "#7c3aed"];
  for (let i = 0; i < 40; i++) {
    const v = document.createElement("i");
    v.className = "val snipper";
    Object.assign(v.style, { left: `${Math.random() * 100}%`, background: kleuren[i % kleuren.length], animationDelay: `${Math.random() * 1.5}s`, animationDuration: `${3 + Math.random() * 2}s`, rotate: `${Math.random() * 360}deg` });
    vak.append(v);
  }
  document.body.append(vak);
  setTimeout(() => vak.remove(), 7000);
}

// ---------- slaap ----------
const lopendeSlaap = () => voedingen.find((v) => isSlaap(v) && !v.eind);
$("#slaap-knop").addEventListener("click", async () => {
  const s = lopendeSlaap();
  if (!s) {
    const id = registreer({ type: "slaap", tijd: Date.now(), eind: null, door: naam || "" });
    navigator.vibrate?.(30);
    toast("Slaapt", "Ongedaan maken", () => verwijder(id));
    return;
  }
  const duur = slaapDuur(s);
  if (duur > 16 * 36e5) {
    // Waarschijnlijk vergeten te stoppen.
    const keuze = await kies(`Deze slaap begon ${dagLabel(s.tijd).toLowerCase()} om ${uurMin(s.tijd)}, dat is ${duurTekst(duur)} geleden. Klopt dat?`, [
      { tekst: "Klopt, nu wakker", waarde: "ja" },
      { tekst: "Nee, verwijderen", waarde: "weg" },
    ]);
    if (keuze === "weg") return verwijder(s.id);
    if (keuze !== "ja") return;
  }
  const eind = Math.min(Date.now(), s.tijd + 24 * 36e5);
  store.update(s.id, { eind });
  navigator.vibrate?.(30);
  toast(`Wakker na ${duurTekst(eind - s.tijd)}`, "Ongedaan maken", () => store.update(s.id, { eind: null }));
});
function renderSlaap() {
  const s = lopendeSlaap();
  const knop = $("#slaap-knop");
  knop.textContent = s ? "Wakker" : "Slaapt nu";
  knop.classList.toggle("actief", Boolean(s));
  $("#slaap-status").textContent = s ? `slaapt ${duurTekst(slaapDuur(s))}${s.door && s.door !== naam ? ` (${s.door})` : ""}` : "";
  const laatste = voedingen.find((v) => isSlaap(v) && v.eind);
  $("#laatste-slaap").textContent = s ? `sinds ${uurMin(s.tijd)}` : laatste ? `laatste ${uurMin(laatste.tijd)} tot ${uurMin(laatste.eind)}, ${duurTekst(slaapDuur(laatste))}` : "";
}

// ---------- eerste hapjes ----------
let reactie = "goed";
for (const b of $$(".reactiekeuze button")) {
  b.addEventListener("click", () => {
    reactie = b.dataset.reactie;
    for (const x of $$(".reactiekeuze button")) x.classList.toggle("aan", x === b);
  });
}
$("#hapje-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const wat = $("#hapje-wat").value.trim().slice(0, 40);
  if (!wat) return $("#hapje-wat").focus();
  const id = registreer({ type: "hapje", tijd: Date.now(), wat, reactie, door: naam || "" });
  $("#hapje-wat").value = "";
  $("#hapje-wat").blur();
  navigator.vibrate?.(30);
  toast(`Hapje opgeslagen: ${wat}`, "Ongedaan maken", () => verwijder(id));
});
let altijd = [];  // metingen en hapjes, ook van langer geleden
const alleMetingen = () => [...new Map([...voedingen, ...altijd].filter(isMeting).map((v) => [v.id, v])).values()].sort((a, b) => a.tijd - b.tijd);
const alleHapjes = () => [...new Map([...voedingen, ...altijd].filter(isHapje).map((v) => [v.id, v])).values()].sort((a, b) => b.tijd - a.tijd);
function renderHapjes() {
  const lijst = alleHapjes();
  $("#hapjes-aantal").textContent = lijst.length ? (() => { const n = new Set(lijst.map((h) => h.wat.toLowerCase())).size; return `${n} ding${n === 1 ? "" : "en"} geproefd`; })() : "";
  const el = $("#hapjes-overzicht");
  if (!lijst.length) {
    el.innerHTML = `<h2>Eerste hapjes</h2><p class="klein-grijs">Nog niets geproefd. Registreer een hapje bij Registreren.</p>`;
    return;
  }
  // Per gerecht: eerste keer, aantal keer, laatste reactie.
  const per = new Map();
  for (const h of [...lijst].reverse()) {
    const k = h.wat.toLowerCase();
    if (!per.has(k)) per.set(k, { wat: h.wat, eerste: h.tijd, keer: 0, reacties: [] });
    const p = per.get(k);
    p.keer++;
    p.reacties.push(h.reactie);
  }
  const rijen = [...per.values()].sort((a, b) => b.eerste - a.eerste);
  el.innerHTML = `<h2>Eerste hapjes</h2>
    <div class="tabelrol"><table class="dagtabel hapjestabel">
      <thead><tr><th>Wat</th><th>eerste keer</th><th>keer</th><th>laatste reactie</th></tr></thead>
      <tbody>${rijen.map((p) => `<tr class="${p.reacties.at(-1) === "allergie" ? "let" : ""}"><th>${esc(p.wat)}</th><td>${new Date(p.eerste).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</td><td>${p.keer}</td><td>${REACTIES[p.reacties.at(-1)] || ""}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="klein-grijs">Tip van het consultatiebureau: één nieuw ding tegelijk, en een paar dagen aanhouden.</p>`;
}

// ---------- groei: gewicht en lengte ----------
const dlgMeting = $("#dlg-meting");
function renderGroei() {
  const el = $("#groei");
  const lijst = alleMetingen();
  const g = geboren();
  const knop = `<button type="button" id="meting-toevoegen" class="secundair breed">Meting toevoegen</button>`;
  if (!lijst.length) {
    el.innerHTML = `<h2>Groei</h2><p class="klein-grijs">Vul na elk bezoek aan het consultatiebureau het gewicht en de lengte in. Dan zie je hier de groei en de toename per week.</p>${knop}`;
    return;
  }
  const metG = lijst.filter((m) => m.gewicht);
  const laatste = metG.at(-1);
  const vorige = metG.at(-2);
  let toename = "";
  if (laatste && vorige && laatste.tijd > vorige.tijd) {
    const perWeek = Math.round(((laatste.gewicht - vorige.gewicht) / ((laatste.tijd - vorige.tijd) / DAG)) * 7);
    toename = `<small>${perWeek >= 0 ? "+" : ""}${perWeek} g per week sinds ${new Date(vorige.tijd).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</small>`;
  }
  const kg = (gr) => (gr / 1000).toFixed(2).replace(".", ",");
  const laatsteL = lijst.filter((m) => m.lengte).at(-1);
  // Grafiek: gewicht tegen leeftijd (of datum als de geboortedatum ontbreekt).
  const W = 340, H = 170, pl = 40, pb = 20, pt = 10, pr = 8;
  const xs = metG.map((m) => (g ? (m.tijd - g) / DAG / 7 : (m.tijd - metG[0].tijd) / DAG / 7));
  const maxX = Math.max(4, Math.ceil(Math.max(...xs) / 4) * 4);
  const minY = Math.floor(Math.min(...metG.map((m) => m.gewicht)) / 500) * 500;
  const maxY = Math.ceil(Math.max(...metG.map((m) => m.gewicht)) / 500) * 500 + 500;
  const x = (w) => pl + (w / maxX) * (W - pl - pr);
  const y = (gr) => pt + (H - pt - pb) * (1 - (gr - minY) / (maxY - minY));
  let svg = "";
  for (let v = minY; v <= maxY; v += 500) svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="rast"/><text x="${pl - 4}" y="${y(v) + 3}" class="as" text-anchor="end">${(v / 1000).toFixed(1).replace(".", ",")}</text>`;
  for (let w = maxX <= 16 ? 2 : 4; w <= maxX; w += maxX <= 16 ? 2 : 4) svg += `<text x="${x(w)}" y="${H - 6}" class="as" text-anchor="middle">${w} wk</text>`;
  const punten = metG.map((m, i) => `${x(xs[i])},${y(m.gewicht)}`).join(" ");
  svg += `<polyline points="${punten}" fill="none" stroke="var(--primair)" stroke-width="2"/>`;
  metG.forEach((m, i) => { svg += `<circle cx="${x(xs[i])}" cy="${y(m.gewicht)}" r="3.5" fill="var(--primair)"/>`; });
  el.innerHTML = `<div class="grafiekkop"><h2>Groei</h2><span class="klein-grijs">${g ? "gewicht per week oud" : "gewicht"}</span></div>
    <div class="blik groeiblik">
      ${laatste ? `<div class="blikvak"><span>Gewicht</span><b>${kg(laatste.gewicht)} kg</b><small>${new Date(laatste.tijd).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}</small>${toename}</div>` : ""}
      ${laatsteL ? `<div class="blikvak"><span>Lengte</span><b>${(laatsteL.lengte / 10).toFixed(1).replace(".", ",")} cm</b><small>${new Date(laatsteL.tijd).toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}</small></div>` : ""}
    </div>
    ${metG.length > 1 ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewicht in kg per week">${svg}</svg><p class="klein-grijs">Kilo's per ${g ? "week oud" : "week sinds de eerste meting"}. De groeicurve van het consultatiebureau is leidend; deze grafiek laat jullie eigen metingen zien.</p>` : ""}
    <div class="tabelrol"><table class="dagtabel"><thead><tr><th>Datum</th>${g ? "<th>leeftijd</th>" : ""}<th>gewicht</th><th>lengte</th></tr></thead>
      <tbody>${[...lijst].reverse().map((m) => { const l = g ? leeftijd(m.tijd) : null; return `<tr class="tikbaar" data-id="${esc(m.id)}"><th>${new Date(m.tijd).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "2-digit" })}</th>${g ? `<td>${l ? `${l.weken} wk` : "·"}</td>` : ""}<td>${m.gewicht ? kg(m.gewicht) + " kg" : "·"}</td><td>${m.lengte ? (m.lengte / 10).toFixed(1).replace(".", ",") + " cm" : "·"}</td></tr>`; }).join("")}</tbody></table></div>
    ${knop}`;
}
$("#groei").addEventListener("click", (e) => {
  const rij = e.target.closest("tr.tikbaar");
  if (rij) return openBewerk(rij.dataset.id);
  if (!e.target.closest("#meting-toevoegen")) return;
  $("#m-gewicht").value = "";
  $("#m-lengte").value = "";
  $("#m-datum").value = new Date().toISOString().slice(0, 10);
  dlgMeting.showModal();
});
dlgMeting.addEventListener("close", () => {
  if (dlgMeting.returnValue !== "opslaan") return;
  dlgMeting.returnValue = "";
  const gewicht = getal($("#m-gewicht").value) || null;
  const lengte = Math.round(parseFloat(String($("#m-lengte").value).replace(",", ".")) * 10) || null;
  if (!gewicht && !lengte) return toast("Vul een gewicht of lengte in.");
  const datum = new Date($("#m-datum").value + "T12:00:00").getTime();
  const id = registreer({ type: "meting", tijd: Number.isFinite(datum) ? datum : Date.now(), gewicht, lengte, door: naam || "" });
  toast("Meting opgeslagen", "Ongedaan maken", () => verwijder(id));
});

// ---------- weekkaart: één plaatje om te delen ----------
$("#weekkaart").addEventListener("click", async () => {
  const vandaag = dagStart(Date.now());
  const dagen = dagreeks(8).filter((x) => !x.lopend);  // de laatste 7 volle dagen
  const actief = dagen.filter((x) => x.actief);
  const som = (k) => dagen.reduce((s, x) => s + x.t[k], 0);
  const gem = (k) => (actief.length ? Math.round(actief.reduce((s, x) => s + x.t[k], 0) / actief.length) : 0);
  const pauzes = pauzeStats(dagen.flatMap((x) => pauzesIn(x.d, plusDagen(x.d, 1))));
  const css = getComputedStyle(document.body);
  const kleur = (v) => css.getPropertyValue(v).trim();
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1080;
  const g = c.getContext("2d");
  g.fillStyle = kleur("--bg"); g.fillRect(0, 0, 1080, 1080);
  g.fillStyle = kleur("--kaart"); g.beginPath(); g.roundRect(60, 60, 960, 960, 48); g.fill();
  g.fillStyle = kleur("--tekst");
  g.font = "700 64px system-ui, sans-serif";
  g.fillText(`${kindNaam() || "Onze kleine"}${leeftijdTekst() ? `, ${leeftijdTekst()}` : ""}`, 120, 170);
  g.font = "400 36px system-ui, sans-serif"; g.fillStyle = kleur("--zacht");
  const van = new Date(dagen[0].d).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
  const tot = new Date(dagen.at(-1).d).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
  g.fillText(`De week van ${van} tot en met ${tot}`, 120, 230);
  const vakken = [];
  if (heeft("fles") || heeft("kolven")) vakken.push([`${gem("flessen")}`, "flessen per dag", `${som("kunst") + som("fles")} ml in totaal`, kleur("--kunst")]);
  if (heeft("fles") || heeft("kolven")) vakken.push([`${gem("kunst") + gem("fles")} ml`, "per dag", `gem. ${gem("flessen") ? Math.round((gem("kunst") + gem("fles")) / gem("flessen")) : 0} ml per fles`, kleur("--kunst")]);
  if (heeft("borst")) vakken.push([`${gem("borst")} min`, "borst per dag", `${gem("borstKeer")} keer per dag`, kleur("--borst")]);
  if (heeft("kolven")) vakken.push([`${gem("kolf")} ml`, "gekolfd per dag", `${som("kolf")} ml in totaal`, kleur("--kolf")]);
  if (heeft("luiers")) vakken.push([`${gem("luiers")}`, "luiers per dag", `${som("nat")} nat · ${som("poep")} poep`, kleur("--luier")]);
  if (heeft("slaap") && som("dutjes")) vakken.push([`${duurTekst(gem("slaapMin") * 60000)}`, "slaap per dag", `langste ${duurTekst(Math.max(...dagen.map((x) => x.t.langsteSlaap)) * 60000)}`, kleur("--slaap")]);
  if (pauzes) vakken.push([`${duurTekst(pauzes.max.duur)}`, "langste pauze", `${dagLabel(pauzes.max.tot).toLowerCase()} ${uurMin(pauzes.max.van)} tot ${uurMin(pauzes.max.tot)}`, kleur("--fles")]);
  vakken.slice(0, 6).forEach(([groot, wat, detail, kl], i) => {
    const x = 120 + (i % 2) * 440, y = 290 + Math.floor(i / 2) * 220;
    g.fillStyle = kleur("--veld"); g.beginPath(); g.roundRect(x, y, 400, 190, 28); g.fill();
    g.fillStyle = kl; g.font = "800 72px system-ui, sans-serif"; g.fillText(groot, x + 30, y + 90);
    g.fillStyle = kleur("--tekst"); g.font = "600 32px system-ui, sans-serif"; g.fillText(wat, x + 30, y + 135);
    g.fillStyle = kleur("--zacht"); g.font = "400 26px system-ui, sans-serif"; g.fillText(detail, x + 30, y + 172);
  });
  g.fillStyle = kleur("--zacht"); g.font = "400 28px system-ui, sans-serif";
  g.fillText("Gemiddelden over de dagen met registraties · Babyvoeding", 120, 985);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const bestand = new File([blob], "weekkaart.png", { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [bestand] })) return void (await navigator.share({ files: [bestand], title: "Weekkaart" }));
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "weekkaart.png" });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  toast("Weekkaart opgeslagen als afbeelding");
});

// ---------- luiers ----------
// Eén tik: luier opgeslagen met de huidige tijd, met ongedaan maken.
$("#luierkaart").addEventListener("click", (e) => {
  const knop = e.target.closest("[data-luier]");
  if (!knop) return;
  const soort = knop.dataset.luier;
  const luier = { type: "luier", tijd: Date.now(), nat: soort === "nat" || soort === "beide", poep: soort === "poep" || soort === "beide", door: naam || "" };
  const id = registreer(luier);
  navigator.vibrate?.(30);
  toast(`Luier opgeslagen: ${luierTekst(luier)}`, "Ongedaan maken", () => verwijder(id));
});

// ---------- weergave: registreren ----------
function renderLaatste() {
  const alleenVoeding = voedingen.filter(isVoeding);
  const luiers = voedingen.filter(isLuier);
  const ll = luiers[0];
  const laatste = alleenVoeding[0];
  $("#laatste-luier").textContent = ll ? `laatste ${uurMin(ll.tijd)}, ${luierTekst(ll)} · ${geledenTekst(ll.tijd).toLowerCase()}` : "";
  // Hoe vaak: gemiddelde tijd tussen de voedingen van de afgelopen 24 uur.
  const pozen = tussenpozen(voedmomenten(alleenVoeding.filter((v) => v.tijd >= Date.now() - DAG)));
  const gem = pozen.length ? pozen.reduce((s, p) => s + p.duur, 0) / pozen.length : 0;
  // Volgende fles: laatste voeding plus het gemiddelde, zolang die nog niet voorbij is.
  const volgende = laatste && gem && laatste.tijd + gem > Date.now() - 30 * 60000 ? laatste.tijd + gem : 0;
  $("#laatste-ritme").textContent = pozen.length
    ? `Afgelopen 24 uur ${pozen.length + 1} keer, gemiddeld elke ${duurTekst(gem)}${volgende ? ` · volgende rond ${uurMin(volgende)}` : ""}`
    : "";
  renderKind();
  if (!MODI.some(modusAan)) {
    // Alleen luiers bijhouden: bovenaan de laatste luier.
    $("#laatste-sinds").textContent = ll ? geledenTekst(ll.tijd) : "Nog niets geregistreerd";
    $("#laatste-detail").textContent = ll ? `om ${uurMin(ll.tijd)} · ${luierTekst(ll)}` : "";
    $("#laatste-ritme").textContent = "";
    $("#laatste-kant").hidden = true;
    return;
  }
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

// Vandaag in een paar vragen: wat is gevoed en wanneer, wat is gekolfd, wat is er over, welke luiers.
// Onderdelen die uit staan, blijven weg.
function dagBlok(t, lijst) {
  const regel = (hoofd, wat, detail) => `<div class="bregel"><b>${hoofd}</b><span class="bwat">${wat}</span>${detail ? `<span class="bdetail">${detail}</span>` : ""}</div>`;
  const flesMl = t.kunst + t.fles;
  const momenten = voedmomenten(lijst);
  const pozen = tussenpozen(momenten);
  const elke = pozen.length > 1 ? ` · gem. elke ${duurTekst(pozen.reduce((s, p) => s + p.duur, 0) / pozen.length)}` : "";
  // Wanneer: elk voedmoment als tijd, met de ml uit de fles.
  const tijden = momenten.length
    ? `<div class="tijden">${momenten.map((m) => {
        const ml = m.items.reduce((s, v) => s + getal(v.kunst) + getal(v.kolf), 0);
        return `<span>${uurMin(m.tijd)}${ml ? ` · <b>${ml}</b>` : ""}</span>`;
      }).join("")}</div>`
    : "";
  const gevoed = [
    flesMl && regel(`${flesMl} ml`, "fles", heeft("kolven") ? [t.kunst && `${t.kunst} kunstvoeding`, t.fles && `${t.fles} moedermelk`].filter(Boolean).join(" + ") : ""),
    t.borst && regel(`${t.borst} min`, "borst", `L ${t.L} · R ${t.R}`),
  ].filter(Boolean).join("") || `<div class="bleeg">Nog niets gevoed</div>`;
  const gekolfd = t.kolf
    ? regel(`${t.kolf} ml`, "", `L ${t.kolfL} · R ${t.kolfR} · ${t.kolfsessies} keer`)
    : `<div class="bleeg">Nog niet gekolfd</div>`;
  const over = heeft("kolven") ? voorraad().reduce((s, p) => s + p.rest, 0) : 0;
  return `
    ${MODI.some(modusAan) ? `<div class="blok gevoed"><div class="bkop">Gevoed${momenten.length ? `<span>${momenten.length} keer${elke}</span>` : ""}</div>${gevoed}${tijden}</div>` : ""}
    ${heeft("kolven") ? `<div class="blok gekolfd"><div class="bkop">Gekolfd</div>${gekolfd}</div>` : ""}
    ${over || (heeft("kolven") && t.kolf) ? `<div class="blok over"><div class="bkop">Over</div>${regel(`${over} ml`, "gekolfde melk", "nog niet gegeven")}</div>` : ""}
    ${heeft("luiers") ? `<div class="blok luiers"><div class="bkop">Luiers<span>${t.luiers ? `${t.luiers} · ${t.nat} nat · ${t.poep} poep` : "nog geen"}</span></div>${
      t.luiers ? `<div class="tijden">${lijst.filter(isLuier).sort((x, y) => x.tijd - y.tijd).map((v) => `<span>${uurMin(v.tijd)} · ${luierTekst(v)}</span>`).join("")}</div>` : ""}</div>` : ""}
    ${heeft("slaap") ? `<div class="blok slaap"><div class="bkop">Slaap<span>${t.dutjes ? `${duurTekst(t.slaapMin * 60000)} · ${t.dutjes} keer · langste ${duurTekst(t.langsteSlaap * 60000)}` : "nog niet"}</span></div>${
      t.dutjes ? `<div class="tijden">${lijst.filter(isSlaap).sort((x, y) => x.tijd - y.tijd).map((v) => `<span>${uurMin(v.tijd)}${v.eind ? ` tot ${uurMin(v.eind)}` : " · slaapt"}</span>`).join("")}</div>` : ""}</div>` : ""}`;
}

function renderLijst() {
  const vandaag = dagStart(Date.now());
  const vandaagLijst = voedingen.filter((v) => dagStart(v.tijd) === vandaag);
  $("#totalen-vandaag").innerHTML = dagBlok(totalen(vandaagLijst), vandaagLijst);

  const perDag = new Map();
  for (const v of voedingen) {
    const d = dagStart(v.tijd);
    if (!perDag.has(d)) perDag.set(d, []);
    perDag.get(d).push(v);
  }
  const dagen = oppas ? [...perDag.entries()].filter(([d]) => d === vandaag) : [...perDag.entries()];
  const html = dagen.slice(0, dagenZichtbaar).map(([d, lijst]) => {
    const t = totalen(lijst);
    const samenvatting = [t.kunst + t.fles && `fles ${t.kunst + t.fles} ml`, t.borst && `borst ${t.borst} min`, t.kolf && `gekolfd ${t.kolf} ml`, t.luiers && `${t.luiers} luier${t.luiers === 1 ? "" : "s"}`, t.dutjes && `slaap ${duurTekst(t.slaapMin * 60000)}`].filter(Boolean).join(" · ");
    const rijen = lijst.map((v) => `
      <button class="item" data-id="${esc(v.id)}">
        <span class="item-tijd">${uurMin(v.tijd)}</span>
        <span class="item-delen">${regels(v).map((g) => `<span class="iregel ${g.soort}"><span class="ikop"><i></i>${g.wat} <b>${esc(g.hoeveel)}</b></span>${g.detail ? `<span class="idetail">${esc(g.detail)}</span>` : ""}</span>`).join("")}</span>
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
      // Wie alleen luiers bijhoudt: dan tellen de dagen met luiers.
      actief: (perDag.get(d) || []).some((v) => isVoeding(v) || isKolven(v) || !MODI.some(modusAan)),
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

// Trend als klein chipje: een pijl met het percentage. De uitleg staat één keer onder de kaart.
let trendGetoond = false;
function trendTekst(sleutel, eenheid, goedAls) {
  const t = trend(sleutel);
  if (!t) return "";
  trendGetoond = true;
  const richting = Math.abs(t.pct) < 5 ? "gelijk" : t.pct > 0 ? "op" : "af";
  const pijl = { op: "↑", af: "↓", gelijk: "→" }[richting];
  const kleur = richting === "gelijk" || !goedAls ? "" : richting === goedAls ? "goed" : "let";
  const titel = `gem. ${Math.round(t.nu)} ${eenheid} per dag over de laatste ${t.w} volle dagen, daarvoor ${Math.round(t.toen)}`;
  return `<span class="trend ${kleur}" title="${titel}">${pijl}${richting === "gelijk" ? "" : ` ${Math.abs(t.pct)}%`}</span>`;
}

function renderGisteren() {
  const gist = plusDagen(dagStart(Date.now()), -1);
  const lijst = voedingen.filter((v) => dagStart(v.tijd) === gist);
  const t = totalen(lijst);
  const datum = new Date(gist).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  if (!t.aantal && !(heeft("luiers") && t.luiers) && !(heeft("slaap") && t.dutjes)) {
    $("#gisteren").innerHTML = `<h2>Gisteren <span class="klein-grijs">${datum}</span></h2>
      <p class="leeg">Gisteren is niets geregistreerd. Deze dag telt niet mee in gemiddelden en trends.</p>`;
    return;
  }
  const vakken = [];
  const tegels = [];
  const tegel = (getal, label, detail, chip = "", kleur = "") => `<div class="tegel ${kleur}"><b>${getal}${chip}</b><span>${label}</span>${detail ? `<small>${detail}</small>` : ""}</div>`;
  trendGetoond = false;
  if (heeft("fles")) {
    // Vier tegels: hoeveel, hoe vaak, hoe lang ertussen, langste pauze. Eén getal per tegel.
    const p = pauzeStats(pauzesIn(gist, plusDagen(gist, 1)));
    const flesMl = t.kunst + t.fles;
    tegels.push(
      tegel(`${t.kunst} ml`, "kunstvoeding", heeft("kolven") && t.fles ? `+ ${t.fles} ml moedermelk` : "", trendTekst("kunst", "ml", null), "kunst"),
      tegel(t.flessen, t.flessen === 1 ? "fles" : "flessen", t.flessen ? `gem. ${Math.round(flesMl / t.flessen)} ml` : "", trendTekst("flessen", "keer", null)),
      p ? tegel(duurTekst(p.gem), "tussen flessen", `kortste ${duurTekst(p.min.duur)}`) : "",
      p ? tegel(duurTekst(p.max.duur), "langste pauze", `${uurMin(p.max.van)} tot ${uurMin(p.max.tot)}`) : "",
    );
    // Vitamine K-richtlijn geldt alleen als de baby ook moedermelk krijgt.
    if (heeft("borst") || heeft("kolven")) {
      const week = dagreeks(8).filter((x) => x.actief && !x.lopend);
      const onder = week.filter((x) => x.t.kunst < VITK_ML).length;
      vakken.push(`<p class="vitk">Vitamine K-grens ${VITK_ML} ml: gisteren ${t.kunst >= VITK_ML ? "erboven" : "eronder"}${week.length ? `, ${onder} van de laatste ${week.length} dagen eronder` : ""}.</p>`);
    }
  }
  if (heeft("luiers")) {
    tegels.push(tegel(t.luiers, t.luiers === 1 ? "luier" : "luiers", t.luiers ? `${t.nat} nat · ${t.poep} poep${t.droog ? ` · ${t.droog} droog` : ""}` : "", "", "luier"));
  }
  if (heeft("slaap") && t.dutjes) {
    tegels.push(tegel(duurTekst(t.slaapMin * 60000), "slaap", `${t.dutjes} keer · langste ${duurTekst(t.langsteSlaap * 60000)}`, trendTekst("slaapUur", "uur", "op"), "slaap"));
  }
  if (tegels.length) vakken.unshift(`<div class="bliktegels">${tegels.join("")}</div>`);
  if (heeft("kolven")) {
    vakken.push(`<div class="blikvak kolf"><span>Gekolfd</span><b>${t.kolf} ml</b><small>L ${t.kolfL} · R ${t.kolfR} ml · ${t.kolfsessies} keer</small>${trendTekst("kolf", "ml", "op")}</div>`);
    if (heeft("fles")) vakken.push(`<div class="blikvak samen"><span>Kunstvoeding + gekolfd samen</span><b>${t.samen} ml</b></div>`);
  }
  if (heeft("borst")) {
    vakken.push(`<div class="blikvak borst"><span>Borstvoeding</span><b>${t.borst} min</b><small>L ${t.L} · R ${t.R} min · ${t.borstKeer} keer</small>${trendTekst("borst", "min", "op")}</div>`);
  }
  $("#gisteren").innerHTML = `
    <h2>Gisteren <span class="klein-grijs">${datum}</span></h2>
    <div class="blik">${vakken.join("")}</div>
    ${trendGetoond ? `<p class="klein-grijs trenduitleg">Pijlen: de laatste 7 volle dagen tegenover de 7 dagen ervoor.</p>` : ""}`;
}

// Tijd tussen voedingen: per dag (of week) de gemiddelde pauze als stip, met een streep van de
// kortste tot de langste pauze.
function pauzegrafiek(el, reeks, perWeek, kleur) {
  const W = 340, H = 170, pl = 30, pb = 20, pt = 16, pr = 4;
  const n = reeks.length;
  const rijen = reeks.map((x) => ({ x, p: pauzeStats(pauzesIn(x.d, plusDagen(x.d, perWeek ? 7 : 1))) }));
  const maxUur = Math.max(4, Math.ceil(Math.max(0, ...rijen.filter((r) => r.p).map((r) => r.p.max.duur)) / 36e5));
  const stap = maxUur <= 6 ? 1 : maxUur <= 12 ? 2 : 3;
  const top = Math.ceil(maxUur / stap) * stap;
  const y = (ms) => pt + (H - pt - pb) * (1 - ms / (top * 36e5));
  const bw = (W - pl - pr) / n;
  let svg = "";
  for (let u = 0; u <= top; u += stap) {
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(u * 36e5)}" y2="${y(u * 36e5)}" class="rast"/><text x="${pl - 4}" y="${y(u * 36e5) + 3}" class="as" text-anchor="end">${u} u</text>`;
  }
  rijen.forEach(({ x, p }, i) => {
    const cx = pl + bw * i + bw / 2;
    if (n <= 14 || i % 5 === (n - 1) % 5) svg += `<text x="${cx}" y="${H - 6}" class="as${x.lopend ? " nu" : ""}" text-anchor="middle">${x.as}</text>`;
    if (!p) return;
    const op = x.lopend ? ' opacity=".45"' : "";
    // Streep van kortste tot langste, met een kapje aan beide kanten.
    const kap = Math.max(3, Math.min(8, bw * 0.3));
    svg += `<line x1="${cx}" x2="${cx}" y1="${y(p.min.duur)}" y2="${y(p.max.duur)}" stroke="${kleur}" stroke-width="1.5"${op}/>`;
    for (const d of [p.min.duur, p.max.duur]) svg += `<line x1="${cx - kap}" x2="${cx + kap}" y1="${y(d)}" y2="${y(d)}" stroke="${kleur}" stroke-width="2" stroke-linecap="round"${op}/>`;
    svg += `<circle cx="${cx}" cy="${y(p.gem)}" r="${Math.max(2.5, Math.min(4, bw * 0.25))}" fill="${kleur}"${op}/>`;
    // Bij 7 dagen of minder: langste boven en kortste onder de streep.
    if (n <= 7) {
      svg += `<text x="${cx}" y="${Math.max(9, y(p.max.duur) - 4)}" class="waardelabel" text-anchor="middle">${uurKort(p.max.duur)}</text>`;
      if (p.n > 1) svg += `<text x="${cx}" y="${Math.min(H - pb - 2, y(p.min.duur) + 11)}" class="waardelabel" text-anchor="middle">${uurKort(p.min.duur)}</text>`;
    }
  });
  // Over de hele periode, zonder de lopende dag of week.
  const alle = rijen.filter((r) => !r.x.lopend).flatMap((r) => pauzesIn(r.x.d, plusDagen(r.x.d, perWeek ? 7 : 1)));
  const s = pauzeStats(alle);
  if (s) svg += `<line x1="${pl}" x2="${W - pr}" y1="${y(s.gem)}" y2="${y(s.gem)}" class="gemlijn"/>`;
  const samenvatting = s
    ? `<p class="pauzesom"><span>gem. <b>${duurTekst(s.gem)}</b></span><span>kortste <b>${duurTekst(s.min.duur)}</b> <small>${dagLabel(s.min.tot).toLowerCase()} ${uurMin(s.min.van)} tot ${uurMin(s.min.tot)}</small></span><span>langste <b>${duurTekst(s.max.duur)}</b> <small>${dagLabel(s.max.tot).toLowerCase()} ${uurMin(s.max.van)} tot ${uurMin(s.max.tot)}</small></span></p>`
    : `<p class="klein-grijs">Nog te weinig voedingen om pauzes te tonen.</p>`;
  el.innerHTML = `<div class="grafiekkop"><h2>Tijd tussen voedingen${perWeek ? " (per week)" : ""}</h2></div>
    ${samenvatting}
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gemiddelde, kortste en langste tijd tussen voedingen per ${perWeek ? "week" : "dag"}">${svg}</svg>
    <div class="legenda"><span><i class="rond" style="background:${kleur}"></i>gemiddeld</span><span><i class="kapje" style="border-color:${kleur}"></i>kortste en langste</span><span><i class="streep"></i>gemiddelde periode</span></div>
    <div class="tabelrol"><table class="dagtabel pauzetabel">
      <thead><tr><th>${perWeek ? "Week" : "Dag"}</th><th>gem.</th><th>kortste</th><th>langste</th></tr></thead>
      <tbody>${[...rijen].reverse().filter((r) => r.p).map(({ x, p }) => `<tr class="${x.lopend ? "nu" : ""}"><th>${x.naam}</th><td class="sub">${uurKort(p.gem)}</td>
        <td>${uurKort(p.min.duur)}${perWeek ? "" : `<small>${uurMin(p.min.van)}-${uurMin(p.min.tot)}</small>`}</td>
        <td>${uurKort(p.max.duur)}${perWeek ? "" : `<small>${uurMin(p.max.van)}-${uurMin(p.max.tot)}</small>`}</td></tr>`).join("")}</tbody>
    </table></div>
    <p class="klein-grijs pauzeuitleg">Borst en fles binnen 45 minuten tellen als één voeding. Pauzes langer dan 12 uur tellen niet mee (waarschijnlijk vergeten te registreren).</p>`;
}

// Hoeveel melk per dagdeel: per dag (of week) de ml uit de fles in de nacht, ochtend, middag
// en avond. Hoe donkerder het vak, hoe meer. Zo zie je of de grote flessen verschuiven.
const DAGDELEN = [
  { naam: "nacht", van: 0, tot: 6 },
  { naam: "ochtend", van: 6, tot: 12 },
  { naam: "middag", van: 12, tot: 18 },
  { naam: "avond", van: 18, tot: 24 },
];
function dagdeelOverzicht(el, reeks, perWeek) {
  const flesMl = (v) => (isVoeding(v) ? getal(v.kunst) + getal(v.kolf) : 0);
  const perDag = perDagIndex();
  // Per dag: ml en aantal flessen per dagdeel.
  const dagCel = (d) => DAGDELEN.map((dd) => {
    const lijst = (perDag.get(d) || []).filter((v) => flesMl(v) && new Date(v.tijd).getHours() >= dd.van && new Date(v.tijd).getHours() < dd.tot);
    return { ml: lijst.reduce((s, v) => s + flesMl(v), 0), keer: lijst.length };
  });
  const metFles = (d) => (perDag.get(d) || []).some(flesMl);
  const rijen = reeks.map((x) => {
    if (!perWeek) return { x, cellen: dagCel(x.d), heeft: metFles(x.d) };
    // Per week: gemiddelde per dag over de dagen met flessen.
    const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(x.d, i)).filter((d) => d < dagStart(Date.now()) && metFles(d));
    const cellen = DAGDELEN.map((_, j) => {
      const som = dagen.reduce((s, d) => { const c = dagCel(d)[j]; return { ml: s.ml + c.ml, keer: s.keer + c.keer }; }, { ml: 0, keer: 0 });
      return dagen.length ? { ml: Math.round(som.ml / dagen.length), keer: Math.round((som.keer / dagen.length) * 10) / 10 } : { ml: 0, keer: 0 };
    });
    return { x, cellen, heeft: dagen.length > 0 };
  }).filter((r) => r.heeft);
  if (!rijen.length) {
    el.innerHTML = `<h2>Melk per dagdeel</h2><p class="klein-grijs">Nog geen flessen in deze periode.</p>`;
    return;
  }
  const max = Math.max(1, ...rijen.flatMap((r) => r.cellen.map((c) => c.ml)));
  const volle = rijen.filter((r) => !r.x.lopend);
  const gem = DAGDELEN.map((_, j) => (volle.length ? Math.round(volle.reduce((s, r) => s + r.cellen[j].ml, 0) / volle.length) : 0));
  const cel = (c) => `<td class="ddcel" style="--sterkte:${(c.ml / max).toFixed(2)}">${c.ml ? `<b>${c.ml}</b><small>${String(c.keer).replace(".", ",")}×</small>` : "·"}</td>`;
  // Verandering: eerste helft van de periode tegen de tweede helft.
  let verschil = "";
  if (volle.length >= 4) {
    const oud = volle.slice(0, Math.floor(volle.length / 2));
    const nieuw = volle.slice(-Math.floor(volle.length / 2));
    const g = (lijst, j) => lijst.reduce((s, r) => s + r.cellen[j].ml, 0) / lijst.length;
    verschil = `<tr class="verschil"><th>Verschil</th>${DAGDELEN.map((_, j) => {
      const d = Math.round(g(nieuw, j) - g(oud, j));
      return `<td>${Math.abs(d) < 10 ? "=" : `${d > 0 ? "+" : ""}${d}`}</td>`;
    }).join("")}</tr>`;
  }
  el.innerHTML = `<h2>Melk per dagdeel${perWeek ? " (gem. per dag, per week)" : ""}</h2>
    <div class="tabelrol"><table class="dagtabel dagdeeltabel">
      <thead><tr><th>${perWeek ? "Week" : "Dag"}</th>${DAGDELEN.map((dd) => `<th>${dd.naam}<small>${dd.van}-${dd.tot} u</small></th>`).join("")}</tr></thead>
      <tbody>${[...rijen].reverse().map((r) => `<tr class="${r.x.lopend ? "nu" : ""}"><th>${r.x.naam}</th>${r.cellen.map(cel).join("")}</tr>`).join("")}</tbody>
      <tfoot><tr><th>Gem./dag</th>${gem.map((m) => `<td>${m || "·"}</td>`).join("")}</tr>${verschil}</tfoot>
    </table></div>
    <p class="klein-grijs">ml uit de fles per dagdeel, met het aantal flessen (×). Hoe donkerder, hoe meer.${verschil ? " Verschil: de laatste helft van de periode tegen de eerste helft, in ml per dag." : ""}${perWeek ? "" : " Vandaag telt niet mee in het gemiddelde."}</p>`;
}

// Wie deed wat: per persoon de flessen, luiers en nachtflessen in deze periode.
function renderWieDeedWat(reeks, perWeek) {
  const el = $("#wiedeedwat");
  const van = reeks[0].d;
  const tot = plusDagen(reeks.at(-1).d, perWeek ? 7 : 1);
  const per = new Map();
  for (const v of voedingen) {
    if (v.tijd < van || v.tijd >= tot || !v.door) continue;
    if (!per.has(v.door)) per.set(v.door, { flessen: 0, luiers: 0, nacht: 0, borst: 0, slaap: 0, kolf: 0 });
    const p = per.get(v.door);
    const u = new Date(v.tijd).getHours();
    if (isVoeding(v) && (getal(v.kunst) || getal(v.kolf))) { p.flessen++; if (u >= 22 || u < 7) p.nacht++; }
    if (isVoeding(v) && (getal(v.borstL) || getal(v.borstR))) p.borst++;
    if (isLuier(v)) p.luiers++;
    if (isSlaap(v)) p.slaap++;
    if (isKolven(v)) p.kolf++;
  }
  if (per.size < 2) { el.hidden = true; return; }
  el.hidden = false;
  const rijen = [...per.entries()].sort((a, b) => (b[1].flessen + b[1].luiers) - (a[1].flessen + a[1].luiers));
  const nachtkoning = rijen.reduce((x, r) => (r[1].nacht > (x?.[1].nacht || 0) ? r : x), null);
  const kol = [["flessen", "flessen", heeft("fles") || heeft("kolven")], ["nacht", "'s nachts", heeft("fles") || heeft("kolven")], ["borst", "borst", heeft("borst")], ["kolf", "kolven", heeft("kolven")], ["luiers", "luiers", heeft("luiers")], ["slaap", "slaap", heeft("slaap")]].filter((k) => k[2]);
  el.innerHTML = `<h2>Wie deed wat</h2>
    <div class="tabelrol"><table class="dagtabel"><thead><tr><th></th>${kol.map((k) => `<th>${k[1]}</th>`).join("")}</tr></thead>
    <tbody>${rijen.map(([wie, p]) => `<tr><th>${esc(wie)}${nachtkoning && nachtkoning[0] === wie && p.nacht ? ' <span title="Nachtkoning">👑</span>' : ""}</th>${kol.map((k) => `<td>${p[k[0]] || "·"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="klein-grijs">In de gekozen periode. 's Nachts is tussen 22 en 7 uur; het kroontje is voor de nachtkoning.</p>`;
}

// Dagritme: per dag een tijdlijn van 0 tot 24 uur met de voedingen (stippen) en luiers (streepjes).
// Zo zie je in één oogopslag wanneer de baby drinkt en of er een vast ritme in komt.
function ritmegrafiek(el, n) {
  const kleur = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const W = 340, pl = 38, pr = 6, pt = 4, rij = 22, pb = 16;
  const H = pt + rij * n + pb;
  const x = (t, d) => pl + ((t - d) / DAG) * (W - pl - pr);
  const vandaag = dagStart(Date.now());
  let svg = "";
  // Nacht (22 tot 7 uur) licht gekleurd.
  const uurX = (u) => pl + (u / 24) * (W - pl - pr);
  svg += `<rect x="${uurX(0)}" y="${pt}" width="${uurX(7) - uurX(0)}" height="${rij * n}" class="nacht"/>`;
  svg += `<rect x="${uurX(22)}" y="${pt}" width="${uurX(24) - uurX(22)}" height="${rij * n}" class="nacht"/>`;
  for (let u = 0; u <= 24; u += 3) {
    svg += `<line x1="${uurX(u)}" x2="${uurX(u)}" y1="${pt}" y2="${pt + rij * n}" class="uurlijn"/>`;
    if (u % 6 === 0) svg += `<text x="${uurX(u)}" y="${H - 4}" class="as" text-anchor="middle">${u}</text>`;
  }
  const metFles = heeft("fles") || heeft("kolven");
  for (let i = 0; i < n; i++) {
    const d = plusDagen(vandaag, -i);
    const y = pt + rij * i + rij / 2;
    const dt = new Date(d);
    const label = i === 0 ? "nu" : dt.toLocaleDateString("nl-NL", { weekday: "short" }).slice(0, 2) + " " + dt.getDate();
    svg += `<text x="${pl - 4}" y="${y + 3}" class="rijlabel${i === 0 ? " nu" : ""}" text-anchor="end">${label}</text>`;
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${pt + rij * (i + 1)}" y2="${pt + rij * (i + 1)}" class="uurlijn"/>`;
    // Slaap als balk, ook als hij de dag ervoor begon.
    if (heeft("slaap")) {
      for (const v of voedingen) {
        if (!isSlaap(v)) continue;
        const eind = v.eind || Date.now();
        if (v.tijd >= d + DAG || eind <= d) continue;
        const x1 = x(Math.max(v.tijd, d), d), x2 = x(Math.min(eind, d + DAG), d);
        svg += `<rect x="${x1}" y="${y + 4}" width="${Math.max(1.5, x2 - x1)}" height="5" rx="2" fill="${kleur("--slaap")}" opacity=".7"/>`;
      }
    }
    for (const v of voedingen) {
      if (dagStart(v.tijd) !== d || isSlaap(v) || isMeting(v) || isHapje(v)) continue;
      const cx = x(v.tijd, d);
      if (isLuier(v)) {
        if (!heeft("luiers")) continue;
        svg += `<rect x="${cx - 1.25}" y="${y + 1}" width="2.5" height="7" rx="1" fill="${kleur(v.poep ? "--poep" : "--luier")}" ${!v.nat && !v.poep ? 'opacity=".45"' : ""}/>`;
      } else if (isKolven(v)) {
        if (heeft("kolven")) svg += `<circle cx="${cx}" cy="${y - 3}" r="3" fill="none" stroke="${kleur("--kolf")}" stroke-width="1.5"/>`;
      } else {
        const fles = getal(v.kunst) || getal(v.kolf);
        // Grotere fles, grotere stip (tussen 2,5 en 6).
        const ml = getal(v.kunst) + getal(v.kolf);
        if (fles && metFles) svg += `<circle cx="${cx}" cy="${y - 3}" r="${Math.min(6, 2.5 + ml / 45).toFixed(1)}" fill="${kleur("--kunst")}" fill-opacity=".85"/>`;
        else if (!fles && heeft("borst")) svg += `<circle cx="${cx}" cy="${y - 3}" r="3.6" fill="${kleur("--borst")}"/>`;
      }
    }
  }
  const leg = [
    metFles && `<span><i class="rond" style="background:${kleur("--kunst")}"></i>fles (groter = meer ml)</span>`,
    heeft("borst") && `<span><i class="rond" style="background:${kleur("--borst")}"></i>borst</span>`,
    heeft("kolven") && `<span><i class="rond" style="border:1.5px solid ${kleur("--kolf")};background:none"></i>kolven</span>`,
    heeft("slaap") && `<span><i style="background:${kleur("--slaap")};opacity:.7;width:14px;height:5px"></i>slaap</span>`,
    heeft("luiers") && `<span><i class="streepje" style="background:${kleur("--luier")}"></i>luier nat</span><span><i class="streepje" style="background:${kleur("--poep")}"></i>luier poep</span><span><i class="streepje" style="background:${kleur("--luier")};opacity:.45"></i>droog</span>`,
    `<span><i style="background:var(--veld)"></i>nacht (22 tot 7)</span>`,
  ].filter(Boolean).join("");
  el.innerHTML = `<div class="grafiekkop"><h2>Dagritme</h2><span class="klein-grijs">laatste ${n} dagen</span></div>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tijdstippen van voedingen en luiers per dag">${svg}</svg>
    <div class="legenda">${leg}</div>`;
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
    ...(heeft("borst") || heeft("kolven") ? { lijn: { waarde: VITK_ML, uitleg: `${VITK_ML} ml (vitamine K-richtlijn)` } } : {}),
  });
  staafgrafiek($("#g-flessen"), { titel: "Flessen" + per, eenheid: "keer", reeks, delen: ["flessen"], kleuren: [kleur("--kunst")], legenda: ["aantal flessen"] });
  staafgrafiek($("#g-luiers"), {
    titel: "Luiers" + per, eenheid: "luiers", reeks, delen: ["natAlleen", "poep", "droog"],
    kleuren: [kleur("--luier"), kleur("--poep"), kleur("--luier-licht")], legenda: ["nat", "poep (of beide)", "droog"],
  });
  const pauze = $("#g-pauze");
  pauze.hidden = !MODI.some(modusAan);
  if (!pauze.hidden) pauzegrafiek(pauze, reeks, perWeek, kleur("--kunst"));
  const dagdeel = $("#g-dagdeel");
  dagdeel.hidden = !modusAan("fles");
  if (!dagdeel.hidden) dagdeelOverzicht(dagdeel, reeks, perWeek);
  const ritme = $("#g-ritme");
  ritme.hidden = !MODI.some(modusAan) && !heeft("luiers") && !heeft("slaap");
  if (!ritme.hidden) ritmegrafiek(ritme, periode === 7 ? 7 : 14);
  staafgrafiek($("#g-slaap"), { titel: "Slaap" + per, eenheid: "uur", reeks, delen: ["slaapUur"], kleuren: [kleur("--slaap")], legenda: ["uren slaap (dag waarop hij begon)"] });
  renderWieDeedWat(reeks, perWeek);
  renderGroei();
  renderHapjes();
  staafgrafiek($("#g-samen"), { titel: "Kunstvoeding en gekolfd samen" + per, eenheid: "ml", reeks, delen: ["kunst", "kolf"], kleuren: [kleur("--kunst"), kleur("--kolf")], legenda: ["kunstvoeding", "gekolfd"] });
  staafgrafiek($("#g-kolf"), { titel: "Kolfopbrengst" + per, eenheid: "ml", reeks, delen: ["kolfL", "kolfR"], kleuren: [kleur("--kolf"), kleur("--kolf-licht")], legenda: ["links", "rechts"] });

  const rijen = [...reeks].reverse().filter((x) => x.binnen || (x.lopend && !perWeek));
  const som = (k) => rijen.reduce((s, x) => s + x.t[k], 0);
  const volle = rijen.filter((x) => x.actief && !x.lopend);
  const gem = (k) => (volle.length ? Math.round(volle.reduce((s, x) => s + x.t[k], 0) / volle.length) : 0);
  // Moedermelk uit de fles alleen tonen als die in deze periode gegeven is.
  const metFles = heeft("kolven") && som("fles") > 0;
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
    ...(heeft("fles") || metFles ? [{ titel: "Fles", klasse: "kunst", kol: [k("flessen", "keer"), ...(heeft("fles") ? [k("kunst", "kunst")] : []), ...(metFles ? [k("fles", "mm")] : [])] }] : []),
    ...(heeft("kolven") ? [{ titel: "Gekolfd", klasse: "kolf", kol: [k("kolfL", "L"), k("kolfR", "R"), k("kolf", "tot", true)] }] : []),
    ...(heeft("kolven") && heeft("fles") ? [{ titel: "Samen", klasse: "samen", kol: [k("samen", "k+k", true)] }] : []),
  ]);
  $("#luiertitel").textContent = perWeek ? "Luiers per week (gem. per dag)" : "Luiers per dag";
  tabel($("#luiertabel"), [
    { titel: "Luiers", klasse: "luier", kol: [k("luiers", "tot", true), k("nat", "nat"), k("poep", "poep"), k("droog", "droog")] },
  ]);
  $("#borsttitel").textContent = perWeek ? "Borstvoeding per week (gem. per dag)" : "Borstvoeding per dag (min)";
  tabel($("#borsttabel"), [
    { titel: "Borst (min)", klasse: "borst", kol: [k("L", "L"), k("R", "R"), k("borst", "tot", true), k("borstKeer", "keer")] },
  ]);
  $("#tabeluitleg").textContent =
    (heeft("kolven") && heeft("fles") ? "k+k = kunstvoeding + gekolfd. " : "") + (metFles ? "mm = moedermelk uit de fles. " : "") +
    (perWeek ? "Per week het gemiddelde per dag, over de dagen met registraties; de lopende week telt niet mee in Gem./dag." : "Gemiddelde over dagen met registraties, vandaag telt niet mee.");
}

// Tik op een dag in de tabel: naar die dag in de geschiedenis, om registraties te controleren.
for (const t of ["#melktabel", "#luiertabel", "#borsttabel"]) {
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
  renderSlaap();
  renderLijst();
  renderOverzicht();
  renderHapjes();
  toonFeest();
}

// ---------- bewerken ----------
const dlgBewerk = $("#dlg-bewerk");
let bewerkId = null;

function openBewerk(id) {
  const v = voedingen.find((x) => x.id === id);
  if (!v) return;
  bewerkId = id;
  const kolven = isKolven(v);
  const luier = isLuier(v);
  $(".b-luier", dlgBewerk).hidden = !luier;
  $("#b-nat").checked = Boolean(v.nat);
  $("#b-poep").checked = Boolean(v.poep);
  $("#b-opmerking").value = v.opmerking || "";
  $(".b-slaap", dlgBewerk).hidden = !isSlaap(v);
  $("#b-wakker").value = v.eind ? naarDatetimeLocal(v.eind) : "";
  $(".b-meting", dlgBewerk).hidden = !isMeting(v);
  $("#b-gewicht").value = v.gewicht || "";
  $("#b-lengte").value = v.lengte ? (v.lengte / 10).toFixed(1) : "";
  $(".b-hapje", dlgBewerk).hidden = !isHapje(v);
  $("#b-wat").value = v.wat || "";
  $("#b-reactie").value = v.reactie || "goed";
  $("#b-tijdlabel").textContent = isSlaap(v) ? "In slaap gevallen om" : isMeting(v) ? "Datum" : "Datum en tijd";
  $("#b-titel").textContent = luier ? "Luier aanpassen" : kolven ? "Kolven aanpassen" : isSlaap(v) ? "Slaap aanpassen" : isMeting(v) ? "Meting aanpassen" : isHapje(v) ? "Hapje aanpassen" : "Voeding aanpassen";
  $(".b-voeding", dlgBewerk).hidden = !isVoeding(v);
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
  const toon = (sel, zichtbaar) => ($(sel).closest(".veld").hidden = !zichtbaar);
  toon("#b-kolf", heeft("kolven") || getal(v.kolf));
  toon("#b-kunst", heeft("fles") || getal(v.kunst));
  const borst = heeft("borst") || getal(v.borstL) || getal(v.borstR) || v.eindKant;
  toon("#b-links", borst);
  toon("#b-rechts", borst);
  toon("#b-eind", borst);
  dlgBewerk.showModal();
}

dlgBewerk.addEventListener("close", () => {
  const oud = voedingen.find((x) => x.id === bewerkId);
  if (dlgBewerk.returnValue === "opslaan" && oud) {
    const tijd = new Date($("#b-tijd").value).getTime();
    const basis = { tijd: Number.isFinite(tijd) ? tijd : oud.tijd };
    if (isLuier(oud)) {
      const opmerking = $("#b-opmerking").value.trim().slice(0, 200);
      store.update(bewerkId, { ...basis, nat: $("#b-nat").checked, poep: $("#b-poep").checked, ...(opmerking || "opmerking" in oud ? { opmerking: opmerking || null } : {}) });
    } else if (isSlaap(oud)) {
      const eind = $("#b-wakker").value ? new Date($("#b-wakker").value).getTime() : null;
      if (eind && (eind < basis.tijd || eind - basis.tijd > 24 * 36e5)) return toast("De wektijd moet na het begin liggen, en hoogstens 24 uur later.");
      store.update(bewerkId, { ...basis, eind });
    } else if (isMeting(oud)) {
      const gewicht = getal($("#b-gewicht").value) || null;
      const lengte = Math.round(parseFloat(String($("#b-lengte").value).replace(",", ".")) * 10) || null;
      if (!gewicht && !lengte) return toast("Vul een gewicht of lengte in.");
      store.update(bewerkId, { ...basis, gewicht, lengte });
    } else if (isHapje(oud)) {
      const wat = $("#b-wat").value.trim().slice(0, 40);
      if (!wat) return toast("Vul in wat er geproefd is.");
      store.update(bewerkId, { ...basis, wat, reactie: $("#b-reactie").value || null });
    } else store.update(bewerkId, isKolven(oud)
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
  $("#i-versie").textContent = `Versie ${APP_VERSIE}`;
  for (const inp of $$("[data-aan]")) inp.checked = heeft(inp.dataset.aan);
  $("#i-kind").value = kindNaam();
  $("#i-geboren").value = kind.geboortedatum || "";
  $("#i-nacht").checked = nachtAan;
  $("#i-oppas").hidden = !isGedeeld();
  werkThemaKeuzeBij();
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
  // Kind: alleen schrijven als er iets veranderd is.
  const nieuwKind = { kind: $("#i-kind").value.trim().slice(0, 30), geboortedatum: $("#i-geboren").value || null };
  if (nieuwKind.kind !== kindNaam() || nieuwKind.geboortedatum !== (kind.geboortedatum || null)) {
    kind = { ...kind, ...nieuwKind };
    ls.set("kind", kind);
    store?.zetGezin?.(nieuwKind, naam || "");
    renderAlles();
  }
});
$("#i-nacht").addEventListener("change", (e) => {
  nachtAan = e.target.checked;
  ls.set("nachtstand", nachtAan);
  pasNachtToe();
});
$("#i-oppaslink").addEventListener("click", async () => {
  const url = `${koppelLink()}&oppas=1`;
  try {
    if (navigator.share) return void (await navigator.share({ title: "Babyvoeding (oppas)", text: "Open deze link om vandaag bij te houden:", url }));
  } catch (e) {
    if (e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast("Oppaslink gekopieerd");
  } catch {
    prompt("Kopieer deze link:", url);
  }
});

for (const inp of $$("[data-aan]")) {
  inp.addEventListener("change", () => {
    const nieuw = { ...aanUit, [inp.dataset.aan]: inp.checked };
    if (!ONDERDELEN.some((o) => nieuw[o] !== false)) {
      inp.checked = true;
      $("#i-status").textContent = "Laat minstens één onderdeel aan.";
      return;
    }
    aanUit = nieuw;
    ls.set("onderdelen", aanUit);
    pasOnderdelenToe();
    renderAlles();
  });
}

function werkThemaKeuzeBij() {
  for (const b of $$(".themakeuze button")) b.classList.toggle("aan", b.dataset.thema === themaKeuze);
  const nu = SEIZOENEN.find((s) => s.thema === seizoensThema());
  $("#thema-uitleg").textContent = themaKeuze === "auto"
    ? `Auto: ${SEIZOENEN.map((s) => `${s.naam.toLowerCase()} ${s.periode ? "" : "van "}${s.uitleg}`).join(", ")}, en de verjaardag van jullie kind. Nu: ${seizoensThema() === "verjaardag" ? "verjaardag" : nu ? nu.naam.toLowerCase() : "gewoon"}.`
    : "Geldt voor deze telefoon.";
}
for (const b of $$(".themakeuze button")) {
  b.addEventListener("click", () => {
    themaKeuze = b.dataset.thema;
    ls.set("themaKeuze", themaKeuze);
    pasThemaToe(true);
    werkThemaKeuzeBij();
    renderOverzicht();
  });
}

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
// Groen bolletje: alles gedeeld. Oranje: nog niet. Duurt dat langer dan een halve minuut,
// dan staat er tekst bij. Tikken verbindt opnieuw.
let laatsteMeta = null;
let probleemSinds = 0;
let laatstHerverbonden = 0;
function zetSync(meta = laatsteMeta) {
  const el = $("#sync");
  if (!store?.gedeeld) {
    el.className = "sync lokaal";
    el.title = "Alleen lokaal";
    return;
  }
  const wacht = !meta || meta.wachtend || meta.uitCache || !navigator.onLine;
  if (!wacht) probleemSinds = 0;
  else probleemSinds ||= Date.now();
  const probleem = wacht && Date.now() - probleemSinds > 30000;
  el.className = "sync " + (wacht ? "wacht" : "ok") + (probleem ? " probleem" : "");
  el.textContent = probleem ? (navigator.onLine ? "Geen verbinding" : "Offline") : "";
  el.title = wacht ? "Nog niet gesynchroniseerd: tik om opnieuw te verbinden" : "Gesynchroniseerd";
}
function herverbind() {
  if (!store?.herverbind || !navigator.onLine) return;
  laatstHerverbonden = Date.now();
  store.herverbind();
}
function syncMelding() {
  if (!store?.gedeeld) return toast("Deze telefoon deelt niets: er is geen database ingesteld.");
  if (!navigator.onLine) return toast("Geen internet. Wat je nu invult, wordt gedeeld zodra er weer verbinding is.");
  const wacht = !laatsteMeta || laatsteMeta.wachtend || laatsteMeta.uitCache;
  herverbind();
  toast(wacht
    ? "Opnieuw verbinden..."
    : "Alles is gedeeld. Voor de zekerheid opnieuw verbonden.");
}

// De lokale opslag van de browser is weggevallen (vooral iPhone na lang op de achtergrond).
// Herladen herstelt dat; niet terwijl iemand iets aan het invullen is.
let moetHerladen = false;
function herlaadVeilig() {
  const bezig = [...document.querySelectorAll("dialog")].some((d) => d.open)
    || document.activeElement?.matches?.("input, textarea, select");
  if (document.hidden) return void (moetHerladen = true);
  if (bezig) return toast("De verbinding met de opslag is weggevallen.", "Herladen", () => location.reload());
  let vorige = 0;
  try { vorige = Number(sessionStorage.getItem("herladenOm")) || 0; } catch {}
  if (Date.now() - vorige < 60000) return toast("De verbinding met de opslag is weggevallen.", "Herladen", () => location.reload());
  try { sessionStorage.setItem("herladenOm", String(Date.now())); } catch {}
  location.reload();
}
window.addEventListener("opslagkapot", herlaadVeilig);
window.addEventListener("unhandledrejection", (e) => isKapot(e.reason) && herlaadVeilig());
window.addEventListener("error", (e) => isKapot(e.error || e.message) && herlaadVeilig());

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

  pasOppasToe();
  pasNachtToe();
  pasOnderdelenToe();
  toonModus(kolfLoopt() && !borstLoopt() && heeft("kolven") ? "kolven" : borstLoopt() && heeft("borst") ? "borst" : modus);
  zetTijden();
  werkTimersBij();

  try {
    store = await maakStore(gezin);
  } catch (e) {
    console.error(e);
    toast("Kon de database niet laden. Controleer de verbinding.");
    return;
  }
  store.subscribe(
    (lijst, meta) => {
      voedingen = lijst;
      laatsteMeta = meta;
      zetSync(meta);
      renderAlles();
    },
    (fout) => {
      // De store probeert het zelf opnieuw; het bolletje laat zien dat het nog niet lukt.
      console.error(fout);
      if (fout.code === "permission-denied") toast("Geen toegang tot de gedeelde gegevens. Controleer de koppeling.");
      zetSync();
    },
  );
  store.volgGezin?.((g) => {
    kind = { kind: g.kind || "", geboortedatum: g.geboortedatum || null };
    ls.set("kind", kind);
    pasThemaToe();
    renderAlles();
  });
  store.volgAltijd?.((lijst) => {
    altijd = lijst;
    if (!$("#tab-overzicht").hidden) renderOverzicht();
    renderHapjes();
  });
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
  window.addEventListener("online", () => {
    zetSync();
    herverbind();
  });
  window.addEventListener("offline", () => zetSync());
  $("#sync").addEventListener("click", syncMelding);
  // Waakhond: lukt het delen al even niet terwijl er internet is, zelf opnieuw verbinden.
  setInterval(() => {
    zetSync();
    if (probleemSinds && Date.now() - probleemSinds > 15000 && Date.now() - laatstHerverbonden > 30000) herverbind();
  }, 5000);
  window.addEventListener("timerverouderd", () => toast("Deze telefoon liep achter. De actuele timerstand is teruggehaald."));
  window.addEventListener("alopgeslagen", () => toast("Deze sessie was al opgeslagen op de andere telefoon."));
  window.addEventListener("opslagfout", (e) => {
    const { fout, doc, id } = e.detail || {};
    // Nieuwe soorten registraties (slaap, meting, hapje) hebben nieuwe databaseregels nodig.
    if (fout?.code === "permission-denied") return toast("Opslaan geweigerd: de databaseregels in Firebase zijn nog niet bijgewerkt.");
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
    renderSlaap();
    pasNachtToe();
    zetTijden();
  }, 30000);
  let verborgenSinds = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return void (verborgenSinds = Date.now());
    if (moetHerladen) return herlaadVeilig();
    // Terug in de app: thema en nachtstand bijwerken (de tijd kan veranderd zijn) en even het moment tonen.
    pasNachtToe();
    pasThemaToe(true);
    // Terug in de app na een tijd weg: de verbinding kan stil zijn blijven hangen
    // (groen bolletje, maar geen nieuwe gegevens). Opnieuw verbinden haalt alles op.
    if (verborgenSinds && Date.now() - verborgenSinds > 20000) herverbind();
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
  // Nieuwe versie van de app gevonden: één keer herladen zodat hij direct actief is.
  let herladen = !navigator.serviceWorker.controller; // eerste bezoek: niet herladen
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (herladen || $("#dlg-kies").open || $("#dlg-bewerk").open || $("#dlg-start").open) return;
    herladen = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => {
    document.addEventListener("visibilitychange", () => !document.hidden && reg.update().catch(() => {}));
  }).catch(() => {});
}
