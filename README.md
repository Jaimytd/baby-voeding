# Babyvoeding

Eenvoudige app om bij te houden wat de baby krijgt, voor twee ouders op twee telefoons.

## Onderdelen aan en uit

In **Instellingen** zet je per telefoon aan wat jullie bijhouden: **Fles (kunstvoeding)**, **Luiers**, **Borstvoeding** en **Kolven en moedermelk in de fles**. Wat uit staat, verdwijnt uit het registreren en uit het overzicht. Eerdere registraties blijven bewaard en staan gewoon in de geschiedenis. Een nieuw gezin begint met alles aan.

## Jullie kind

In **Instellingen** vul je de naam en geboortedatum in (gedeeld met de andere telefoon). Bovenaan staat dan de leeftijd. Op een maandverjaardag en op de verjaardag is er een feestje met confetti, en op de verjaardag krijgt de app een feestthema. Andere mijlpalen die gevierd worden: de 50e, 100e, 250e, 500e en 1000e fles, luier 100, 250, 500 en 1000, en de eerste nacht met 6 en met 8 uur aan één stuk. Elke telefoon viert een mijlpaal één keer.

## Slaap, groei en eerste hapjes

- **Slaap:** een kaart met één knop: **Slaapt nu** en daarna **Wakker**. De slaap is gedeeld, dus de andere telefoon ziet hem lopen en kan hem ook stoppen. In Vandaag, de geschiedenis, het dagritme en het overzicht staat hoeveel er geslapen is. Vergeten te stoppen? Na 16 uur vraagt de app of het klopt.
- **Groei:** in het overzicht, **Meting toevoegen** na elk bezoek aan het consultatiebureau: gewicht in gram en lengte in cm. Je ziet de toename per week, een grafiek van het gewicht per week oud en een tabel. De curve van het consultatiebureau blijft leidend.
- **Eerste hapjes** (aan te zetten in Instellingen): wat ze geproefd heeft en hoe het ging. In het overzicht een lijst per gerecht met de eerste keer, hoe vaak en de laatste reactie.
- **Luier met opmerking:** tik op een luier in de geschiedenis om er een opmerking bij te zetten, bijvoorbeeld over de kleur.

## Handig

- **Volgende fles:** bovenaan staat op basis van het ritme van de afgelopen 24 uur wanneer de volgende fles ongeveer is.
- **Wie deed wat:** in het overzicht per persoon de flessen, nachtflessen, luiers en slaapjes, met een kroontje voor de nachtkoning.
- **Weekkaart:** één plaatje met de cijfers van de afgelopen week, om te delen met opa en oma.
- **Nachtstand:** tussen 22 en 7 uur is de app donker en rustig, met grotere knoppen bij luier en slaap. Uit te zetten in Instellingen.
- **Oppasstand:** deel in Instellingen de oppaslink. Op die telefoon ziet de app alleen vandaag en geen instellingen. Het is een weergave, geen slot: wie de link heeft, kan alles registreren.

## Thema's

In **Instellingen** onder **Thema** kies je **Gewoon**, **Auto** of een van de thema's: Halloween, Sinterklaas, Kerst, Pasen, Zomer, Herfst of Feest. Standaard staat het op **Auto**. Een thema geeft andere kleuren en versiert vaste plekken: een icoon bij de titel met een figuurtje erboven, iets in de hoek, iets dat aan de invoerkaart hangt, een figuurtje dat over de luierkaart en de kaart Gisteren kijkt, icoontjes bij Vandaag, Geschiedenis, Instellingen en de meldingen, icoontjes en figuurtjes tussen de dagen in de geschiedenis en bij de grafieken, een gekleurde streep boven de onderbalk en een versierd stukje grond onderaan de pagina. Bij het openen of terugkomen in de app vliegen er fladderende vleermuizen voorbij of dwarrelt er even sneeuw.

