// Het bewerkvenster op Android-formaten: niets buiten beeld. De knoppen onderaan staan zonder
// scrollen in beeld, ook als het venster krimpt door het toetsenbord; de tijd wordt niet
// afgekapt; een veld met de focus staat vrij van de knoppenbalk.
import { launch, telefoon, ok, eind, post, op, I, T, N } from "./helper.mjs";

const b = await launch();
const G = "venster" + Date.now();
const fouten = [];
const D = "2026-11-03";
await post(G, { tijd: I(op(D, 10)), borstL: I(12), borstR: I(9), kolf: I(60), kunst: I(90), eindKant: T("L"), door: T("Aisha") });
await post(G, { type: T("kolven"), tijd: I(op(D, 9)), kolfL: I(60), kolfR: I(70), duurL: I(12), duurR: I(14), door: T("Aisha") });
await post(G, { type: T("slaap"), tijd: I(op(D, 6)), eind: N, door: T("Jaimy") });

const { p } = await telefoon(b, { gezin: G, dev: "Pixel 7", datum: `${D}T16:00:00+01:00`, fouten });
await p.waitForSelector("#geschiedenis .iregel");

// Wat er in het open bewerkvenster mis is; leeg als alles past.
const mis = () => p.evaluate(() => {
  const d = document.querySelector("#dlg-bewerk");
  const dr = d.getBoundingClientRect();
  const uit = [];
  const naam = (e) => e.id || e.textContent.trim();
  if (dr.left < 0 || dr.top < 0 || dr.right > innerWidth + 0.5 || dr.bottom > innerHeight + 0.5) uit.push("venster buiten het scherm");
  if (d.scrollWidth > d.clientWidth + 1) uit.push("venster schuift opzij");
  for (const e of d.querySelectorAll("button, input:not([type=hidden]), select")) {
    if (!e.getClientRects().length) continue;
    const r = e.getBoundingClientRect();
    if (r.left < dr.left - 0.5 || r.right > dr.right + 0.5) uit.push(`${naam(e)} steekt opzij uit`);
    if (e.matches("button, input[type=text]") && e.scrollWidth > e.clientWidth + 1) uit.push(`${naam(e)}: tekst afgekapt`);
  }
  const balk = d.querySelector(".knoppen");
  for (const k of balk.querySelectorAll("button")) {
    const r = k.getBoundingClientRect();
    if (r.top < dr.top - 0.5 || r.bottom > dr.bottom + 0.5) uit.push(`knop ${naam(k)} niet in beeld`);
  }
  for (const e of d.querySelectorAll("input:not([type=hidden]):not([type=checkbox]), select")) {
    if (!e.getClientRects().length) continue;
    e.focus();
    const r = e.getBoundingClientRect();
    if (r.top < dr.top - 0.5 || r.bottom > balk.getBoundingClientRect().top + 14.5) uit.push(`${naam(e)} na focus achter de knoppen`);
  }
  document.activeElement?.blur();
  d.scrollTop = 0;
  return uit;
});

// Breed, gewoon, smal; en laag zoals met het toetsenbord open.
for (const [w, h] of [[412, 780], [360, 640], [320, 568], [360, 340], [320, 300]]) {
  await p.setViewportSize({ width: w, height: h });
  for (const [soort, naam] of [["borst", "voeding"], ["kolven", "kolven"], ["slaap", "slaap"]]) {
    await p.$eval(`#geschiedenis .iregel.${soort}`, (e) => e.click());
    await p.waitForTimeout(100);
    const uit = await mis();
    ok(`${w}x${h} ${naam}: alles in beeld`, (await p.$eval("#dlg-bewerk", (d) => d.open)) && uit.length === 0, uit.join("; "));
    if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/venster-${naam}-${w}x${h}.png` });
    await p.keyboard.press("Escape");
  }
}

// Toetsenbord op Android: het venster krimpt terwijl een veld de focus heeft.
await p.setViewportSize({ width: 360, height: 700 });
await p.$eval("#geschiedenis .iregel.borst", (e) => e.click());
await p.focus("#b-kunst");
await p.setViewportSize({ width: 360, height: 380 });
await p.waitForTimeout(200);
const knoppen = await p.$$eval("#form-bewerk .knoppen button", (x) => x.map((e) => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
ok("toetsenbord open: opslaan, annuleren en verwijderen in beeld", knoppen.length === 3 && knoppen.every(Boolean), JSON.stringify(knoppen));
ok("toetsenbord open: het veld staat boven de knoppen", await p.evaluate(() => document.querySelector("#b-kunst").getBoundingClientRect().bottom <= document.querySelector("#form-bewerk .knoppen").getBoundingClientRect().top + 14.5));
await p.fill("#b-kunst", "120");
await p.click("#form-bewerk button[value=opslaan]");
await p.setViewportSize({ width: 360, height: 700 });
await p.waitForTimeout(400);
ok("opslaan vanuit het lage venster werkt", /120 kunstvoeding/.test(await p.textContent("#geschiedenis")));

// Hoofdscherm: tabbalk weg zolang het toetsenbord open is, terug als het dichtgaat (ook als
// het veld de focus houdt, zoals na de terugknop van Android).
await p.click(".modus button >> text=Fles");
await p.focus("#kunst");
await p.setViewportSize({ width: 360, height: 380 });
await p.waitForTimeout(200);
const tabbalk = () => p.$eval(".tabbar", (e) => e.getClientRects().length > 0);
ok("hoofdscherm, toetsenbord open: tabbalk weg", !(await tabbalk()));
await p.setViewportSize({ width: 360, height: 700 });
await p.waitForTimeout(200);
ok("toetsenbord dicht, veld houdt focus: tabbalk terug", (await tabbalk()) && (await p.evaluate(() => document.activeElement.id)) === "kunst");

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
