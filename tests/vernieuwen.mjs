// Een nieuwe versie herlaadt de app niet midden in het invullen, maar pas als er even niets gebeurt.
import { launch, telefoon, ok, eind, tekst } from "./helper.mjs";

const b = await launch();
const G = "vernieuwen" + Date.now();
const fouten = [];
const { p } = await telefoon(b, { gezin: G, naam: "Jaimy", opslag: { onderdelen: { borst: false, kolven: false } }, fouten });
await p.evaluate(() => { window.__merk = 1; });

// Luier aantikken, fles ingevuld, en dan komt de nieuwe versie: geen herlaadactie.
await p.click("#luierkaart [data-luier=nat]");
await p.click('.soort[data-soort=kunst] .pil[data-ml="105"]');
await p.evaluate(() => window.nieuweVersieKlaar());
await p.waitForTimeout(1500);
ok("midden in het invullen: niet herladen, wel een melding met 'Nu'", (await p.evaluate(() => window.__merk)) === 1 && /nieuwe versie/.test(await tekst(p, "#toast-tekst")) && (await tekst(p, "#toast-actie")) === "Nu");
await p.click("#invoer .opslaan");
await p.waitForTimeout(1200);
ok("luier en fles allebei opgeslagen", /Luier\s*nat/.test(await tekst(p, "#geschiedenis")) && /Fles\s*105 ml/.test(await tekst(p, "#geschiedenis")), (await tekst(p, "#geschiedenis")).slice(0, 100));

// Daarna even niets doen: de app herlaadt vanzelf (controle na 20 s, 15 s na de laatste tik).
await p.waitForTimeout(21000);
ok("na een tijdje niets doen: herladen", (await p.evaluate(() => window.__merk)) === undefined);
await p.waitForSelector("#sync.ok");
ok("na herladen staan beide registraties er nog", /Luier\s*nat/.test(await tekst(p, "#geschiedenis")) && /Fles\s*105 ml/.test(await tekst(p, "#geschiedenis")));

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
