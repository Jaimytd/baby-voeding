// Streefwaarden (4 uur, 175 ml) en het bewerkvenster met tijd groot en datum klein.
import { launch, telefoon, ok, eind, tekst, zichtbaar, fles, luier, op, zetKind, zetTijd, tijdWaarde } from "./helper.mjs";

const b = await launch();
const G = "streef" + Date.now();
const fouten = [];
const D = "2026-11-03";
// Gisteren (2 november) zeven flessen om de 3 uur van 100 ml, vandaag twee.
for (const u of [1, 4, 7, 10, 13, 16, 19]) await fles(G, op("2026-11-02", u), 100);
await fles(G, op(D, 8), 140);
await fles(G, op(D, 11), 140);
await luier(G, op(D, 9), true, false);
await zetKind(G, "Noor", "2026-08-15");

let { p, ctx } = await telefoon(b, { gezin: G, datum: `${D}T12:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten });
await p.waitForTimeout(500);

// Snelkeuzes: 175 erbij, met een stipje als streefdoel.
const chips = await p.$$eval('.soort[data-soort=kunst] .chips .pil', (x) => x.map((c) => c.textContent + (c.classList.contains("streef") ? "*" : "")));
ok("snelkeuzes 35, 70, 105, 140, 175, zonder stip", chips.join(",") === "35,70,105,140,175", chips.join(","));

// Ritme-regel toont streef.
ok("bovenaan: gemiddeld met streef 4 u", (await tekst(p, "#v-gem small")) === "streef 4 u", await tekst(p, "#v-gem"));
// Geschiedenis: tussen twee voedingen staat de tijd ertussen; de nacht van 13 uur telt niet mee.
{
  const vandaag = await p.$$eval(".dag[data-dag] >> nth=0 >> .tussen", (x) => x.map((g) => g.textContent.trim() + (g.classList.contains("gehaald") ? "!" : "")));
  const gisteren = await p.$$eval(".dag[data-dag] >> nth=1 >> .tussen", (x) => x.map((g) => g.textContent.trim()));
  ok("geschiedenis: 'na 3 u 00' achter de hoeveelheid, vandaag één keer, gisteren zes", vandaag.join("|") === "na 3 u 00" && gisteren.join("|") === "na 3 u 00|na 3 u 00|na 3 u 00|na 3 u 00|na 3 u 00|na 3 u 00" && (await p.$eval(".dag[data-dag] >> nth=0 >> .tussen", (e) => e.closest(".ikop") !== null)), vandaag.join("|") + " / " + gisteren.join("|"));
  ok("Vandaag toont alleen totalen", !(await p.$("#totalen-vandaag .tijden")) && !(await p.$("#totalen-vandaag .tijdlijn")));
}

// Gisteren: streef bij de tegels, nog niet gehaald.
await p.click(".tabbar [data-tab=overzicht]");
await p.waitForTimeout(400);
const blik = await tekst(p, "#gisteren");
ok("gisteren: gem. 100 ml · streef 175 (niet gehaald)", /gem\. 100 ml\s*streef 175/.test(blik), blik);
ok("gisteren: tussen flessen 3 u 00, streef 4 u", /3 u 00\s*tussen flessen\s*kortste 3 u 00\s*streef 4 u/.test(blik), blik);
ok("streef niet groen", (await p.$$eval("#gisteren .streef.gehaald", (x) => x.length)) === 0);
{
  const tegels = await p.$$eval("#gisteren .tegel", (x) => x.map((e) => Math.round(e.getBoundingClientRect().width)));
  ok("vijf tegels: de laatste over de volle breedte", tegels.length === 5 && tegels[4] > tegels[0] * 1.8, tegels.join(","));
}
ok("tijd tussen voedingen als staven met streeflijn", (await p.$$eval("#g-pauze rect", (x) => x.length)) >= 1 && Boolean(await p.$("#g-pauze .streeflijn")) && /gem\. 3:00 tussen voedingen/.test(await tekst(p, "#g-pauze")), (await tekst(p, "#g-pauze")).slice(0, 80));
ok("luiers: poep als bruin deel met aantal erin", /met poep/.test(await tekst(p, "#g-luiers")) && (await p.$$eval("#g-luiers rect", (x) => x.length)) >= 1 && /met poep per dag/.test(await tekst(p, "#g-luiers")));
ok("dagritme onder Meer", await p.$eval("#g-ritme", (e) => e.closest("#meer") !== null));
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
ok("bewerken: tijdveld toont 11:00", (await p.inputValue("#b-tijd-veld")) === "11:00" && (await tijdWaarde(p, "b-tijd")) === "11:00", await tijdWaarde(p, "b-tijd"));
ok("bewerken: datumveld met vandaag", (await p.getAttribute("#b-datum", "type")) === "date" && (await p.inputValue("#b-datum")) === D);
const tijdH = await p.$eval("#b-tijd-veld", (e) => e.closest(".kiezer").getBoundingClientRect().height);
const datumH = await p.$eval("#b-datum-tekst", (e) => e.closest(".kiezer").getBoundingClientRect().height);
ok("tijdveld groter dan datumveld", tijdH > datumH, `${tijdH} vs ${datumH}`);
const knoppen = await p.$$eval("#form-bewerk .knoppen button", (x) => x.filter((b) => b.getClientRects().length).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; }));
const overlap = knoppen.some((a, i) => knoppen.some((c, j) => i !== j && a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom));
ok("knoppen Opslaan, Annuleren, Verwijderen overlappen niet", !overlap && knoppen.map((k) => k.t).join(",") === "Opslaan,Annuleren,Verwijderen", JSON.stringify(knoppen));
ok("alle knoppen binnen het scherm", knoppen.every((k) => k.bottom <= 844 && k.left >= 0), JSON.stringify(knoppen));
await p.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + "/s-bewerk.png" : "/dev/null" }).catch(() => {});
// Tijd aanpassen naar 11:20, opslaan.
await zetTijd(p, "b-tijd", "11:20");
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
await zetTijd(p, "b-tijd", "03:33");
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
await zetTijd(p, "b-tijd", "22:00");
await p.fill("#b-datum", "2026-11-02");
await zetTijd(p, "b-wakker", "06:30");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("slaap 22:00 tot 06:30 over middernacht = 8 u 30", /Slaap 8 u 30/.test(await tekst(p, "#geschiedenis")), (await tekst(p, "#geschiedenis")).slice(0, 120));

// Meting: alleen datum. Zonder metingen staat Groei onder "Meer".
await p.click(".tabbar [data-tab=overzicht]");
await p.waitForTimeout(300);
ok("zonder metingen staat Groei onder Meer", await p.$eval("#groei", (e) => e.parentElement.id === "meer"));
await p.click("#meer > summary");
await p.click("#meting-toevoegen");
await p.fill("#m-gewicht", "5000");
await p.fill("#m-lengte", "58");
await p.click("#form-meting button[value=opslaan]");
await p.waitForTimeout(500);
ok("met een meting staat Groei vooraan", await p.$eval("#groei", (e) => e.parentElement.id === "tab-overzicht"));
await p.waitForTimeout(800);
ok("groei: vijf WHO-curven bij gewicht en bij lengte", (await p.$$eval("#groei .curve", (x) => x.length)) === 10, String(await p.$$eval("#groei .curve", (x) => x.length)));
const gr = await tekst(p, "#groei");
ok("groei: percentiel bij gewicht en lengte (meisje)", /WHO-curve, meisje/.test(gr) && /5,00 kg\s*3 november · P\d+/.test(gr) && /58,0 cm\s*3 november · P\d+/.test(gr), gr.slice(0, 200));
const pMeisje = /kg\s*3 november · P(\d+)/.exec(gr)?.[1];
await p.click("#knop-instellingen");
await p.click(".geslachtkeuze [data-geslacht=jongen]");
await p.click("#dlg-instellingen button[value=sluit]");
await p.waitForTimeout(300);
const gr2 = await tekst(p, "#groei");
const pJongen = /kg\s*3 november · P(\d+)/.exec(gr2)?.[1];
ok("jongen: andere curve, lager percentiel voor hetzelfde gewicht", /WHO-curve, jongen/.test(gr2) && Number(pJongen) < Number(pMeisje), `${pMeisje} vs ${pJongen}`);
if (process.env.SHOT_DIR) await (await p.$("#groei")).screenshot({ path: process.env.SHOT_DIR + "/s-groei.png" });
await p.click("#knop-instellingen");
await p.click(".geslachtkeuze [data-geslacht=meisje]");
await p.click("#dlg-instellingen button[value=sluit]");
await p.click("#groei tr.tikbaar >> nth=0");
ok("meting bewerken: geen tijdveld, wel datum", !(await zichtbaar(p, "#b-tijd-veld")) && (await zichtbaar(p, "#b-datum")));
await p.keyboard.press("Escape");

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
