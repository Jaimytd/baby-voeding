# Babyvoeding

Eenvoudige app om bij te houden wat de baby krijgt:

- **Borstvoeding** per kant (links en rechts), met een timer of door de minuten zelf in te typen
- **Moedermelk** (gekolfd, in ml)
- **Kunstvoeding** (extra fles, in ml)
- **Tijdstip** (staat standaard op nu, of op het moment dat je de borsttimer start)

Het werkt als app op Android en iPhone (via "Toevoegen aan beginscherm"), synchroniseert live tussen jullie telefoons en blijft werken zonder internet. Wijzigingen worden gedeeld zodra er weer verbinding is.

## Zo werkt het

1. Tik op **Start** bij links of rechts. De timer loopt door, ook als het scherm uitgaat of je de app sluit. Tik op de andere kant om te wisselen; de eerste pauzeert dan vanzelf.
2. Geen timer gebruikt? Typ het aantal minuten direct in het vakje eronder.
3. Onder de timers staat **Laatst gebruikt: Links / Rechts**. Die springt vanzelf mee met de timer, maar je kunt hem ook los aantikken. Alleen de kant aangeven zonder minuten mag ook.
4. Vul eventueel moedermelk en/of kunstvoeding in met de knoppen 30, 60, 90, 120 of met min en plus (stappen van 5 ml).
5. Tik op **Opslaan**. Per ongeluk? Tik direct op **Ongedaan maken**.

Bovenaan zie je hoe lang de laatste voeding geleden is en welke borst de vorige keer als laatste gebruikt is. Onder **Vandaag** staan de dagtotalen. Tik op een regel in de geschiedenis om hem aan te passen of te verwijderen. Een tijd later dan nu (bijvoorbeeld 23:50 invullen om 00:10) wordt automatisch als gisteren opgeslagen.

Het bolletje rechtsboven toont de synchronisatie: groen is gedeeld, oranje wacht op verbinding, grijs is alleen lokaal.

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
