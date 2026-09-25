// Opslaglaag. Met Firebase-config: gedeeld en live (Firestore, werkt ook offline).
// Zonder config: alleen lokaal in de browser van dit toestel.
import { firebaseConfig } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.14.1/";
const DAGEN_TERUG = 60;

const meldFout = (e) => {
  console.error(e);
  window.dispatchEvent(new CustomEvent("opslagfout", { detail: e }));
};

export const isGedeeld =() => Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export async function maakStore(gezin) {
  return isGedeeld() ? firestoreStore(gezin) : lokaleStore(gezin);
}

async function firestoreStore(gezin) {
  const { initializeApp } = await import(FB + "firebase-app.js");
  const fs = await import(FB + "firebase-firestore.js");
  const app = initializeApp(firebaseConfig);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const col = fs.collection(db, "gezinnen", gezin, "voedingen");

  return {
    gedeeld: true,
    subscribe(cb, fout) {
      const q = fs.query(
        col,
        fs.where("tijd", ">=", Date.now() - DAGEN_TERUG * 864e5),
        fs.orderBy("tijd", "desc"),
      );
      return fs.onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snap) =>
          cb(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            { wachtend: snap.metadata.hasPendingWrites, uitCache: snap.metadata.fromCache },
          ),
        fout,
      );
    },
    // Schrijfacties niet awaiten in de UI: offline blijft de promise hangen tot er
    // verbinding is, terwijl onSnapshot de wijziging direct laat zien.
    add(v) {
      const ref = fs.doc(col);
      fs.setDoc(ref, v).catch(meldFout);
      return ref.id;
    },
    update: (id, v) => fs.updateDoc(fs.doc(col, id), v).catch(meldFout),
    remove: (id) => fs.deleteDoc(fs.doc(col, id)).catch(meldFout),
  };
}

function lokaleStore(gezin) {
  const sleutel = "voedingen:" + gezin;
  const luisteraars = new Set();
  const lees = () => {
    try {
      return JSON.parse(localStorage.getItem(sleutel)) || [];
    } catch {
      return [];
    }
  };
  const schrijf = (lijst) => {
    localStorage.setItem(sleutel, JSON.stringify(lijst));
    const gesorteerd = [...lijst].sort((a, b) => b.tijd - a.tijd);
    luisteraars.forEach((cb) => cb(gesorteerd, { wachtend: false, uitCache: false }));
  };
  return {
    gedeeld: false,
    subscribe(cb) {
      luisteraars.add(cb);
      cb([...lees()].sort((a, b) => b.tijd - a.tijd), { wachtend: false, uitCache: false });
      return () => luisteraars.delete(cb);
    },
    add(v) {
      const id = crypto.randomUUID();
      schrijf([...lees(), { ...v, id }]);
      return id;
    },
    update(id, v) {
      schrijf(lees().map((x) => (x.id === id ? { ...x, ...v } : x)));
    },
    remove(id) {
      schrijf(lees().filter((x) => x.id !== id));
    },
  };
}
