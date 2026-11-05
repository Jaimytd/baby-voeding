// Gedeelde hulpjes voor de Playwright-tests. Draaien tegen de app op APP (http-server)
// en de Firestore-emulator op EMU; de Firebase-scripts van gstatic komen uit FIREBASE_PKG.
// ESM kent NODE_PATH niet: geef desnoods het pad naar playwright mee via PLAYWRIGHT.
const { chromium, devices } = await import(process.env.PLAYWRIGHT || "playwright");

export const APP = process.env.APP || "http://192.0.2.2:8765/";
export const EMU = process.env.EMU || "192.0.2.2:8080";
export const PKG = process.env.FIREBASE_PKG || "";
export const PROXY = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "192.0.2.2,localhost,127.0.0.1" } : undefined;

let geslaagd = 0, mislukt = 0;
export const ok = (naam, conditie, detail = "") => {
  conditie ? geslaagd++ : mislukt++;
  console.log((conditie ? "PASS " : "FAIL ") + naam + (detail ? ` [${String(detail).slice(0, 300)}]` : ""));
};
export const eind = async (browser) => {
  await browser?.close();
  console.log(`${geslaagd} geslaagd, ${mislukt} mislukt`);
  process.exit(mislukt ? 1 : 0);
};

export const launch = () => chromium.launch({ proxy: PROXY });

// Een telefoon: eigen context met localStorage vooraf gevuld (gezin, naam, onderdelen, thema).
export async function telefoon(browser, { gezin, naam = "Jaimy", dev = "iPhone 13", datum, opslag = {}, url = "", schema = "light", fouten = [] } = {}) {
  const ctx = await browser.newContext({ ...devices[dev], colorScheme: schema, locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  if (datum) await ctx.clock.setFixedTime(new Date(datum));
  if (PKG) {
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) =>
      r.fulfill({ path: PKG + "/" + r.request().url().split("/").pop(), contentType: "text/javascript", headers: { "access-control-allow-origin": "*" } }));
  }
  await ctx.addInitScript(({ gezin, naam, opslag, emu }) => {
    localStorage.setItem("emulator", emu);
    localStorage.setItem("naam", JSON.stringify(naam));
    localStorage.setItem("gezin", JSON.stringify(gezin));
    localStorage.setItem("themaKeuze", '"gewoon"');
    for (const [k, v] of Object.entries(opslag)) localStorage.setItem(k, JSON.stringify(v));
  }, { gezin, naam, opslag, emu: EMU });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => fouten.push(e.message));
  await p.goto(APP + url);
  await p.waitForSelector("#sync.ok", { timeout: 20000 }).catch(() => {});
  await p.addStyleTag({ content: ".themamoment{display:none!important}" }).catch(() => {});
  return { p, ctx };
}

export const tekst = async (p, sel) => ((await p.textContent(sel)) || "").replace(/\s+/g, " ").trim();
export const zichtbaar = (p, sel) => p.$eval(sel, (e) => e.getClientRects().length > 0).catch(() => false);
// Tijdkeuze in het bewerkvenster: cijfers intikken; "" maakt leeg (wakker: slaapt nog).
export const zetTijd = async (p, id, hhmm) => {
  await p.fill(`#${id}-veld`, hhmm.replace(":", ""));
  await p.$eval(`#${id}-veld`, (e) => e.blur());
};
export const tijdWaarde = (p, id) => p.$eval(`#${id}`, (e) => e.value);

// Rechtstreeks documenten in de emulator zetten (REST, als eigenaar).
const REST = () => `http://${EMU}/v1/projects/baby-voeding/databases/(default)/documents/gezinnen/`;
export const I = (n) => ({ integerValue: String(n) });
export const T = (s) => ({ stringValue: s });
export const B = (v) => ({ booleanValue: v });
export const N = { nullValue: null };
export const post = (gezin, fields) =>
  fetch(REST() + gezin + "/voedingen", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ fields }) });
export const fles = (gezin, tijd, ml, door = "Aisha") => post(gezin, { tijd: I(tijd), borstL: I(0), borstR: I(0), kolf: I(0), kunst: I(ml), eindKant: N, door: T(door) });
export const luier = (gezin, tijd, nat, poep, door = "Jaimy") => post(gezin, { type: T("luier"), tijd: I(tijd), nat: B(nat), poep: B(poep), door: T(door) });
// Tijdstip in Nederlandse tijd (zomer- en wintertijd), als getal.
function tzVerschil(t) {
  const naam = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", timeZoneName: "shortOffset" }).formatToParts(new Date(t)).find((p) => p.type === "timeZoneName").value;
  const m = /GMT([+-]\d+)(?::(\d+))?/.exec(naam);
  return m ? (parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0)) * 60000 : 0;
}
export const op = (datum, uur, minuut = 0) => {
  const [j, m, d] = datum.split("-").map(Number);
  const utc = Date.UTC(j, m - 1, d, uur, minuut);
  return utc - tzVerschil(utc);
};
export const zetKind = (gezin, kind, geboortedatum) =>
  fetch(REST() + gezin + "/status/gezin", { method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer owner" }, body: JSON.stringify({ fields: { kind: T(kind), geboortedatum: T(geboortedatum), door: T("test") } }) });
