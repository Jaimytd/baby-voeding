# Babyvoeding

Eenvoudige app om bij te houden wat de baby krijgt, voor twee ouders op twee telefoons.

## Registreren

Kies bovenaan **Borst**, **Fles** of **Kolven**. De opslaanknop staat altijd onderin beeld.

- **Borst:** tik op **Start** bij links of rechts. De timer loopt door als het scherm vergrendelt of de app sluit, en blijft dezelfde sessie. Tik op de andere kant om te wisselen. Je kunt de minuten ook intypen of bijstellen, ook terwijl de timer loopt. **Geëindigd met** springt mee met de timer en is ook los aan te tikken.
- **Fles:** kunstvoeding en/of moedermelk in ml, met snelkeuzes of min en plus. Een fles laat een lopende borsttimer met rust.
- **Kolven:** timer of minuten voor de duur, en opbrengst links en rechts. Het totaal staat op de opslaanknop.

De lopende timers zijn gedeeld: start Aisha links, dan ziet Jaimy hem ook lopen. Bovenaan staat dan "Nu bezig". Per ongeluk gestart? Tik op **Wissen**. Na opslaan kun je 6 seconden **Ongedaan maken**.

De app helpt tegen vergissingen: een vraag bij een timer die al uren loopt, bij een pauze van meer dan 20 minuten ("nieuwe voeding?"), bij een dubbele registratie binnen 15 minuten en bij kolven zonder opbrengst. Naast de tijd staat "vandaag" of "gisteren".

## Overzicht

- **Gisteren in één blik:** kunstvoeding (met de 500 ml-grens voor vitamine K en hoeveel dagen van de laatste week daaronder zaten), gekolfd (links en rechts) en borstvoeding (links, rechts, aantal keer), elk met een trend.
- **Grafieken** over 7, 14 of 30 dagen of 12 weken: borstvoeding, kunstvoeding (met de 500 ml-lijn), kolfopbrengst en kunstvoeding plus gekolfd samen.
- **Tabellen per dag of week:** melk (kunstvoeding, gekolfd L/R/totaal, samen) en borstvoeding (L/R/totaal/keer), met totaal en gemiddelde. Tik op een dag om de registraties te zien.

De app toont alleen cijfers. Overleg over vitamine K met het consultatiebureau.

Het bolletje rechtsboven: groen is gesynchroniseerd, oranje wacht op verbinding, grijs is alleen lokaal.

## Eenmalig instellen (ongeveer 15 minuten)

### 1. Firebase (gedeelde, gratis database)

1. Ga naar <https://console.firebase.google.com> en maak een project aan (bijv. `baby-voeding`). Google Analytics is niet nodig.
2. Kies in het menu **Build > Firestore Database > Create database**. Kies locatie `eur3 (europe-west)` en start in **production mode**.
3. Open het tabblad **Rules**, vervang de inhoud door die van [`firestore.rules`](firestore.rules) en klik **Publish**.
4. Ga naar **Project settings** (tandwiel) > **Your apps** > het webicoon `</>`. Geef een naam op, Firebase Hosting hoeft niet aangevinkt te worden.
5. Kopieer de waarden uit `firebaseConfig` naar [`config.js`](config.js) en commit dat bestand.

De waarden in `config.js` zijn niet geheim. Jullie gegevens zijn afgeschermd met een willekeurige gezinscode van 20 tekens die de app zelf aanmaakt; zonder die code kan niemand iets lezen.

### 2. Online zetten

De repository is privé. GitHub Pages is voor privé-repo's alleen beschikbaar met een betaald account. Kies één van deze twee:

**A. Repository openbaar maken + GitHub Pages (aanbevolen, gratis)**
De code bevat niets geheims; de voedingsgegevens staan in Firebase, niet in de repository.

1. **Settings > General > Danger Zone > Change visibility** naar Public.
2. **Settings > Pages > Source**: kies **GitHub Actions**.
3. Merge deze branch naar `main`. De workflow in `.github/workflows/pages.yml` publiceert de app op `https://jaimytd.github.io/baby-voeding/`.

**B. Privé houden en Netlify of Cloudflare Pages gebruiken (ook gratis)**
Koppel de repository daar, laat het build-commando leeg en zet de publicatiemap op `/`.

### 3. Op de telefoons zetten

1. Open de app op je eigen telefoon, vul je naam in en laat de gezinscode leeg. Er wordt een nieuwe code gemaakt.
2. Tik op het tandwiel > **Koppellink delen** en stuur de link naar Aisha.
3. Aisha opent de link, vult haar naam in en ziet vanaf dan dezelfde gegevens.
4. Zet de app op het beginscherm:
   - **iPhone (Safari)**: deelknop > **Zet op beginscherm**
   - **Android (Chrome)**: menu met drie puntjes > **App installeren** of **Toevoegen aan startscherm**

Zolang `config.js` leeg is, werkt de app alleen lokaal op één toestel. Dat wordt bovenin gemeld.

## Techniek

Statische site zonder buildstap: `index.html`, `styles.css`, `app.js` (interface), `store.js` (opslag via Firestore of lokaal), `sw.js` (offline). Firestore bewaart gegevens ook lokaal op het toestel, zodat registreren zonder verbinding gewoon werkt. Wijzig je bestanden, verhoog dan `VERSIE` in `sw.js` zodat telefoons de nieuwe versie ophalen.

Lokaal testen: `npx http-server` in deze map en open `http://localhost:8080`.
