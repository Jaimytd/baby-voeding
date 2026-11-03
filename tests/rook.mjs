// Rooktest: de belangrijkste handelingen op twee telefoons, zonder JS-fouten.
import { launch, telefoon, ok, eind, tekst, zichtbaar } from "./helper.mjs";

const b = await launch();
const G = "rook" + Date.now();
const fouten = [];
const J = await telefoon(b, { gezin: G, naam: "Jaimy", fouten });
const A = await telefoon(b, { gezin: G, naam: "Aisha", dev: "Pixel 7", fouten });

// Fles op Jaimy, zichtbaar bij Aisha.
await J.p.click(".modus [data-modus=fles]");
await J.p.click('.soort[data-soort=kunst] .pil[data-ml="105"]');
await J.p.click("#invoer .opslaan");
await J.p.waitForTimeout(300);
if (await J.p.$eval("#dlg-kies", (d) => d.open)) await J.p.click("#kies-knoppen button >> nth=0");
await A.p.waitForTimeout(1500);
ok("fles van Jaimy komt bij Aisha", /Kunstvoeding\s*105 ml/.test(await tekst(A.p, "#geschiedenis")), (await tekst(A.p, "#geschiedenis")).slice(0, 80));

// Luier op Aisha, zichtbaar bij Jaimy.
await A.p.click("#luierkaart [data-luier=nat]");
await J.p.waitForTimeout(1500);
ok("luier van Aisha komt bij Jaimy", /Luier\s*nat/.test(await tekst(J.p, "#geschiedenis")));

// Borsttimer gedeeld.
await J.p.click(".modus [data-modus=borst]");
await J.p.click(".kant[data-kant=L] .timer");
await A.p.waitForTimeout(1500);
ok("borsttimer links loopt ook bij Aisha", await A.p.$eval(".kant[data-kant=L]", (e) => e.classList.contains("actief")));
await J.p.click("#wis-borst");
await A.p.waitForTimeout(1200);
ok("wissen komt door", !(await A.p.$eval(".kant[data-kant=L]", (e) => e.classList.contains("actief"))));

// Kolven: timer en opbrengst.
await J.p.click(".modus [data-modus=kolven]");
await J.p.click('[data-soort=kolfL] .pil[data-ml="60"]');
await J.p.click('[data-soort=kolfR] .pil[data-ml="40"]');
await J.p.click("#kolfinvoer .opslaan");
await J.p.waitForTimeout(300);
if (await J.p.$eval("#dlg-kies", (d) => d.open)) await J.p.click("#kies-knoppen button >> nth=0");
await A.p.waitForTimeout(1500);
ok("kolven 100 ml bij Aisha", /Gekolfd\s*100 ml/.test(await tekst(A.p, "#geschiedenis")));

// Overzicht rendert op beide.
for (const [naam, t] of [["Jaimy", J], ["Aisha", A]]) {
  await t.p.click(".tabbar [data-tab=overzicht]");
  await t.p.waitForTimeout(500);
  ok(`${naam}: overzicht met gisteren en grafieken, tabellen onder Meer (dicht)`, (await zichtbaar(t.p, "#gisteren")) && (await t.p.$$eval("#tab-overzicht > section svg", (x) => x.filter((s) => s.getClientRects().length).length)) >= 4 && !(await t.p.$eval("#meer", (e) => e.open)) && (await t.p.$eval("#melktabel", (e) => e.closest("#meer") !== null)));
  await t.p.click("#meer > summary");
  ok(`${naam}: Meer opent`, await t.p.$eval("#meer", (e) => e.open));
  await t.p.click("#meer > summary");
  ok(`${naam}: geen horizontale scroll`, (await t.p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)));
}
// Instellingen openen zonder toetsenbord.
await J.p.click(".tabbar [data-tab=registreren]");
await J.p.click("#knop-instellingen");
ok("instellingen: geen veld met focus", await J.p.evaluate(() => !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)));
await J.p.click("#dlg-instellingen button[value=sluit]");

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
