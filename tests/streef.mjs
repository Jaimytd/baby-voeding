// Streefwaarden (4 uur, 175 ml) en het bewerkvenster met tijd groot en datum klein.
import { launch, telefoon, ok, eind, tekst, zichtbaar, fles, luier, op } from "./helper.mjs";

const b = await launch();
const G = "streef" + Date.now();
const fouten = [];
const D = "2026-11-03";
// Gisteren (2 november) zeven flessen om de 3 uur van 100 ml, vandaag twee.
for (const u of [1, 4, 7, 10, 13, 16, 19]) await fles(G, op("2026-11-02", u), 100);
await fles(G, op(D, 8), 140);
await fles(G, op(D, 11), 140);
await luier(G, op(D, 9), true, false);

let { p, ctx } = await telefoon(b, { gezin: G, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten });
await p.waitForTimeout(500);

// Snelkeuzes: 175 erbij, met een stipje als streefdoel.
const chips = await p.$$eval('.soort[data-soort=kunst] .chips .pil', (x) => x.map((c) => c.textContent + (c.classList.contains("streef") ? "*" : "")));
ok("snelkeuzes 35, 70, 105, 140, 175, zonder stip", chips.join(",") === "35,70,105,140,175", chips.join(","));

// Ritme-regel toont streef.
ok("bovenaan: gemiddeld met streef 4 u", (await tekst(p, "#v-gem small")) === "streef 4 u", await tekst(p, "#v-gem"));

// Gisteren: streef bij de tegels, nog niet gehaald.
await p.click(".tabbar [data-tab=overzicht]");
await p.waitForTimeout(400);
const blik = await tekst(p, "#gisteren");
ok("gisteren: gem. 100 ml · streef 175 (niet gehaald)", /gem\. 100 ml\s*streef 175/.test(blik), blik);
ok("gisteren: tussen flessen 3 u 00, streef 4 u", /3 u 00\s*tussen flessen\s*kortste 3 u 00\s*streef 4 u/.test(blik), blik);
ok("streef niet groen", (await p.$$eval("#gisteren .streef.gehaald", (x) => x.length)) === 0);
// Grafieken: streeflijn bij pauze en per fles.
ok("pauzegrafiek: streeflijn 4 u", Boolean(await p.$("#g-pauze .streeflijn")) && /streef 4 u/.test(await tekst(p, "#g-pauze")));
ok("grafiek per fles met streef 175", /Per fles/.test(await tekst(p, "#g-perfles")) && /175 ml/.test(await tekst(p, "#g-perfles")) && Boolean(await p.$("#g-perfles .streeflijn")));
await (await p.$("#g-perfles")).screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/s-perfles.png" : "/dev/null" }).catch(() => {});

// Streef aanpassen in Instellingen.
await p.click("#knop-instellingen");
ok("instellingen: streef 4 en 175 ingevuld", (await p.inputValue("#i-streef-uur")) === "4" && (await p.inputValue("#i-streef-ml")) === "175");
await p.fill("#i-streef-uur", "3");
await p.fill("#i-streef-ml", "100");
await p.click("#dlg-instellingen button[value=sluit]");
await p.waitForTimeout(400);
const blik2 = await tekst(p, "#gisteren");
ok("na aanpassen: streef 100 en 3 u, allebei gehaald (groen)", /streef 100/.test(blik2) && /streef 3 u/.test(blik2) && (await p.$$eval("#gisteren .streef.gehaald", (x) => x.length)) === 2, blik2);
await p.reload();
await p.waitForSelector("#sync.ok");
await p.click("#knop-instellingen");
ok("streef blijft bewaard na herladen", (await p.inputValue("#i-streef-uur")) === "3" && (await p.inputValue("#i-streef-ml")) === "100");
await p.fill("#i-streef-uur", "4");
await p.fill("#i-streef-ml", "175");
await p.click("#dlg-instellingen button[value=sluit]");
await p.click(".tabbar [data-tab=registreren]");

// Bewerken: tijd groot, datum klein, knoppen onder elkaar.
await p.click(".iregel.fles >> nth=0");
ok("bewerken: tijdveld (type time) met 11:00", (await p.getAttribute("#b-tijd", "type")) === "time" && (await p.inputValue("#b-tijd")) === "11:00", await p.inputValue("#b-tijd"));
ok("bewerken: datumveld met vandaag", (await p.getAttribute("#b-datum", "type")) === "date" && (await p.inputValue("#b-datum")) === D);
const tijdH = await p.$eval("#b-tijd-tekst", (e) => e.closest(".kiezer").getBoundingClientRect().height);
const datumH = await p.$eval("#b-datum-tekst", (e) => e.closest(".kiezer").getBoundingClientRect().height);
ok("tijdveld groter dan datumveld", tijdH > datumH, `${tijdH} vs ${datumH}`);
const knoppen = await p.$$eval("#form-bewerk .knoppen button", (x) => x.filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }));
const overlap = knoppen.some((a, i) => knoppen.some((c, j) => i !== j && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom));
ok("knoppen Opslaan, Annuleren, Verwijderen overlappen niet", !overlap && knoppen.map((k) => k.t).join(",") === "Opslaan,Annuleren,Verwijderen", JSON.stringify(knoppen));
ok("alle knoppen binnen het scherm", knoppen.every((k) => k.bottom <= 844 && k.left >= 0), JSON.stringify(knoppen));
await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/s-bewerk.png" : "/dev/null" }).catch(() => {});
// Tijd aanpassen naar 11:20, opslaan.
await p.fill("#b-tijd", "11:20");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("tijd aangepast naar 11:20, datum gelijk", /11:20/.test(await tekst(p, "#geschiedenis")) && /Vandaag/.test(await tekst(p, "#geschiedenis")), (await tekst(p, "#geschiedenis")).slice(0, 80));
// Datum aanpassen naar gisteren.
await p.click(".iregel.fles >> nth=0");
await p.fill("#b-datum", "2026-11-02");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("datum aangepast: nog één fles vandaag", (await p.$$eval('.dag[data-dag] >> nth=0 >> .iregel.fles', (x) => x.length)) === 1);
// Annuleren verandert niets.
await p.click(".iregel.fles >> nth=0");
await p.fill("#b-tijd", "03:33");
await p.click("#form-bewerk button[value=annuleer]");
await p.waitForTimeout(300);
ok("annuleren laat de tijd staan", !/03:33/.test(await tekst(p, "#geschiedenis")));

// Slaap: wektijd als tijd, over middernacht heen.
await ctx.close();
({ p, ctx } = await telefoon(b, { gezin: G, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten }));
await p.click("#slaap-knop");
await p.waitForTimeout(400);
await p.click("#slaap-knop");
await p.waitForTimeout(400);
await p.click(".iregel.slaap");
await p.fill("#b-tijd", "22:00");
await p.fill("#b-datum", "2026-11-02");
await p.fill("#b-wakker", "06:30");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("slaap 22:00 tot 06:30 over middernacht = 8 u 30", /Slaap 8 u 30/.test(await tekst(p, "#geschiedenis")), (await tekst(p, "#geschiedenis")).slice(0, 120));

// Meting: alleen datum.
await p.click(".tabbar [data-tab=overzicht]");
await p.click("#meting-toevoegen");
await p.fill("#m-gewicht", "5000");
await p.click("#form-meting button[value=opslaan]");
await p.waitForTimeout(500);
await p.click("#groei tr.tikbaar >> nth=0");
ok("meting bewerken: geen tijdveld, wel datum", !(await zichtbaar(p, "#b-tijd")) && (await zichtbaar(p, "#b-datum")));
await p.keyboard.press("Escape");

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
