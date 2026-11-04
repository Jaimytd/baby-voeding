// Het streef met 5 minuten speling: vanaf "na 3 u 55" groen, en bewerken van
// alleen de hoeveelheid laat de tijd (met seconden) exact staan.
import { launch, telefoon, ok, eind, tekst, fles, op } from "./helper.mjs";

const b = await launch();
const G = "seconden" + Date.now();
const fouten = [];
const D = "2026-11-03";
await fles(G, op("2026-11-02", 22, 11) + 10000, 140);  // 22:11:10 gisteren
await fles(G, op(D, 2, 5) + 10000, 140);  // 02:05:10, na 3 u 54: net te kort
await fles(G, op(D, 6) + 10000, 140);   // 06:00:10, na 3 u 55: binnen de 5 minuten speling
await fles(G, op(D, 10) + 50000, 140);  // 10:00:50, na 4 u 00 min 40 s: toont "4 u 01"
await fles(G, op(D, 14) + 50000, 140);  // 14:00:50, na precies 4 u

const { p } = await telefoon(b, { gezin: G, datum: `${D}T15:00:00+01:00`, opslag: { onderdelen: { borst: false, kolven: false } }, fouten });
await p.waitForTimeout(500);
const pauzes = () => p.$$eval(".dag[data-dag] >> nth=0 >> .tussen", (x) => x.map((g) => g.textContent.trim() + (g.classList.contains("gehaald") ? "!" : "")));
ok("na 4 u 00, 4 u 01 en 3 u 55 groen; na 3 u 54 niet", (await pauzes()).join("|") === "na 4 u 00!|na 4 u 01!|na 3 u 55!|na 3 u 54", (await pauzes()).join("|"));

// Alleen de hoeveelheid aanpassen: de tijd blijft 14:00:50, dus nog steeds precies 4 u.
await p.click(".iregel.fles >> nth=0");
ok("bewerken toont 14:00", (await p.inputValue("#b-tijd")) === "14:00");
await p.fill("#b-kunst", "175");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("na bijvoeden: 175 ml en nog steeds 'na 4 u 00' groen", /175 ml/.test(await tekst(p, ".dag[data-dag] >> nth=0")) && (await pauzes())[0] === "na 4 u 00!", (await pauzes()).join("|"));

// De tijd wel aanpassen werkt gewoon.
await p.click(".iregel.fles >> nth=0");
await p.fill("#b-tijd", "14:05");
await p.click("#form-bewerk button[value=opslaan]");
await p.waitForTimeout(500);
ok("tijd naar 14:05: 'na 4 u 04'", (await pauzes())[0] === "na 4 u 04!", (await pauzes()).join("|"));

ok("geen JS-fouten", fouten.length === 0, fouten.join(" | "));
await eind(b);
