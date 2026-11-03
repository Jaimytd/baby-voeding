"""Maakt groei-who.json uit de WHO Child Growth Standards (LMS-tabellen per dag, uit het
R-pakket 'anthro' van de WHO): gewicht en lengte naar leeftijd, per week, 0 tot 2 jaar.
Gebruik: python3 tests/tools/groeitabel.py /pad/naar/anthro/data-raw/growthstandards
"""
import json, sys

bron = sys.argv[1]
def lees(naam):
    rijen = {}
    with open(f"{bron}/{naam}.txt") as f:
        kop = f.readline().strip().split("\t")
        for regel in f:
            v = dict(zip(kop, regel.strip().split("\t")))
            rijen[(int(v["sex"]), int(v["age"]))] = (float(v["l"]), float(v["m"]), float(v["s"]))
    return rijen

gewicht = lees("weianthro")
lengte = lees("lenanthro")
uit = {}
for geslacht, code in (("jongen", 1), ("meisje", 2)):
    uit[geslacht] = {
        "gewicht": [[d, *[round(x, 4) for x in gewicht[(code, d)]]] for d in range(0, 731, 7)],
        "lengte": [[d, *[round(x, 4) for x in lengte[(code, d)]]] for d in range(0, 731, 7)],
    }
json.dump({"bron": "WHO Child Growth Standards 2006, LMS per week (dag, L, M, S)", **uit}, open("groei-who.json", "w"), separators=(",", ":"))
print("groei-who.json geschreven")
