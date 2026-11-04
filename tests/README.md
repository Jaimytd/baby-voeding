# Tests

Playwright-tests tegen de app op een lokale http-server en de Firestore-emulator. Alleen voor ontwikkeling; de app zelf heeft deze map niet nodig.

Eenmalig:

```
npm install -g playwright http-server firebase-tools
npx playwright install chromium
npm pack firebase@10.14.1 && tar xzf firebase-10.14.1.tgz   # ergens buiten de repo
```

Draaien (drie terminals, of op de achtergrond):

```
npx http-server -p 8765 -s -c-1 .
firebase emulators:start --only firestore --project demo-baby   # met tests/emu/firebase.json en de firestore.rules uit de repo
APP=http://localhost:8765/ EMU=localhost:8080 FIREBASE_PKG=/pad/naar/package PLAYWRIGHT=$(npm root -g)/playwright/index.mjs node tests/rook.mjs
```

`FIREBASE_PKG` wijst naar de uitgepakte npm-map `package` van firebase 10.14.1; de tests sturen de gstatic-scripts daarnaartoe, zodat ze zonder internet draaien. `SHOT_DIR` zet schermafbeeldingen in die map.

- `rook.mjs`: de belangrijkste handelingen op twee telefoons.
- `streef.mjs`: streefwaarden en het bewerkvenster.
- `seconden.mjs`: het streef op de minuut en bewerken zonder dat de seconden verschuiven.