**Auto** kiest het thema op datum: herfst vanaf 21 september, Halloween van 10 oktober tot en met 1 november, Sinterklaas van 12 november tot en met 5 december, kerst van 6 december tot en met 6 januari, Pasen van Witte Donderdag tot en met Tweede Paasdag, zomer van 21 juni tot en met 31 augustus, en het feestthema op de verjaardag van jullie kind. Daarbuiten gewoon. Het thema geldt per telefoon en werkt ook in de nachtstand.

Een nieuw thema toevoegen: een blok `body[data-thema="..."]` met de variabelen in `styles.css`, een periode in `SEIZOENEN` in `app.js` en een knop in Instellingen.

## Registreren

Kies bovenaan **Borst**, **Fles** of **Kolven**. De opslaanknop staat altijd onderin beeld.

- **Borst:** tik op **Start** bij links of rechts. De timer loopt door als het scherm vergrendelt of de app sluit, en blijft dezelfde sessie. Tik op de andere kant om te wisselen. Je kunt de minuten ook intypen of bijstellen, ook terwijl de timer loopt. **Geëindigd met** springt mee met de timer en is ook los aan te tikken.
- **Fles:** kunstvoeding en/of moedermelk in ml, met snelkeuzes of min en plus. Een fles laat een lopende borsttimer met rust.
- **Kolven:** timer of minuten voor de duur, en opbrengst links en rechts. Het totaal staat op de opslaanknop.
- **Luier:** één tik op **Nat**, **Poep**, **Beide** of **Droog**. Ernaast staat wanneer de laatste luier was.

Bovenaan staat hoe lang de laatste voeding geleden is en hoe vaak er de afgelopen 24 uur gevoed is, met de gemiddelde tijd ertussen. Onder **Vandaag** staan de tijden van elke voeding en luier. Borst en fles binnen 45 minuten tellen samen als één voeding.

De lopende timers zijn gedeeld: start Aisha links, dan ziet Jaimy hem ook lopen. Bovenaan staat dan "Nu bezig". Per ongeluk gestart? Tik op **Wissen**. Na opslaan kun je 6 seconden **Ongedaan maken**.

De app helpt tegen vergissingen: een vraag bij een timer die al uren loopt, bij een pauze van meer dan 20 minuten ("nieuwe voeding?"), bij een dubbele registratie binnen 15 minuten en bij kolven zonder opbrengst. Naast de tijd staat "vandaag" of "gisteren".

## Overzicht

- **Gisteren in één blik:** aantal flessen met de gemiddelde hoeveelheid en de langste pauze, luiers (nat, poep, droog), kunstvoeding (met de 500 ml-grens voor vitamine K en hoeveel dagen van de laatste week daaronder zaten), gekolfd (links en rechts) en borstvoeding (links, rechts, aantal keer), elk met een trend.
- **Grafieken** over 7, 14 of 30 dagen of 12 weken: kunstvoeding (met de 500 ml-lijn als de baby ook moedermelk krijgt), aantal flessen, luiers, kolfopbrengst, kunstvoeding plus gekolfd samen en borstvoeding.
- **Tijd tussen voedingen:** per dag (of week) de gemiddelde pauze, met een streep van de kortste tot de langste. In een tabel eronder per dag het gemiddelde, de kortste en de langste pauze, met de tijden. Bovenaan het gemiddelde, de kortste en de langste pauze van de hele periode, met wanneer die was. De nacht telt mee; pauzes langer dan 12 uur niet (vergeten te registreren).
- **Melk per dagdeel:** per dag hoeveel ml er in de nacht (0 tot 6 uur), ochtend, middag en avond gedronken is, met het aantal flessen. Hoe donkerder het vak, hoe meer. Onderaan het gemiddelde en het verschil tussen de laatste en de eerste helft van de periode, zodat je ziet of het verschuift.
- **Dagritme:** per dag een tijdlijn van 0 tot 24 uur met elke voeding en luier, zodat je ziet wanneer de baby drinkt en of er een vast ritme in komt.
- **Tabellen per dag of week:** melk (aantal flessen, kunstvoeding, gekolfd L/R/totaal, samen), luiers en borstvoeding (L/R/totaal/keer), met totaal en gemiddelde. Tik op een dag om de registraties te zien.

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
