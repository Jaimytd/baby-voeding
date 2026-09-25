import { maakStore, isGedeeld } from "./store.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const PRESETS = [30, 60, 90, 120];
const DAGEN_ZICHTBAAR_START = 7;

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

function dagLabel(t) {
  const vandaag = dagStart(Date.now());
  const d = dagStart(t);
  if (d === vandaag) return "Vandaag";
  if (d === vandaag - 864e5 || Math.round((vandaag - d) / 864e5) === 1) return "Gisteren";
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
  const delen = [];
  const L = getal(v.borstL);
  const R = getal(v.borstR);
  const eind = v.eindKant ? `laatst ${v.eindKant}` : "";
  if (L || R || eind) {
    const tekst = [L && `L ${L}m`, R && `R ${R}m`, eind].filter(Boolean).join(" · ");
    delen.push({ soort: "borst", tekst: L || R ? tekst : `Borst, ${eind}` });
  }
  if (getal(v.kolf)) delen.push({ soort: "kolf", tekst: `${v.kolf} ml moedermelk` });
  if (getal(v.kunst)) delen.push({ soort: "kunst", tekst: `${v.kunst} ml kunstvoeding` });
  return delen;
}

function totalen(lijst) {
  const t = { kolf: 0, kunst: 0, L: 0, R: 0, aantal: lijst.length };
  for (const v of lijst) {
    t.kolf += getal(v.kolf);
    t.kunst += getal(v.kunst);
    t.L += getal(v.borstL);
    t.R += getal(v.borstR);
  }
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

// ---------- invoerformulier ----------
const form = $("#invoer");
const tijdInput = $("#tijd");
const kolfInput = $("#kolf");
const kunstInput = $("#kunst");
let tijdHandmatig = false;

function zetTijdNu() {
  tijdHandmatig = false;
  tijdInput.value = uurMin(timer.begin || Date.now());
}

function tijdUitInvoer() {
  const [u, m] = tijdInput.value.split(":").map(Number);
  const d = new Date();
  d.setHours(u, m, 0, 0);
  // Tijd in de toekomst (bijv. 23:50 ingevuld om 00:10): dan was het gisteren.
  if (d.getTime() > Date.now() + 5 * 60000) d.setDate(d.getDate() - 1);
  return d.getTime();
}

tijdInput.addEventListener("input", () => (tijdHandmatig = true));
$("#knop-nu").addEventListener("click", () => {
  timer.begin = null;
  bewaarTimer();
  zetTijdNu();
});

// Hoeveelheden (stepper + snelkeuzes)
for (const blok of $$(".soort[data-soort]")) {
  const input = $("input", blok);
  const chips = $(".chips", blok);
  for (const ml of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pil";
    b.textContent = ml;
    b.dataset.ml = ml;
    b.addEventListener("click", () => {
      input.value = getal(input.value) === ml ? 0 : ml;
      werkFormBij();
    });
    chips.append(b);
  }
  for (const s of $$(".stap", blok)) {
    s.addEventListener("click", () => {
      input.value = Math.min(500, Math.max(0, getal(input.value) + Number(s.dataset.stap)));
      werkFormBij();
    });
  }
  input.addEventListener("input", werkFormBij);
  input.addEventListener("focus", () => input.select());
}

// Borsttimers. Staat in localStorage zodat hij doorloopt als de app sluit of het scherm uitgaat.
const leegTimer = () => ({ L: { acc: 0, start: null }, R: { acc: 0, start: null }, begin: null, laatst: null });
let timer = ls.get("borsttimer", null) || leegTimer();
const bewaarTimer = () => ls.set("borsttimer", timer);
const seconden = (k) => timer[k].acc + (timer[k].start ? (Date.now() - timer[k].start) / 1000 : 0);
const minutenVan = (k) => {
  const s = seconden(k);
  return s > 0 ? Math.max(1, Math.round(s / 60)) : 0;
};
const loopt = () => Boolean(timer.L.start || timer.R.start);

function pauzeer(k) {
  if (!timer[k].start) return;
  timer[k].acc = seconden(k);
  timer[k].start = null;
}

function wisselTimer(k) {
  if (timer[k].start) {
    pauzeer(k);
  } else {
    pauzeer(k === "L" ? "R" : "L");
    timer[k].start = Date.now();
    timer.laatst = k;
    if (!timer.begin) {
      timer.begin = Date.now();
      if (!tijdHandmatig) tijdInput.value = uurMin(timer.begin);
    }
  }
  bewaarTimer();
  werkTimersBij();
  werkFormBij();
}

for (const kant of $$(".kant")) {
  const k = kant.dataset.kant;
  $(".timer", kant).addEventListener("click", () => wisselTimer(k));
  const inp = $(".minuten input", kant);
  inp.addEventListener("input", () => {
    // Handmatig typen overschrijft de timer van deze kant.
    timer[k].start = null;
    timer[k].acc = getal(inp.value) * 60;
    if (getal(inp.value) && !timer.laatst) timer.laatst = k;
    bewaarTimer();
    werkTimersBij(true);
    werkFormBij();
  });
  inp.addEventListener("focus", () => inp.select());
}

for (const knop of $$(".segment button")) {
  knop.addEventListener("click", () => {
    timer.laatst = timer.laatst === knop.dataset.eind ? null : knop.dataset.eind;
    bewaarTimer();
    werkTimersBij();
    werkFormBij();
  });
}

function werkTimersBij(nietInvullen = false) {
  for (const knop of $$(".segment button")) {
    const aan = knop.dataset.eind === timer.laatst;
    knop.classList.toggle("aan", aan);
    knop.setAttribute("aria-pressed", aan);
  }
  for (const kant of $$(".kant")) {
    const k = kant.dataset.kant;
    const actief = Boolean(timer[k].start);
    const s = seconden(k);
    kant.classList.toggle("actief", actief);
    $(".timer-icoon", kant).textContent = actief ? "❚❚" : "▶";
    $(".timer-tijd", kant).textContent = s > 0 ? mmss(s) : "Start";
    const inp = $(".minuten input", kant);
    if (!nietInvullen && document.activeElement !== inp) inp.value = s > 0 ? minutenVan(k) : "";
  }
}

function werkFormBij() {
  for (const blok of $$(".soort[data-soort]")) {
    const v = getal($("input", blok).value);
    for (const c of $$(".pil", blok)) c.classList.toggle("gekozen", Number(c.dataset.ml) === v);
  }
  const iets = getal(kolfInput.value) || getal(kunstInput.value) || seconden("L") > 0 || seconden("R") > 0 || timer.laatst;
  $("#opslaan").disabled = !iets;
}

function resetForm() {
  kolfInput.value = 0;
  kunstInput.value = 0;
  timer = leegTimer();
  bewaarTimer();
  zetTijdNu();
  werkTimersBij();
  werkFormBij();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!tijdInput.value) zetTijdNu();
  const voeding = {
    tijd: tijdUitInvoer(),
    borstL: minutenVan("L"),
    borstR: minutenVan("R"),
    kolf: getal(kolfInput.value),
    kunst: getal(kunstInput.value),
    eindKant: timer.laatst || null,
    door: naam || "",
  };
  const vorige = { timer: structuredClone(timer), tijd: tijdInput.value, handmatig: tijdHandmatig };
  pauzeer("L");
  pauzeer("R");
  const id = store.add(voeding);
  resetForm();
  navigator.vibrate?.(30);
  toast("Opgeslagen", "Ongedaan maken", () => {
    store.remove(id);
    kolfInput.value = voeding.kolf;
    kunstInput.value = voeding.kunst;
    timer = vorige.timer;
    bewaarTimer();
    tijdInput.value = vorige.tijd;
    tijdHandmatig = vorige.handmatig;
    werkTimersBij();
    werkFormBij();
  });
});

