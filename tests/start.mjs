// Het startscherm: laatste voeding, en de drie cellen verwacht, bij streef, gemiddeld.
// Plus de tijd- en datumkiezers in het bewerkvenster met eigen opmaak.
import { launch, telefoon, ok, eind, tekst, zichtbaar, fles, op, zetTijd, tijdWaarde } from "./helper.mjs";

const b = await launch();
const G = "start" + Date.now();
const fouten = [];
const D = "2026-11-03";
// Vannacht en vandaag flessen om de 3 uur; de laatste om 14:00.
for (const u of [2, 5, 8, 11, 14]) await fles(G, op(D, u), 120);

let { p, ctx } = await telefoon(b, { gezin: G, datum: `${D}T16:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten });
await p.waitForTimeout(500);
const cel = async (id) => ({ b: await tekst(p, `${id} b`), span: await tekst(p, `${id} span`), small: await tekst(p, `${id} small`) });
ok("laatste voeding: 2 u 00 geleden, om 14:00", (await tekst(p, "#laatste-sinds")) === "2 u 00 geleden" && /om 14:00 · 120 ml kunstvoeding/.test(await tekst(p, "#laatste-detail")), await tekst(p, "#laatste-detail"));
ok("geen regel 'afgelopen 24 uur' meer", !(await p.$("#laatste-ritme")));
let v = await cel("#v-verwacht");
ok("verwacht: 16:45, over 45 min (gem. 3 u min 15 min)", v.b === "16:45" && v.span === "verwacht" && v.small === "over 45 min", JSON.stringify(v));
v = await cel("#v-streef");
ok("bij 4 u: 17:45, over 1 u 45", v.b === "17:45" && v.span === "bij 4 u" && v.small === "over 1 u 45", JSON.stringify(v));
v = await cel("#v-gem");
ok("gemiddeld 3 u 00, streef 4 u, niet groen", v.b === "3 u 00" && v.span === "gemiddeld" && v.small === "streef 4 u" && !(await p.$eval("#v-gem", (e) => e.classList.contains("gehaald"))), JSON.stringify(v));
// Drie cellen even breed en op één rij.
const cellen = await p.$$eval(".vooruit .vcel", (x) => x.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.top)]; }));
ok("drie cellen even breed op één rij", cellen.length === 3 && new Set(cellen.map((c) => c[1])).size === 1 && new Set(cellen.map((c) => c[2])).size === 1, JSON.stringify(cellen));
ok("geen horizontale scroll", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
if (process.env.SHOT_DIR) await (await p.$(".laatste")).screenshot({ path: process.env.SHOT_DIR + "/st-boven.png" });

// Tijd verstrijkt: verwacht voorbij (oranje), bij 4 u nog niet.
await ctx.clock.setFixedTime(new Date(`${D}T17:10:00+01:00`));
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(300);
v = await cel("#v-verwacht");
ok("verwacht voorbij: 25 min geleden, oranje", v.small === "25 min geleden" && (await p.$eval("#v-verwacht", (e) => e.classList.contains("voorbij"))), JSON.stringify(v));
ok("bij 4 u nog niet voorbij", !(await p.$eval("#v-streef", (e) => e.classList.contains("voorbij"))));
if (process.env.SHOT_DIR) await (await p.$(".laatste")).screenshot({ path: process.env.SHOT_DIR + "/st-voorbij.png" });

// Laatste voeding ouder dan een dag: geen cellen.
await ctx.clock.setFixedTime(new Date(`2026-11-04T16:00:00+01:00`));
await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
await p.waitForTimeout(300);
ok("na een dag zonder voeding: cellen weg", await p.$eval("#vooruit", (e) => e.hidden));

// Gemiddelde gehaald: groen.
await ctx.close();
const G2 = G + "b";
for (const u of [2, 6.5, 11]) await fles(G2, op(D, Math.floor(u), (u % 1) * 60), 120);
({ p, ctx } = await telefoon(b, { gezin: G2, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten }));
await p.waitForTimeout(500);
ok("gemiddeld 4 u 30: groen", (await tekst(p, "#v-gem b")) === "4 u 30" && (await p.$eval("#v-gem", (e) => e.classList.contains("gehaald"))));

// Bewerkvenster: tijd intikken of met -5/+5, datum met eigen opmaak en native kiezer eroverheen.
await p.click(".iregel.fles >> nth=0");
ok("tijdveld 11:00 in 24-uursnotatie, geen native tijdkiezer of keuzelijst", (await p.inputValue("#b-tijd-veld")) === "11:00" && (await tijdWaarde(p, "b-tijd")) === "11:00" && (await p.$$eval("#dlg-bewerk input[type=time], #dlg-bewerk .tijdkeuze select", (x) => x.length)) === 0);
await p.click("#b-tijd-veld ~ .tijdstap[data-stap='5']");
await p.click("#b-tijd-veld ~ .tijdstap[data-stap='5']");
await p.click(".tijdstap[data-stap='-5'] + #b-tijd-veld");
ok("+5 +5: 11:10", (await tijdWaarde(p, "b-tijd")) === "11:10" && (await p.inputValue("#b-tijd-veld")) === "11:10", await tijdWaarde(p, "b-tijd"));
await p.type("#b-tijd-veld", "935");
await p.$eval("#b-tijd-veld", (e) => e.blur());
ok("'935' ingetikt wordt 09:35", (await tijdWaarde(p, "b-tijd")) === "09:35", await tijdWaarde(p, "b-tijd"));
await p.fill("#b-tijd-veld", "2599");
await p.$eval("#b-tijd-veld", (e) => e.blur());
ok("ongeldig '2599' valt terug op 09:35", (await tijdWaarde(p, "b-tijd")) === "09:35" && (await p.inputValue("#b-tijd-veld")) === "09:35");
await p.fill("#b-tijd-veld", "");
await p.$eval("#b-tijd-veld", (e) => e.blur());
ok("leeg laten houdt de tijd", (await tijdWaarde(p, "b-tijd")) === "09:35");
ok("datumtekst 'di 3 nov'", (await tekst(p, "#b-datum-tekst")) === "di 3 nov", await tekst(p, "#b-datum-tekst"));
await zetTijd(p, "b-tijd", "09:30");
await p.fill("#b-datum", "2026-11-01");
ok("waarde volgt de keuze: 09:30 en zo 1 nov", (await tijdWaarde(p, "b-tijd")) === "09:30" && (await tekst(p, "#b-datum-tekst")) === "zo 1 nov", (await tekst(p, "#b-datum-tekst")));
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(400);
ok("opgeslagen op zo 1 nov 09:30", /zo 1 nov/.test(await tekst(p, "#geschiedenis")) && /09:30/.test(await tekst(p, "#geschiedenis")), (await tekst(p, "#geschiedenis")).slice(0, 160));
if (process.env.SHOT_DIR) { await p.click(".iregel.fles >> nth=0"); await p.screenshot({ path: process.env.SHOT_DIR + "/st-bewerk.png" }); await p.keyboard.press("Escape"); }

// Met een thema: naam en leeftijd op een labeltje over de versiering.
await ctx.close();
const { zetKind } = await import("./helper.mjs");
await zetKind(G2, "Noor", "2026-08-15");
({ p, ctx } = await telefoon(b, { gezin: G2, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false }, themaKeuze: "kerst" }, fouten }));
await p.waitForTimeout(500);
const label = await p.$eval("#leeftijd", (e) => { const s = getComputedStyle(e); return { tekst: e.textContent, bg: s.backgroundColor, radius: s.borderRadius, rechts: Math.round(e.getBoundingClientRect().right) }; });
ok("naam en leeftijd op een labeltje (thema)", label.tekst === "Noor · 11 weken" && label.bg !== "rgba(0, 0, 0, 0)" && label.radius === "999px" && label.rechts <= 390, JSON.stringify(label));
await ctx.close();
({ p, ctx } = await telefoon(b, { gezin: G2, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten }));
await p.waitForTimeout(500);
ok("zonder thema gewone tekst", (await p.$eval("#leeftijd", (e) => getComputedStyle(e).backgroundColor)) === "rgba(0, 0, 0, 0)");

// Streef kiezen vanaf het startscherm: tik op de cel "bij 4 u".
await p.click("#v-streef");
ok("streefvenster open met 4 u en 175 ml gekozen", (await p.$eval("#dlg-streef", (d) => d.open)) && (await tekst(p, "#streef-uren .pil.gekozen")) === "4 u" && (await tekst(p, "#streef-mls .pil.gekozen")) === "175 ml");
await p.click('#streef-uren [data-uur="3.5"]');
await p.click('#streef-mls [data-ml="140"]');
await p.click("#dlg-streef button[value=sluit]");
await p.waitForTimeout(300);
ok("streef 3 u 30: cel 'bij 3 u 30', gemiddeld toont streef 3 u 30", (await tekst(p, "#v-streef span")) === "bij 3 u 30" && (await tekst(p, "#v-gem small")) === "streef 3 u 30", await tekst(p, "#v-streef"));
if (process.env.SHOT_DIR) { await p.click("#v-streef"); await p.screenshot({ path: process.env.SHOT_DIR + "/s-streef.png" }); await p.click("#dlg-streef button[value=sluit]"); }
await p.click("#knop-instellingen");
ok("instellingen volgen: 3.5 en 140", (await p.inputValue("#i-streef-uur")) === "3.5" && (await p.inputValue("#i-streef-ml")) === "140");
await p.click("#dlg-instellingen button[value=sluit]");

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