// ---------- weergave ----------
function renderLaatste() {
  const laatste = voedingen[0];
  if (!laatste) {
    $("#laatste-sinds").textContent = "Nog niets geregistreerd";
    $("#laatste-detail").textContent = "";
  } else {
    $("#laatste-sinds").textContent = geledenTekst(laatste.tijd);
    $("#laatste-detail").textContent =
      `${dagLabel(laatste.tijd) === "Vandaag" ? "om" : dagLabel(laatste.tijd).toLowerCase()} ${uurMin(laatste.tijd)} · ` +
      onderdelen(laatste).map((o) => o.tekst).join(", ");
  }
  const metKant = voedingen.find((v) => v.eindKant);
  const pil = $("#laatste-kant");
  pil.hidden = !metKant;
  if (metKant) pil.innerHTML = `Laatst gebruikte borst: <b>${kantNaam(metKant.eindKant)}</b> <span>(${uurMin(metKant.tijd)})</span>`;
}

function totaalBlok(t) {
  const borst = t.L + t.R;
  return `
    <div class="tot kolf"><b>${t.kolf}</b><span>ml moedermelk</span></div>
    <div class="tot kunst"><b>${t.kunst}</b><span>ml kunstvoeding</span></div>
    <div class="tot"><b>${t.kolf + t.kunst}</b><span>ml totaal</span></div>
    <div class="tot borst"><b>${borst}</b><span>min borst${borst ? ` (L ${t.L} · R ${t.R})` : ""}</span></div>
    <div class="tot"><b>${t.aantal}</b><span>voedingen</span></div>`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderLijst() {
  const vandaag = dagStart(Date.now());
  $("#totalen-vandaag").innerHTML = totaalBlok(totalen(voedingen.filter((v) => dagStart(v.tijd) === vandaag)));

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
      t.kolf + t.kunst ? `${t.kolf + t.kunst} ml` : "",
      t.L + t.R ? `${t.L + t.R} min borst` : "",
      `${t.aantal}×`,
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
  $("#geschiedenis").innerHTML = html + meer || `<p class="leeg">Nog geen voedingen. Registreer de eerste hierboven.</p>`;
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

function renderAlles() {
  renderLaatste();
  renderLijst();
}

// ---------- bewerken ----------
const dlgBewerk = $("#dlg-bewerk");
let bewerkId = null;

function openBewerk(id) {
  const v = voedingen.find((x) => x.id === id);
  if (!v) return;
  bewerkId = id;
  $("#b-tijd").value = naarDatetimeLocal(v.tijd);
  $("#b-links").value = getal(v.borstL) || "";
  $("#b-rechts").value = getal(v.borstR) || "";
  $("#b-kolf").value = getal(v.kolf) || "";
  $("#b-kunst").value = getal(v.kunst) || "";
  $("#b-eind").value = v.eindKant || "";
  $("#b-door").textContent = v.door ? `Geregistreerd door ${v.door}` : "";
  dlgBewerk.showModal();
}

dlgBewerk.addEventListener("close", () => {
  if (dlgBewerk.returnValue === "opslaan" && bewerkId) {
    const tijd = new Date($("#b-tijd").value).getTime();
    const L = getal($("#b-links").value);
    const R = getal($("#b-rechts").value);
    const oud = voedingen.find((x) => x.id === bewerkId);
    store.update(bewerkId, {
      tijd: Number.isFinite(tijd) ? tijd : oud.tijd,
      borstL: L,
      borstR: R,
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
  if (!v || !confirm("Deze voeding verwijderen?")) return;
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
    ? "Gegevens worden gedeeld via Firebase en werken ook offline."
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

  zetTijdNu();
  werkTimersBij();
  werkFormBij();

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
  window.addEventListener("online", () => zetSync(laatsteMeta));
  window.addEventListener("offline", () => zetSync(laatsteMeta));
  window.addEventListener("opslagfout", (e) => toast("Opslaan mislukt: " + (e.detail?.code || "onbekende fout")));

  setInterval(() => {
    if (loopt()) werkTimersBij();
  }, 1000);
  setInterval(() => {
    renderLaatste();
    if (!tijdHandmatig && !timer.begin) zetTijdNu();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (!tijdHandmatig && !timer.begin) zetTijdNu();
    werkTimersBij();
    renderAlles();
  });
}

start();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
