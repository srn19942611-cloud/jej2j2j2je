/* GENERERET FIL – rediger data/*.json og kør scripts-generer-data.mjs i stedet. */
import type { KatalogPost } from './typer.ts';

export const MCB_RAEKKE: number[] = [6,10,13,16,20,25,32,40,50,63,80,100,125];
export const HOVEDAFBRYDER_RAEKKE: number[] = [63,80,100,125,160,200,250,315,400,500,630,800];
export const KABEL_TABEL = [{"mm2":1.5,"A1":13,"A3":12,"B1":17,"B3":15,"C1":20,"C3":17.5},{"mm2":2.5,"A1":17.5,"A3":16,"B1":23,"B3":20,"C1":27,"C3":24},{"mm2":4,"A1":23,"A3":21,"B1":31,"B3":27,"C1":36,"C3":32},{"mm2":6,"A1":29,"A3":27,"B1":40,"B3":34,"C1":46,"C3":41},{"mm2":10,"A1":39,"A3":36,"B1":54,"B3":46,"C1":63,"C3":57},{"mm2":16,"A1":52,"A3":48,"B1":73,"B3":62,"C1":85,"C3":76},{"mm2":25,"A1":68,"A3":62,"B1":95,"B3":80,"C1":112,"C3":96},{"mm2":35,"A1":83,"A3":77,"B1":117,"B3":99,"C1":138,"C3":119},{"mm2":50,"A1":99,"A3":92,"B1":141,"B3":118,"C1":168,"C3":144},{"mm2":70,"A1":125,"A3":116,"B1":179,"B3":149,"C1":213,"C3":184},{"mm2":95,"A1":150,"A3":139,"B1":216,"B3":179,"C1":258,"C3":223},{"mm2":120,"A1":172,"A3":160,"B1":249,"B3":206,"C1":299,"C3":259},{"mm2":150,"A1":196,"A3":182,"B1":285,"B3":236,"C1":344,"C3":299},{"mm2":185,"A1":223,"A3":208,"B1":324,"B3":268,"C1":392,"C3":341},{"mm2":240,"A1":261,"A3":244,"B1":380,"B3":315,"C1":461,"C3":403}] as const;
export const KONSTANTER = {"rhoCu":0.0225,"cMin":0.95,"udloesningsfaktor":{"B":5,"C":10,"D":20},"maksSpaendingsfaldPct":4,"maksHovedkabelBelastningPct":70,"motorfaktorMcb":1.25,"stikPrGruppe":6} as {
  rhoCu: number; cMin: number; udloesningsfaktor: { B: number; C: number; D: number };
  maksSpaendingsfaldPct: number; maksHovedkabelBelastningPct: number; motorfaktorMcb: number; stikPrGruppe: number;
};
export const SAMTIDIGHEDSFAKTORER = [
  {
    "kategori": "Central kølekompressor (CO₂/HFO)",
    "interval": "0,85 – 0,95",
    "note": "Kører nær konstant; brug 0,90 til dimensionering."
  },
  {
    "kategori": "Frost-/kølerum kompressor",
    "interval": "0,80 – 0,90",
    "note": "Cyklisk drift, termostatstyret."
  },
  {
    "kategori": "Plug-in kølemøbler (impuls, deli)",
    "interval": "0,80 – 0,90",
    "note": "Kompressor arbejder 60–80 % af tiden."
  },
  {
    "kategori": "Ventilation AHU (VAV)",
    "interval": "0,80 – 0,90",
    "note": "Fuld drift i åbningstid, natsænkning via CTS."
  },
  {
    "kategori": "Varmepumpe (køl+varme, R32)",
    "interval": "0,70 – 0,85",
    "note": "Maks. 0,85 ved samtidig køl/varme, typisk 0,75."
  },
  {
    "kategori": "Luftgardin (Frico AGS)",
    "interval": "0,40 – 0,60",
    "note": "Kun aktiv ved åben dør; vinter høj, sommer lav."
  },
  {
    "kategori": "Belysning salgsareal (LED)",
    "interval": "0,95 – 1,00",
    "note": "Tændt i hele åbningstiden."
  },
  {
    "kategori": "Belysning personale/lager",
    "interval": "0,70 – 0,90",
    "note": "PIR-styret."
  },
  {
    "kategori": "Bake-off ovne",
    "interval": "0,55 – 0,70",
    "note": "Toppe morgen/formiddag; brug 0,65."
  },
  {
    "kategori": "Kaffe/varmedisk",
    "interval": "0,50 – 0,65",
    "note": "Opvarmning er cyklisk."
  },
  {
    "kategori": "POS-kasser + SCO + IT-rack",
    "interval": "0,90 – 1,00",
    "note": "Konstant i drift, UPS-belastning."
  },
  {
    "kategori": "Slagter (hakker, ovn, opvask)",
    "interval": "0,30 – 0,55",
    "note": "Kortvarig, ikke-samtidig drift."
  },
  {
    "kategori": "Dispositionsstik salg/lager",
    "interval": "0,15 – 0,30",
    "note": "Sporadisk brug, ofte 0,20."
  },
  {
    "kategori": "Pap-/plastpresser",
    "interval": "0,20 – 0,40",
    "note": "Kører få gange dagligt, kort tid."
  },
  {
    "kategori": "Flaskeautomat",
    "interval": "0,40 – 0,60",
    "note": "Type B RCD pga. DC-lækstrøm."
  },
  {
    "kategori": "Elevator (vareelevator)",
    "interval": "0,20 – 0,40",
    "note": "Få cyklusser/time, startspids 5–6 × I_n."
  },
  {
    "kategori": "ABA/ABDL/AIA/video",
    "interval": "1,00",
    "note": "Kontinuerlig standby-effekt."
  },
  {
    "kategori": "Nødlys, central batteri",
    "interval": "1,00",
    "note": "Konstant ladestrøm."
  },
  {
    "kategori": "Sprinklerpumpe (test)",
    "interval": "0,05",
    "note": "Kun ved månedstest."
  },
  {
    "kategori": "TOTAL – butik 500–900 m²",
    "interval": "0,55 – 0,65",
    "note": "Ref. Rask Mølle: målt 110–130 A over 15 min ≈ 76–90 kW ved cos φ 0,90."
  },
  {
    "kategori": "TOTAL – butik 1000+ m²",
    "interval": "0,60 – 0,70",
    "note": "SuperBrugsen/Kvickly."
  }
];
export const BYGGEPROGRAMKRAV = [
  {
    "omraade": "System",
    "krav": "Netform",
    "vaerdi": "TN-S 3F+N+PE, 400/230 V, 50 Hz"
  },
  {
    "omraade": "Hovedkabel",
    "krav": "Maks. belastning af hovedforsyningskabel",
    "vaerdi": "70 %"
  },
  {
    "omraade": "Tavle",
    "krav": "Min. disponibel reserveplads",
    "vaerdi": "30 % (min. 4 stk. 4-polede moduler)"
  },
  {
    "omraade": "Tavle",
    "krav": "Tavleform",
    "vaerdi": "Form 2B ≤ 63 A · Form 4A > 63 A"
  },
  {
    "omraade": "Tavle",
    "krav": "Fabrikat/komponenter",
    "vaerdi": "CUBIC/Tabula m. Schneider (Pro-Automatic)"
  },
  {
    "omraade": "Måling",
    "krav": "Multi-instrument i hovedtavle",
    "vaerdi": "Schneider PM8000 m. M-Bus"
  },
  {
    "omraade": "Måling",
    "krav": "Bimåler på alle afgange > 63 A",
    "vaerdi": "ABB B23 m. M-Bus"
  },
  {
    "omraade": "Overspænding",
    "krav": "SPD type 1 i hovedtavle m. melding + lampe",
    "vaerdi": "Type 1 (HT) + type 2 (UT)"
  },
  {
    "omraade": "Elkvalitet",
    "krav": "Aktivt harmonisk filter – disponibel afgang reserveret",
    "vaerdi": "100 A afgang, ca. 60 A filter"
  },
  {
    "omraade": "Nødforsyning",
    "krav": "Manuel omskifter + CEE-indtag i HT-front",
    "vaerdi": "125 A CEE + bryder 1-0-2"
  },
  {
    "omraade": "Fejlbeskyttelse",
    "krav": "Maks. forsikring foran RCD/RCBO",
    "vaerdi": "100 A (jf. producent)"
  },
  {
    "omraade": "Fejlbeskyttelse",
    "krav": "Type B RCD på DC-lækkende laster",
    "vaerdi": "VP, køl m. frekvensomformer, flaskeautomat, PV, ladestander"
  },
  {
    "omraade": "Fejlbeskyttelse",
    "krav": "RCD-kvalitet på lys + kritisk",
    "vaerdi": "Super-immun \"SI\"/AP-R"
  },
  {
    "omraade": "Kritiske grupper",
    "krav": "Køl og IT må ikke dele RCD med komfortlast",
    "vaerdi": "–"
  },
  {
    "omraade": "Kabelfelter",
    "krav": "Min. 2 kabelfelter à ca. 600 mm",
    "vaerdi": "Klemmer på alle afgange ≤ 63 A"
  },
  {
    "omraade": "IP-klasse",
    "krav": "Tavlen tætnes efter kabelinføring",
    "vaerdi": "≥ IP 44"
  },
  {
    "omraade": "Mærkning",
    "krav": "Sporbar mærkning HT01-Fxx / UT01-Fxx",
    "vaerdi": "Mærkebjælke + dymo + Dalux"
  },
  {
    "omraade": "Dokumentation",
    "krav": "Leveres komplet + 1 × as-built",
    "vaerdi": "Enstregsdiagram, gruppeskema, komponentliste, målerskema"
  },
  {
    "omraade": "Solceller",
    "krav": "PSO-målerfelt eller tomt tavlejern reserveret",
    "vaerdi": "Egen bimåler hvis intet PSO-krav"
  },
  {
    "omraade": "Placering",
    "krav": "Sokkel/afskærmning foran tavle + 1 m friplads",
    "vaerdi": "–"
  }
];
export const REFERENCEMAALINGER = [
  {
    "navn": "SuperBrugsen Dragør (1013)",
    "m2": 1000,
    "peakA": 130
  },
  {
    "navn": "Brugsen Søby, Ærø",
    "m2": 600,
    "peakA": 110
  },
  {
    "navn": "Dagli’Brugsen Rask Mølle (projekt)",
    "m2": 688,
    "peakA": 120
  }
];
export const REFERENCESAGER = [
  {
    "navn": "Dagli’Brugsen Rask Mølle",
    "kilde": "Effektoversigt_Brugsen_20260708.xlsx + plantegning 2251110-7",
    "salgsAreal": 688,
    "lagerAreal": 97,
    "ovrigtAreal": 60,
    "kasser": 2,
    "sco": 1,
    "installeretKw": 223.6,
    "samtidigKw": 132.9,
    "beregnetA": 213,
    "maaltPeakA": "110–130 A (15 min., sammenlignelige butikker)",
    "valgtHovedsikring": 200,
    "hovedkabelDimensioneretTil": 250,
    "hovedtavleDimensioneretTil": 250,
    "note": "Beregningen gav 205–213 A, men målinger i sammenlignelige butikker gav 110–130 A. Der blev valgt 200 A ampererettighed og 250 A kabel/tavle som kompromis."
  }
];
/* A pr. m² salgsareal, målt 15-min. peak i sammenlignelige butikker. */
export const REFERENCE_A_PR_M2 = { min: 0.1300, max: 0.1833 };
export const BUTIKSTYPER = [
  {
    "navn": "Dagli’Brugsen",
    "salgsAreal": 690,
    "lagerAreal": 100,
    "ovrigtAreal": 60,
    "kasser": 2,
    "sco": 1,
    "tilvalg": [
      "deli",
      "bakeoff",
      "centralkoel",
      "varmepumpe",
      "flaskeautomat"
    ]
  },
  {
    "navn": "SuperBrugsen",
    "salgsAreal": 1100,
    "lagerAreal": 200,
    "ovrigtAreal": 120,
    "kasser": 4,
    "sco": 2,
    "tilvalg": [
      "deli",
      "bakeoff",
      "slagter",
      "centralkoel",
      "varmepumpe",
      "flaskeautomat"
    ]
  },
  {
    "navn": "Kvickly",
    "salgsAreal": 2200,
    "lagerAreal": 400,
    "ovrigtAreal": 220,
    "kasser": 6,
    "sco": 4,
    "tilvalg": [
      "deli",
      "bakeoff",
      "slagter",
      "centralkoel",
      "varmepumpe",
      "flaskeautomat",
      "elevator"
    ]
  },
  {
    "navn": "365discount",
    "salgsAreal": 600,
    "lagerAreal": 90,
    "ovrigtAreal": 50,
    "kasser": 2,
    "sco": 1,
    "tilvalg": [
      "bakeoff",
      "centralkoel",
      "varmepumpe",
      "flaskeautomat"
    ]
  }
];
export const TILVALG = [
  {
    "id": "deli",
    "navn": "Delikatesse"
  },
  {
    "id": "bakeoff",
    "navn": "Brød & bake-off"
  },
  {
    "id": "slagter",
    "navn": "Slagterafdeling"
  },
  {
    "id": "centralkoel",
    "navn": "Central køl (CO₂)"
  },
  {
    "id": "varmepumpe",
    "navn": "Varmepumper/komfortkøl"
  },
  {
    "id": "flaskeautomat",
    "navn": "Flaskeautomat"
  },
  {
    "id": "elevator",
    "navn": "Vareelevator"
  },
  {
    "id": "ladestander",
    "navn": "Ladestandere el-bil"
  },
  {
    "id": "sprinkler",
    "navn": "Sprinkleranlæg"
  },
  {
    "id": "pv",
    "navn": "Solceller"
  }
];
export const PLANSYMBOLER = {
  "version": "2026-09-07",
  "formaal": "Ordbog der oversætter tekst og møbelkoder på en Coop-plantegning til poster i katalog.json. Bruges af tegningsudtrækket (vision-kald) og af den manuelle optællings-UI.",
  "tillidsniveauer": {
    "sikker": "Mapping er verificeret mod maskinliste eller byggeprogram. Kan bruges direkte.",
    "forslag": "Sandsynlig mapping udledt af referencesagen Rask Mølle. SKAL bekræftes af bruger første gang koden ses i et projekt.",
    "ukendt": "Koden er ikke i ordbogen. Vises til bruger, der vælger katalogpost eller markerer 'ingen el'."
  },
  "rumetiketter": [
    {
      "regex": "SALGSLOKALE\\s+([\\d.,]+)\\s*M2",
      "felt": "salgsAreal",
      "rum": "salg",
      "eksempel": "SALGSLOKALE 688 M2",
      "tillid": "sikker"
    },
    {
      "regex": "LAGER\\s+([\\d.,]+)\\s*M2",
      "felt": "lagerAreal",
      "rum": "lager",
      "eksempel": "LAGER 97 M2",
      "tillid": "sikker"
    },
    {
      "regex": "DELI\\s+([\\d.,]+)\\s*M2",
      "felt": "deliAreal",
      "rum": "salg",
      "aktiverTilvalg": "deli",
      "eksempel": "DELI 45 M2",
      "tillid": "sikker"
    },
    {
      "regex": "SLAGTER\\s+([\\d.,]+)\\s*M2",
      "felt": "slagterAreal",
      "rum": "slagter",
      "aktiverTilvalg": "slagter",
      "tillid": "sikker"
    },
    {
      "regex": "FROST\\s+([\\d.,]+)\\s*M2",
      "felt": "frostrumAreal",
      "rum": "teknik",
      "katalogId": "K4",
      "antalPrForekomst": 1,
      "eksempel": "FROST 16 M2",
      "tillid": "sikker"
    },
    {
      "regex": "KØL\\s+([\\d.,]+)\\s*M2",
      "felt": "koelerumAreal",
      "rum": "teknik",
      "katalogId": "K5",
      "antalPrForekomst": 1,
      "eksempel": "KØL 16 M2 / KØL 8 M2",
      "tillid": "sikker"
    },
    {
      "regex": "MEJERIKØL\\s+([\\d.,]+)\\s*M2",
      "felt": "mejerikoelAreal",
      "rum": "salg",
      "katalogId": "K5",
      "antalPrForekomst": 1,
      "eksempel": "MEJERIKØL 13 M2",
      "tillid": "sikker"
    },
    {
      "regex": "TEKNIK\\s+([\\d.,]+)\\s*M2",
      "felt": "teknikAreal",
      "rum": "teknik",
      "eksempel": "TEKNIK 19 M2",
      "tillid": "sikker"
    },
    {
      "regex": "PERSONALERUM\\s+([\\d.,]+)\\s*M2",
      "felt": "personaleAreal",
      "rum": "personale",
      "katalogId": "LA13",
      "antalPrForekomst": 1,
      "eksempel": "PERSONALERUM 15 M2",
      "tillid": "sikker"
    },
    {
      "regex": "KONTOR\\s+([\\d.,]+)\\s*M2",
      "felt": "kontorAreal",
      "rum": "personale",
      "eksempel": "KONTOR 13 M2",
      "tillid": "sikker"
    },
    {
      "regex": "FLASKERUM\\s+([\\d.,]+)\\s*M2",
      "felt": "flaskerumAreal",
      "rum": "lager",
      "aktiverTilvalg": "flaskeautomat",
      "eksempel": "FLASKERUM 43 M2",
      "tillid": "sikker"
    },
    {
      "regex": "FLASKE-?\\s*INDLEV\\.?\\s+([\\d.,]+)\\s*M2",
      "felt": "flaskeindlevAreal",
      "rum": "lager",
      "eksempel": "FLASKEINDLEV. 5 M2",
      "tillid": "sikker"
    },
    {
      "regex": "DEPOT\\s+([\\d.,]+)\\s*M2",
      "felt": "depotAreal",
      "rum": "lager",
      "tillid": "sikker"
    },
    {
      "regex": "VINDFANG\\s+([\\d.,]+)\\s*M2",
      "felt": "vindfangAreal",
      "rum": "salg",
      "katalogId": "BU33",
      "antalPrForekomst": 1,
      "note": "Vindfang ⇒ automatiske skydedøre + luftgardin",
      "tillid": "sikker"
    },
    {
      "regex": "(WC|WC/BAD|FORRUM)\\s+([\\d.,]+)\\s*M2",
      "felt": "ovrigtAreal",
      "rum": "personale",
      "tillid": "sikker"
    }
  ],
  "moebelkoder": [
    {
      "kode": "EGM",
      "monster": "EGM\\s*\\d{3}\\s*x\\s*\\d{3,4}",
      "betydning": "Gondol-/vægreol (EGM-modul). Typisk uden el ud over inventarlys.",
      "katalogId": "BU3",
      "antalPrForekomst": 0.25,
      "enhed": "reolmodul",
      "tillid": "forslag",
      "note": "Sæt antalPrForekomst = 0 hvis reolerne er uden lys. 4 moduler pr. lysgruppe i referencesagen."
    },
    {
      "kode": "LDF",
      "monster": "LDF\\s*[\\d,\\.]+\\s*\\d{3,4}x\\d{3,4}",
      "betydning": "Frostmøbel, plug-in (låg/ø).",
      "katalogId": "BU5",
      "antalPrForekomst": 1,
      "enhed": "møbel",
      "tillid": "forslag"
    },
    {
      "kode": "CLS",
      "monster": "CLS\\s*\\d{3,4}",
      "betydning": "Køle-/frostskab med glaslåge (skabsrække).",
      "katalogId": "BU5",
      "antalPrForekomst": 1,
      "enhed": "skab",
      "tillid": "forslag"
    },
    {
      "kode": "IMPULS",
      "monster": "impuls(køler)?",
      "betydning": "Impulskøler ved kasselinje.",
      "katalogId": "BU5",
      "antalPrForekomst": 1,
      "enhed": "møbel",
      "tillid": "sikker"
    },
    {
      "kode": "KASSELINJE",
      "monster": "kasse(linje|bånd)?|check\\s*out",
      "betydning": "Kasselinje/POS-plads.",
      "katalogId": "BU15",
      "antalPrForekomst": 1,
      "enhed": "kasse",
      "tillid": "sikker"
    },
    {
      "kode": "SCO",
      "monster": "SCO|selvbetjening|scan\\s*&?\\s*betal",
      "betydning": "Selvbetjeningskasse.",
      "katalogId": "BU15",
      "antalPrForekomst": 1,
      "enhed": "kasse",
      "tillid": "sikker"
    },
    {
      "kode": "TOBAK",
      "monster": "tobak|rygeartik",
      "betydning": "Tobaksskab bag kasselinje.",
      "katalogId": "BU11",
      "antalPrForekomst": 1,
      "enhed": "skab",
      "tillid": "sikker"
    },
    {
      "kode": "F&G_BORD",
      "monster": "F&G\\s*bord",
      "betydning": "Frugt & grønt-bord (vægt/el i bord).",
      "katalogId": "BU2",
      "antalPrForekomst": 0,
      "enhed": "bord",
      "tillid": "forslag",
      "note": "Kun grøntvægten trækker el; sæt 1 på ét af bordene."
    },
    {
      "kode": "GRØNTVÆGT",
      "monster": "grøntvægt|vægt\\s*F&G",
      "betydning": "Grøntvægt.",
      "katalogId": "BU2",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "BETJENT_DISK",
      "monster": "betjent\\s*disk|køledisk\\s*betjent",
      "betydning": "Betjent køledisk i deli.",
      "katalogId": "BC4",
      "antalPrForekomst": 1,
      "enhed": "disk",
      "tillid": "sikker"
    },
    {
      "kode": "SELVBETJENT_DISK",
      "monster": "selvbetjent\\s*disk",
      "betydning": "Selvbetjent køledisk.",
      "katalogId": "BC5",
      "antalPrForekomst": 1,
      "enhed": "disk",
      "tillid": "sikker"
    },
    {
      "kode": "DELIKØL",
      "monster": "delikøl",
      "betydning": "Delikøl.",
      "katalogId": "BC19",
      "antalPrForekomst": 1,
      "enhed": "møbel",
      "tillid": "sikker"
    },
    {
      "kode": "BAGEROVN",
      "monster": "bake[- ]?off|bagerovn|ovn\\s*i\\s*rack",
      "betydning": "Bake-off ovn.",
      "katalogId": "BC7",
      "antalPrForekomst": 1,
      "enhed": "ovn",
      "tillid": "sikker"
    },
    {
      "kode": "MERRYCHEF",
      "monster": "merrychef|speed[- ]?oven",
      "betydning": "Merrychef speed-oven.",
      "katalogId": "MC1",
      "antalPrForekomst": 1,
      "enhed": "ovn",
      "tillid": "sikker"
    },
    {
      "kode": "KAFFEMASKINE",
      "monster": "kaffemaskine",
      "betydning": "Kaffemaskine.",
      "katalogId": "BC15",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "KAFFEMØLLE",
      "monster": "kaffemølle",
      "betydning": "Kaffemølle 400 V.",
      "katalogId": "BU9",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "FLASKEAUTOMAT",
      "monster": "flaskeautomat|ATV|pantautomat",
      "betydning": "Flaskeautomat (type B RCD).",
      "katalogId": "LA7",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "PAPPRESSER",
      "monster": "pappresse[r]?",
      "betydning": "Pappresser 32 A CEE.",
      "katalogId": "LA1",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "PLASTPRESSER",
      "monster": "plastpresse[r]?",
      "betydning": "Plastpresser.",
      "katalogId": "LA2",
      "antalPrForekomst": 1,
      "enhed": "stk",
      "tillid": "sikker"
    },
    {
      "kode": "HURTIGPORT",
      "monster": "hurtigport",
      "betydning": "Hurtigport mellem lager og butik.",
      "katalogId": "BU32",
      "antalPrForekomst": 1,
      "enhed": "port",
      "tillid": "sikker"
    },
    {
      "kode": "SKYDEDØR",
      "monster": "skydedør|automatisk\\s*dør",
      "betydning": "Automatisk skydedør.",
      "katalogId": "BU33",
      "antalPrForekomst": 1,
      "enhed": "dør",
      "tillid": "sikker"
    },
    {
      "kode": "SIKRINGSSKAB",
      "monster": "sikringsskab\\s*(\\d+)\\s*fags",
      "betydning": "Varesikringsgates ved udgang.",
      "katalogId": "S7",
      "antalPrForekomst": 1,
      "enhed": "skab",
      "tillid": "forslag"
    },
    {
      "kode": "HÅNDVASK",
      "monster": "håndvask\\s*aut\\.?\\s*armatur",
      "betydning": "Håndvask med 230 V sensorarmatur.",
      "katalogId": null,
      "antalPrForekomst": 0,
      "enhed": "stk",
      "tillid": "sikker",
      "note": "Kun 230 V til armatur — indgår i dispositionsstik."
    },
    {
      "kode": "STIKVOGN",
      "monster": "stikvogn|fletkurv|systemvogn|krydderivogn",
      "betydning": "Inventar uden el.",
      "katalogId": null,
      "antalPrForekomst": 0,
      "enhed": "stk",
      "tillid": "sikker"
    }
  ],
  "maskinnumre": [
    {
      "praefiks": "SL",
      "kilde": "Slagter maskinliste (FDB, maj 2018, rev. jan 2025)",
      "beskrivelse": "Tegningen er mærket med maskinlistens numre, fx SL11, SL12, SL21, SL23a. Slå direkte op i katalog.json på id.",
      "tillid": "sikker"
    },
    {
      "praefiks": "BC",
      "kilde": "Brødcooperativ/bageri-maskinliste",
      "beskrivelse": "BC1–BC20 i deli/bake-off.",
      "tillid": "sikker"
    },
    {
      "praefiks": "BU",
      "kilde": "Butiksinventar (Marianne, effektoversigt SuperBrugsen)",
      "beskrivelse": "BU2–BU22 i salgslokalet.",
      "tillid": "sikker"
    },
    {
      "praefiks": "LA",
      "kilde": "Lager/varemodtagelse",
      "beskrivelse": "LA1–LA16.",
      "tillid": "sikker"
    },
    {
      "praefiks": "K",
      "kilde": "Køleleverandør",
      "beskrivelse": "K3–K7, central køl og rum.",
      "tillid": "sikker"
    }
  ],
  "kasselinjeTaelling": {
    "beskrivelse": "Tallene i kasselinjen på tegningen (fx 2, 5, 22, 6) er hyldelængder/moduler, ikke antal kasser. Antal kasser tælles på kasseborde/scannerpladser.",
    "advarsel": true
  },
  "ignorer": [
    "FLUGTVEJ",
    "BIB",
    "MÅL",
    "SNIT",
    "REV.",
    "MÅLESTOK",
    "TEGN.NR",
    "DATO"
  ]
};
export const KOLONNEORDBOG = {
  "version": "2026-09-07",
  "formaal": "Gør app'en i stand til at læse de regneark og lister, der rent faktisk kommer ind: maskinlister fra leverandører, effektoversigter fra rådgivere og butikkernes egne inventarlister. Ordbogen matcher kolonneoverskrifter og værdiformater, så et ark kan indlæses uden manuel opsætning.",
  "filtyper": [
    {
      "id": "maskinliste",
      "navn": "Maskin-/inventarliste",
      "endelser": [
        ".xlsx",
        ".xls",
        ".csv"
      ],
      "kendetegn": [
        "maskintype",
        "leverandør",
        "stk",
        "kardex",
        "io nr"
      ],
      "beskrivelse": "FDB-formatet med én maskine pr. række og VVS-kolonner ved siden af el."
    },
    {
      "id": "effektoversigt",
      "navn": "Effektoversigt/belastningsskema",
      "endelser": [
        ".xlsx",
        ".xls",
        ".csv"
      ],
      "kendetegn": [
        "mærkat",
        "cos",
        "df",
        "belast",
        "sikring",
        "gruppe"
      ],
      "beskrivelse": "Et allerede udfyldt skema — indlæses som helt projekt, ikke som enkeltposter."
    },
    {
      "id": "gruppeskema",
      "navn": "Gruppeskema",
      "endelser": [
        ".xlsx",
        ".xls"
      ],
      "kendetegn": [
        "1p+n",
        "3p+n",
        "c10",
        "c16"
      ],
      "beskrivelse": "Mariannes format: antal grupper pr. type i kolonner."
    },
    {
      "id": "datablad",
      "navn": "Datablad (PDF)",
      "endelser": [
        ".pdf"
      ],
      "kendetegn": [
        "type",
        "model",
        "nominal",
        "rated",
        "tilslutning"
      ],
      "beskrivelse": "Tekstlag søges for effekt, spænding, strøm og cos φ. Scannet PDF sendes til vision."
    },
    {
      "id": "plantegning",
      "navn": "Plantegning",
      "endelser": [
        ".pdf",
        ".png",
        ".jpg",
        ".dwg"
      ],
      "kendetegn": [
        "salgslokale",
        "m2",
        "målestok"
      ],
      "beskrivelse": "Behandles af tegningsflowet, se docs/03."
    },
    {
      "id": "byggeprogram",
      "navn": "Byggeprogram/kravspecifikation",
      "endelser": [
        ".pdf",
        ".docx"
      ],
      "kendetegn": [
        "byggeprogram",
        "kravspecifikation",
        "§"
      ],
      "beskrivelse": "Udtrækkes til krav-tjeklisten, ikke til forbrugerlisten."
    }
  ],
  "kolonner": [
    {
      "felt": "gruppe",
      "synonymer": [
        "nr.",
        "nr",
        "mærkat",
        "gr.",
        "gruppe",
        "id",
        "pos",
        "position",
        "kode"
      ],
      "paakraevet": false
    },
    {
      "felt": "navn",
      "synonymer": [
        "maskintype",
        "forbruger",
        "betegnelse",
        "udstyr",
        "beskrivelse",
        "emne",
        "salgslokale",
        "inventar",
        "forbruger/beskrivelse"
      ],
      "paakraevet": true
    },
    {
      "felt": "leverandoer",
      "synonymer": [
        "leverandør",
        "fabrikat",
        "producent",
        "brand"
      ],
      "paakraevet": false
    },
    {
      "felt": "model",
      "synonymer": [
        "model",
        "type",
        "typebetegnelse",
        "varenr"
      ],
      "paakraevet": false
    },
    {
      "felt": "antal",
      "synonymer": [
        "stk.",
        "stk",
        "antal",
        "antal tegning",
        "qty",
        "mængde"
      ],
      "paakraevet": true
    },
    {
      "felt": "spaending",
      "synonymer": [
        "spænding",
        "volt",
        "v",
        "forsyning",
        "tilslutning"
      ],
      "paakraevet": false
    },
    {
      "felt": "kw",
      "synonymer": [
        "kw",
        "kw/stk",
        "effekt",
        "effekt [kw]",
        "p",
        "optaget effekt",
        "mærkeeffekt"
      ],
      "paakraevet": false
    },
    {
      "felt": "ampere",
      "synonymer": [
        "amp",
        "a",
        "a/fase",
        "strøm",
        "mærkestrøm",
        "in"
      ],
      "paakraevet": false
    },
    {
      "felt": "cosphi",
      "synonymer": [
        "cos φ",
        "cos phi",
        "cosphi",
        "cos",
        "effektfaktor",
        "pf"
      ],
      "paakraevet": false
    },
    {
      "felt": "df",
      "synonymer": [
        "df",
        "samtidighed",
        "samtidighedsfaktor",
        "benyttelsesfaktor"
      ],
      "paakraevet": false
    },
    {
      "felt": "mcb",
      "synonymer": [
        "sikring",
        "afbryder",
        "gruppeafbryder",
        "mcb",
        "automat"
      ],
      "paakraevet": false
    },
    {
      "felt": "kabel",
      "synonymer": [
        "kabel",
        "tværsnit",
        "ledning",
        "kabeltype"
      ],
      "paakraevet": false
    },
    {
      "felt": "rcd",
      "synonymer": [
        "rcd",
        "hpfi",
        "fejlstrøm",
        "beskyttelse",
        "hfi"
      ],
      "paakraevet": false
    },
    {
      "felt": "tavle",
      "synonymer": [
        "tavle",
        "fordeling",
        "ht",
        "ut"
      ],
      "paakraevet": false
    },
    {
      "felt": "afdeling",
      "synonymer": [
        "afdeling",
        "område",
        "rum",
        "placering",
        "lokale"
      ],
      "paakraevet": false
    },
    {
      "felt": "note",
      "synonymer": [
        "bemærkninger",
        "bemærkning",
        "noter",
        "note",
        "kommentarer",
        "kommentar"
      ],
      "paakraevet": false
    },
    {
      "felt": "kilde",
      "synonymer": [
        "kilde",
        "reference",
        "grundlag"
      ],
      "paakraevet": false
    }
  ],
  "ignorerKolonner": [
    "varmt vand",
    "koldt vand",
    "blødt vand",
    "afløb",
    "ka afløb",
    "aftræk",
    "vvs",
    "kardex nr.",
    "io nr."
  ],
  "vaerdimoenstre": {
    "spaending": [
      {
        "regex": "3\\s*[x×]\\s*400",
        "volt": 400,
        "faser": 3,
        "tillid": 1
      },
      {
        "regex": "400\\s*/?\\s*230|230\\s*/\\s*400",
        "volt": 400,
        "faser": 3,
        "tillid": 0.5,
        "flag": "tvetydig",
        "note": "Kan være 1-faset tilslutning på et 400 V-apparat — skal bekræftes."
      },
      {
        "regex": "^\\s*400",
        "volt": 400,
        "faser": 3,
        "tillid": 0.9
      },
      {
        "regex": "3\\s*[x×]\\s*230",
        "volt": 230,
        "faser": 3,
        "tillid": 0.9
      },
      {
        "regex": "^\\s*230",
        "volt": 230,
        "faser": 1,
        "tillid": 1
      },
      {
        "regex": "^\\s*(24|12)\\s*v?",
        "volt": 230,
        "faser": 1,
        "tillid": 0.3,
        "flag": "lavspænding",
        "note": "Formentlig styrespænding bag transformer."
      }
    ],
    "tal": {
      "decimalKomma": true,
      "fjernEnheder": [
        "kw",
        "kW",
        "w",
        "a",
        "A",
        "v",
        "V",
        "ca.",
        "ca",
        "~",
        "stk",
        "stk."
      ],
      "tusindtalstegn": [
        ".",
        " "
      ],
      "note": "Danske ark bruger komma som decimaltegn: 16,5 → 16.5. Værdier med både punktum og komma tolkes som 1.234,5."
    },
    "ja": [
      "ja",
      "j",
      "x",
      "yes",
      "true",
      "1"
    ],
    "nej": [
      "nej",
      "n",
      "-",
      "–",
      "0",
      "false"
    ],
    "ukendt": [
      "?",
      "??",
      "???",
      "tbd",
      "afklares",
      "ukendt"
    ]
  },
  "gruppekolonner": {
    "beskrivelse": "Mariannes gruppeskema har én kolonne pr. gruppetype, og celleværdien er antal grupper.",
    "regex": "([13])\\s*P\\s*\\+?\\s*N\\s*([BCD])?\\s*(\\d+)",
    "eksempler": [
      {
        "overskrift": "1P+N C10",
        "faser": 1,
        "karakteristik": "C",
        "mcb": 10
      },
      {
        "overskrift": "3P+N C16",
        "faser": 3,
        "karakteristik": "C",
        "mcb": 16
      },
      {
        "overskrift": "3p+n c32",
        "faser": 3,
        "karakteristik": "C",
        "mcb": 32
      }
    ]
  },
  "fodnoter": {
    "tegn": [
      "*",
      "**",
      "***"
    ],
    "betydning": "Poster med samme fodnotetegn deler gruppe. Læses som ét gruppefællesskab og markeres i noten.",
    "eksempel": "Mariannes ark: SL21, SL23, SL25 og SL28 står alle med '1**' og noten 'Arbejdsstationer i slagter monteres samlet'."
  },
  "advarsler": [
    {
      "id": "kw_mangler",
      "tekst": "Række uden kW: strømmen udledes af ampere-kolonnen, ellers bruges katalogets standardværdi og kilden sættes til 'Skaleret erfaring'."
    },
    {
      "id": "amp_vs_kw",
      "tekst": "Hvis både kW og A står i arket, og de afviger mere end 20 %, vises begge, og brugeren vælger. Databladets ampere er ofte inkl. startstrøm."
    },
    {
      "id": "antal_tegning",
      "tekst": "Kolonnen 'antal tegning' vinder over 'antal', når de er forskellige — den er talt på tegningen."
    },
    {
      "id": "sum_raekker",
      "tekst": "Rækker uden antal, men med tekst som 'Hovedtavle', 'Terminaltavle' eller 'SUM', er overskrifter og skal springes over."
    }
  ]
};
export const NOEGLETAL = {
  "version": "2026-09-07",
  "formaal": "Oversætter det, der kan måles på en indretningstegning — løbende meter møbel og kvadratmeter rum — til effekt i kW. Bruges når tegningen viser et møbel, men intet datablad findes.",
  "tillidsforklaring": "0,9 = fra byggeprogram eller datablad · 0,6–0,8 = udledt af referencesagen Rask Mølle · 0,3–0,5 = erfaringstal der bør bekræftes med et datablad, før det bruges til bestilling.",
  "modulfamilier": [
    {
      "kode": "EGM",
      "navn": "Reolmodul (gondol/væg)",
      "bredde_mm": 600,
      "dybde_mm": 1200,
      "koelet": false,
      "note": "Målene står typisk i selve koden: 'EGM 600x1200'. Læs dem derfra, når de er der."
    },
    {
      "kode": "LDF",
      "navn": "Frostmøbel, plug-in (låg/ø)",
      "bredde_mm": 1020,
      "dybde_mm": 845,
      "koelet": true,
      "koeletype": "frost"
    },
    {
      "kode": "CLS",
      "navn": "Køle-/frostskabsrække med glaslåger",
      "bredde_mm": null,
      "dybde_mm": 800,
      "koelet": true,
      "koeletype": "koel",
      "note": "Tallet i koden (fx CLS3760) er som regel rækkens samlede længde i mm — bekræftes mod den målte bredde."
    },
    {
      "kode": "IMPULS",
      "navn": "Impulskøler ved kasselinje",
      "bredde_mm": 600,
      "dybde_mm": 700,
      "koelet": true,
      "koeletype": "koel"
    },
    {
      "kode": "MEJERI",
      "navn": "Mejerikøl, gennemgangsmøbel",
      "bredde_mm": 1250,
      "dybde_mm": 900,
      "koelet": true,
      "koeletype": "koel"
    },
    {
      "kode": "F&G",
      "navn": "Frugt & grønt-bord",
      "bredde_mm": 1267,
      "dybde_mm": 900,
      "koelet": false
    }
  ],
  "dimensionIKode": {
    "regex": "(\\d{3,4})\\s*[x×]\\s*(\\d{3,4})",
    "forklaring": "To tal adskilt af x læses som bredde × dybde i mm.",
    "enkelttalRegex": "^[A-ZÆØÅ]{2,4}\\s*(\\d{4})$",
    "enkelttalForklaring": "Ét firecifret tal efter en modulkode læses som rækkens samlede længde i mm og markeres til bekræftelse."
  },
  "prMeter": [
    {
      "id": "plugin_koel",
      "navn": "Plug-in kølemøbel (multideck/impuls)",
      "kwPrM": 0.64,
      "katalogId": "BU5",
      "gaelderKoder": [
        "IMPULS",
        "EGM_KOELET"
      ],
      "kilde": "El-effektoversigt Rask Mølle: 0,385 kW pr. 600 mm møbel",
      "tillid": 0.7,
      "koeletype": "koel"
    },
    {
      "id": "plugin_frost",
      "navn": "Plug-in frostmøbel (ø/låg)",
      "kwPrM": 1,
      "katalogId": "BU5",
      "gaelderKoder": [
        "LDF"
      ],
      "kilde": "Erfaringstal, ca. 1 kW pr. 1020 mm møbel",
      "tillid": 0.5,
      "koeletype": "frost"
    },
    {
      "id": "central_koel_moebel",
      "navn": "Centraltilsluttet kølemøbel — lys, blæser, afrimning",
      "kwPrM": 0.15,
      "katalogId": "BU3",
      "gaelderKoder": [
        "CLS",
        "MEJERI"
      ],
      "kilde": "Erfaringstal. Selve køleeffekten ligger på centralanlægget, ikke på møblet",
      "tillid": 0.5,
      "koeletype": null
    },
    {
      "id": "central_koel_kompressor",
      "navn": "Centralanlæg, kompressoreffekt pr. m kølemøbel",
      "kwPrM": 0.25,
      "katalogId": "K3",
      "gaelderKoder": [
        "CLS",
        "MEJERI"
      ],
      "kilde": "Erfaringstal, køl. Kontrollér mod køleleverandørens beregning",
      "tillid": 0.4,
      "koeletype": "koel"
    },
    {
      "id": "central_frost_kompressor",
      "navn": "Centralanlæg, kompressoreffekt pr. m frostmøbel",
      "kwPrM": 0.45,
      "katalogId": "K4",
      "gaelderKoder": [
        "CLS_FROST"
      ],
      "kilde": "Erfaringstal, frost",
      "tillid": 0.4,
      "koeletype": "frost"
    },
    {
      "id": "betjent_disk",
      "navn": "Betjent køledisk",
      "kwPrM": 0.96,
      "katalogId": "BC4",
      "gaelderKoder": [
        "BETJENT_DISK"
      ],
      "kilde": "1,2 kW pr. 1,25 m disk, El-effektoversigt",
      "tillid": 0.7,
      "koeletype": "koel"
    },
    {
      "id": "selvbetjent_disk",
      "navn": "Selvbetjent køledisk/delikøl",
      "kwPrM": 0.85,
      "katalogId": "BC19",
      "gaelderKoder": [
        "SELVBETJENT_DISK",
        "DELIKØL"
      ],
      "kilde": "1,03–1,1 kW pr. 1,25 m, maskinliste POS",
      "tillid": 0.7,
      "koeletype": "koel"
    },
    {
      "id": "inventarlys",
      "navn": "Inventarlys på tørvarereoler",
      "kwPrM": 0.025,
      "katalogId": "BU3",
      "gaelderKoder": [
        "EGM"
      ],
      "kilde": "Erfaringstal, 25 W pr. m reol, CTS-styret",
      "tillid": 0.5,
      "koeletype": null
    }
  ],
  "prM2Rum": [
    {
      "id": "lys_salg",
      "navn": "Belysning salgsareal 3500 K",
      "wPrM2": 9,
      "rum": [
        "salgslokale"
      ],
      "katalogId": "L1",
      "kilde": "Byggeprogram §3.2",
      "tillid": 0.9,
      "fallback": false
    },
    {
      "id": "lys_lager",
      "navn": "Belysning lager/personale 4000 K",
      "wPrM2": 8,
      "rum": [
        "lager",
        "depot",
        "personalerum",
        "kontor",
        "flaskerum",
        "teknik"
      ],
      "katalogId": "L2",
      "kilde": "Byggeprogram §3.2",
      "tillid": 0.8,
      "fallback": false
    },
    {
      "id": "ventilation",
      "navn": "Ventilation AHU",
      "wPrM2": 12.9,
      "rum": [
        "salgslokale"
      ],
      "katalogId": "V1",
      "kilde": "Unic-Air, 9 kW ved 700 m² salgsareal",
      "tillid": 0.7,
      "fallback": false
    },
    {
      "id": "komfortkoel",
      "navn": "Varmepumper/komfortkøl, eleffekt",
      "wPrM2": 17,
      "rum": [
        "salgslokale"
      ],
      "katalogId": "V2",
      "kilde": "2 × 6 kW ved 688 m², Rask Mølle",
      "tillid": 0.6,
      "fallback": false
    },
    {
      "id": "koelerum",
      "navn": "Kølerum, kompressor",
      "wPrM2": 190,
      "rum": [
        "køl",
        "mejerikøl"
      ],
      "katalogId": "K5",
      "kilde": "3 kW ved 16 m² rum",
      "tillid": 0.6,
      "fallback": false
    },
    {
      "id": "frostrum",
      "navn": "Frostrum, kompressor",
      "wPrM2": 250,
      "rum": [
        "frost"
      ],
      "katalogId": "K4",
      "kilde": "4 kW ved 16 m² rum",
      "tillid": 0.6,
      "fallback": false
    },
    {
      "id": "deli_udstyr",
      "navn": "Deli- og bake-off-udstyr",
      "wPrM2": 450,
      "rum": [
        "deli"
      ],
      "katalogId": null,
      "kilde": "Sum af BC-poster ved 45 m² deli, Rask Mølle. Kun fallback — brug maskinlisten når den findes",
      "tillid": 0.4,
      "fallback": true
    },
    {
      "id": "slagter_udstyr",
      "navn": "Slagterudstyr",
      "wPrM2": 900,
      "rum": [
        "slagter"
      ],
      "katalogId": null,
      "kilde": "Sum af SL-poster i slagter-maskinlisten. Kun fallback",
      "tillid": 0.3,
      "fallback": true
    },
    {
      "id": "disp_stik_salg",
      "navn": "Dispositionsstik salgsareal",
      "wPrM2": 5.7,
      "rum": [
        "salgslokale"
      ],
      "katalogId": "BU14",
      "kilde": "Ét stik pr. 35 m² à 0,2 kW",
      "tillid": 0.6,
      "fallback": false
    }
  ],
  "prEnhed": [
    {
      "id": "kasse",
      "navn": "Kasse/POS-plads",
      "kw": 0.5,
      "katalogId": "BU15",
      "kilde": "Maskinliste POS",
      "tillid": 0.8
    },
    {
      "id": "sco",
      "navn": "Selvbetjeningskasse",
      "kw": 0.5,
      "katalogId": "BU15",
      "kilde": "Maskinliste POS",
      "tillid": 0.8
    },
    {
      "id": "skydedoer",
      "navn": "Automatisk skydedør",
      "kw": 0.5,
      "katalogId": "BU33",
      "kilde": "Byggeprogram",
      "tillid": 0.7
    },
    {
      "id": "luftgardin",
      "navn": "Luftgardin ved indgang",
      "kw": 6,
      "katalogId": "BU30",
      "kilde": "Frico AGS, byggeprogram §11.4",
      "tillid": 0.7
    },
    {
      "id": "hurtigport",
      "navn": "Hurtigport",
      "kw": 1.5,
      "katalogId": "BU32",
      "kilde": "El-effektoversigt",
      "tillid": 0.7
    },
    {
      "id": "flaskeautomat",
      "navn": "Flaskeautomat",
      "kw": 3.5,
      "katalogId": "LA7",
      "kilde": "Byggeprogram §4.4.2.9",
      "tillid": 0.8
    }
  ],
  "rumtypeordbog": [
    {
      "monster": "salgslokale|butik",
      "rumtype": "salgslokale"
    },
    {
      "monster": "^lager",
      "rumtype": "lager"
    },
    {
      "monster": "^deli",
      "rumtype": "deli"
    },
    {
      "monster": "slagter|kogerum",
      "rumtype": "slagter"
    },
    {
      "monster": "^frost",
      "rumtype": "frost"
    },
    {
      "monster": "mejerikøl",
      "rumtype": "mejerikøl"
    },
    {
      "monster": "^køl",
      "rumtype": "køl"
    },
    {
      "monster": "flaskerum|flaske-?indlev",
      "rumtype": "flaskerum"
    },
    {
      "monster": "personalerum|frokost",
      "rumtype": "personalerum"
    },
    {
      "monster": "^kontor",
      "rumtype": "kontor"
    },
    {
      "monster": "^depot",
      "rumtype": "depot"
    },
    {
      "monster": "^teknik|kompressorrum",
      "rumtype": "teknik"
    },
    {
      "monster": "vindfang",
      "rumtype": "vindfang"
    },
    {
      "monster": "wc|bad|forrum",
      "rumtype": "ovrigt"
    }
  ],
  "forklaringKoeletype": "prMeter-poster med koeletype 'koel' eller 'frost' bruges kun på løb af den type. Et CLS-løb ved et frostrum regnes som frost, ikke begge dele.",
  "forklaringFallback": "prM2Rum-poster med fallback=true er grove afdelingsnøgletal. De vises i kalkulen, men indgår ikke i den samlede effekt, når der findes en maskinliste for afdelingen."
};
export const KATALOG: KatalogPost[] = [
  {
    "id": "BU2",
    "navn": "Grøntvægt (F&G)",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.5,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.6,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "GRØNTVÆGT",
      "F&G_BORD"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU3",
    "navn": "Lys i inventar (CTS-styret)",
    "afdeling": "Belysning",
    "rum": "salg",
    "kategori": "lys",
    "kw": 0.2,
    "spaending": 230,
    "cosphi": 1,
    "df": 0.9,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "m2salg",
      "vaerdi": 175,
      "forklaring": "Ét stk. pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": "Slukkes om natten via CTS"
  },
  {
    "id": "BU5",
    "navn": "Impulskølere plug-in",
    "afdeling": "Køl & frost",
    "rum": "salg",
    "kategori": "koel",
    "kw": 0.385,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "m2salg",
      "vaerdi": 58,
      "forklaring": "Ét stk. pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "EGM",
      "LDF",
      "CLS",
      "IMPULS"
    ],
    "kilde": "El-effektoversigt, skaleret",
    "note": "Kritisk – på nødforsyning"
  },
  {
    "id": "BU9",
    "navn": "Kaffemølle",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 2.5,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.4,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "KAFFEMØLLE"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU11",
    "navn": "Tobaksskabe",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "stik",
    "kw": 0.15,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.5,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "m2salg",
      "vaerdi": 120,
      "forklaring": "Ét stk. pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "TOBAK",
      "RYGEARTIKLER"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU14",
    "navn": "Dispositionsstik salgsareal",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "stik",
    "kw": 0.2,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.2,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "m2salg",
      "vaerdi": 35,
      "forklaring": "Ét stk. pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Referencetavle",
    "note": ""
  },
  {
    "id": "BU15",
    "navn": "POS-kasser + SCO",
    "afdeling": "IT, POS & sikring",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.5,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.9,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "kasser",
      "vaerdi": null,
      "forklaring": "Følger antal kasser + SCO"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "KASSE",
      "SCO",
      "KASSELINJE"
    ],
    "kilde": "Maskinliste POS",
    "note": "Kritisk – salg skal kunne gennemføres under nedbrud"
  },
  {
    "id": "BU19",
    "navn": "Tablets scan & betal",
    "afdeling": "IT, POS & sikring",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.05,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.9,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 3,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU20",
    "navn": "Udendørs 230/400 V stik (CEE foran butik)",
    "afdeling": "Udvendigt",
    "rum": "udv",
    "kategori": "stik",
    "kw": 3.6,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU22",
    "navn": "Disponibelt 400 V stik ved port/lager",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "stik",
    "kw": 6,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU30",
    "navn": "Frico AGS luftgardin",
    "afdeling": "HVAC & varmepumper",
    "rum": "teknik",
    "kategori": "hvac",
    "kw": 6,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §11.4",
    "note": ""
  },
  {
    "id": "BU31",
    "navn": "Natrullegardin, motor",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 0.15,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.1,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU32",
    "navn": "Hurtigport lager/butik",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 1.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.2,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "HURTIGPORT"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BU33",
    "navn": "Automatiske skydedøre",
    "afdeling": "Salgslokale",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 0.5,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "SKYDEDØR"
    ],
    "kilde": "Byggeprogram",
    "note": ""
  },
  {
    "id": "BC1",
    "navn": "Kasser bageri (EDB + alm.)",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.9,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BC4",
    "navn": "Køledisk betjent",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "koel",
    "kw": 1.2,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "BETJENT_DISK"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "BC5",
    "navn": "Køledisk selvbetjent",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "koel",
    "kw": 1.1,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "SELVBETJENT_DISK"
    ],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "BC7",
    "navn": "Bake-off ovn 400 V",
    "afdeling": "Brød & bake-off",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 5.8,
    "spaending": 400,
    "cosphi": 0.95,
    "df": 0.65,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": "bakeoff",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "BAGEROVN"
    ],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC10",
    "navn": "Brødskærer",
    "afdeling": "Brød & bake-off",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 2.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.4,
    "tavle": "HT01",
    "tilvalg": "bakeoff",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC11",
    "navn": "Kølebord bageri/deli",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "koel",
    "kw": 1.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC15",
    "navn": "Kaffemaskine (fælles)",
    "afdeling": "Brød & bake-off",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 3.1,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.6,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": "bakeoff",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "KAFFEMASKINE"
    ],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC18",
    "navn": "Flexskab",
    "afdeling": "Brød & bake-off",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 8,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.7,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": "bakeoff",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC19",
    "navn": "Delikøl",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "koel",
    "kw": 1.03,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.6,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "DELIKØL"
    ],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "BC20",
    "navn": "Prismærkningsanlæg",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.2,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "BC21",
    "navn": "PC i deli",
    "afdeling": "Deli",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.3,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.7,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": "deli",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "MC1",
    "navn": "Merrychef speed-oven",
    "afdeling": "Brød & bake-off",
    "rum": "salg",
    "kategori": "maskine",
    "kw": 6,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.5,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": "bakeoff",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "MERRYCHEF"
    ],
    "kilde": "Maskinliste POS",
    "note": ""
  },
  {
    "id": "SL7a",
    "navn": "Kogebord glaskeramisk, 4 zoner",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 9,
    "spaending": 400,
    "cosphi": 0.95,
    "df": 0.5,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 20,
    "leverandoer": "Electrolux NB serie 700",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL7a",
    "note": ""
  },
  {
    "id": "SL9",
    "navn": "Friture",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 16.5,
    "spaending": 400,
    "cosphi": 0.95,
    "df": 0.55,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste",
    "note": ""
  },
  {
    "id": "SL10",
    "navn": "Kipsteger",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 1.8,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste",
    "note": ""
  },
  {
    "id": "SL11",
    "navn": "Konvektionsovn",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 11.1,
    "spaending": 400,
    "cosphi": 0.95,
    "df": 0.6,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 20,
    "leverandoer": "Coba/Electrolux, dobbeltovn i rack",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL11",
    "note": ""
  },
  {
    "id": "SL12",
    "navn": "Opvaskemaskine (Jeros)",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 8.5,
    "spaending": 400,
    "cosphi": 0.95,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 13,
    "leverandoer": "Jeros 9110",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL12",
    "note": ""
  },
  {
    "id": "SL15",
    "navn": "Skumrenseanlæg",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 1.15,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.2,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": "Ecolab S510",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL15",
    "note": ""
  },
  {
    "id": "SL18",
    "navn": "Vakuumpakker",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 3.5,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste",
    "note": ""
  },
  {
    "id": "SL19",
    "navn": "Arbejdsstation slagter (EDB + alm.)",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "it",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.7,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "SL21",
    "navn": "Pakkedispenser/pakkebord",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 0.78,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": "Sibola pakkebord model 83",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL21",
    "note": ""
  },
  {
    "id": "SL23a",
    "navn": "Prismærkerboks",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "it",
    "kw": 0.14,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": "Digi DPS 5602 M",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL23a",
    "note": "Egen elgruppe + PDS kat. 5 til switch"
  },
  {
    "id": "SL25",
    "navn": "Kølebord slagter",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "koel",
    "kw": 1,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.3,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": "ViboCold",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL25",
    "note": ""
  },
  {
    "id": "SL31",
    "navn": "Pålægsmaskine",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": "Myhrwold Bizerba GSP H",
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL31",
    "note": ""
  },
  {
    "id": "SL34",
    "navn": "Bordhakker",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "maskine",
    "kw": 1.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste",
    "note": ""
  },
  {
    "id": "SL17",
    "navn": "Dispositionsstik 230 V, slagter",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "stik",
    "kw": 0.2,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 6,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL17",
    "note": "Maskinliste SL17: 6 stk. CE/alm., i alt 0,9 kW pr. gruppe, placeret underkant loft"
  },
  {
    "id": "SL36",
    "navn": "Dispositionsstik 400 V slagter",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "stik",
    "kw": 3.6,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 3,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste",
    "note": ""
  },
  {
    "id": "SL28",
    "navn": "Fluefanger",
    "afdeling": "Slagter",
    "rum": "slagter",
    "kategori": "stik",
    "kw": 0.06,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": 10,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Slagter-maskinliste SL28",
    "note": ""
  },
  {
    "id": "K3",
    "navn": "CO₂-kondensaggregat, central køl",
    "afdeling": "Køl & frost",
    "rum": "teknik",
    "kategori": "koel",
    "kw": 12,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.9,
    "karakteristik": "C",
    "rcd": "300 mA B",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "UT02 – Køl",
    "tilvalg": "centralkoel",
    "skalering": {
      "type": "kwm2salg",
      "vaerdi": 0.0171,
      "forklaring": "kW pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Køleleverandør, skaleret",
    "note": "Type B RCD (frekvensomformer)"
  },
  {
    "id": "K4",
    "navn": "Frostrum, kompressor",
    "afdeling": "Køl & frost",
    "rum": "teknik",
    "kategori": "koel",
    "kw": 4,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.9,
    "karakteristik": "C",
    "rcd": "300 mA B",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "UT02 – Køl",
    "tilvalg": "centralkoel",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "FROSTRUM"
    ],
    "kilde": "Byggeprogram §8",
    "note": ""
  },
  {
    "id": "K5",
    "navn": "Kølerum, kompressor",
    "afdeling": "Køl & frost",
    "rum": "teknik",
    "kategori": "koel",
    "kw": 3,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.9,
    "karakteristik": "C",
    "rcd": "300 mA B",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "UT02 – Køl",
    "tilvalg": "centralkoel",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "KØLERUM",
      "MEJERIKØL"
    ],
    "kilde": "Byggeprogram §8",
    "note": ""
  },
  {
    "id": "K6",
    "navn": "CO₂ dryeksp.-modul (styring)",
    "afdeling": "Køl & frost",
    "rum": "teknik",
    "kategori": "koel",
    "kw": 2.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.7,
    "karakteristik": "C",
    "rcd": "300 mA B",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "UT02 – Køl",
    "tilvalg": "centralkoel",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Køleleverandør",
    "note": ""
  },
  {
    "id": "K7",
    "navn": "Gulvvarme + alarm i køle-/frostrum",
    "afdeling": "Køl & frost",
    "rum": "teknik",
    "kategori": "koel",
    "kw": 0.8,
    "spaending": 230,
    "cosphi": 1,
    "df": 0.5,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "UT02 – Køl",
    "tilvalg": "centralkoel",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Maskininstallation",
    "note": ""
  },
  {
    "id": "V1",
    "navn": "Ventilation AHU-1 (Unic-Air)",
    "afdeling": "HVAC & varmepumper",
    "rum": "teknik",
    "kategori": "hvac",
    "kw": 9,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.85,
    "karakteristik": "C",
    "rcd": "RCBO B",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "kwm2salg",
      "vaerdi": 0.0129,
      "forklaring": "kW pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Unic-Air datablad, skaleret",
    "note": ""
  },
  {
    "id": "V0",
    "navn": "Ventilation AHU-2, kogerum",
    "afdeling": "HVAC & varmepumper",
    "rum": "teknik",
    "kategori": "hvac",
    "kw": 2.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.8,
    "karakteristik": "C",
    "rcd": "RCBO B",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0.1,
    "tavle": "HT01",
    "tilvalg": "slagter",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Unic-Air datablad",
    "note": ""
  },
  {
    "id": "V2",
    "navn": "Varmepumpe/komfortkøl (R32 Wind-Free)",
    "afdeling": "HVAC & varmepumper",
    "rum": "teknik",
    "kategori": "hvac",
    "kw": 6,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.75,
    "karakteristik": "C",
    "rcd": "RCBO B",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "varmepumpe",
    "skalering": {
      "type": "m2salg",
      "vaerdi": 350,
      "forklaring": "Ét stk. pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Datablad varmepumper",
    "note": "Bimåler ABB B23 pr. stk. (M-Bus)"
  },
  {
    "id": "L1",
    "navn": "Belysning salgsareal 3500 K",
    "afdeling": "Belysning",
    "rum": "salg",
    "kategori": "lys",
    "kw": 6.5,
    "spaending": 230,
    "cosphi": 1,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.95,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "wm2salg",
      "vaerdi": 9,
      "forklaring": "W pr. m² salgsareal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §3.2",
    "note": ""
  },
  {
    "id": "L2",
    "navn": "Belysning personale + lager 4000 K",
    "afdeling": "Belysning",
    "rum": "lager",
    "kategori": "lys",
    "kw": 2,
    "spaending": 230,
    "cosphi": 1,
    "df": 0.85,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "wm2lager",
      "vaerdi": 8,
      "forklaring": "W pr. m² lager + øvrigt"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §3.2",
    "note": ""
  },
  {
    "id": "L3",
    "navn": "Facade + P-plads",
    "afdeling": "Belysning",
    "rum": "udv",
    "kategori": "lys",
    "kw": 2,
    "spaending": 400,
    "cosphi": 1,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-projekt E-1/E-3",
    "note": ""
  },
  {
    "id": "L4",
    "navn": "Nød- og panikbelysning (central batteri)",
    "afdeling": "Belysning",
    "rum": "salg",
    "kategori": "lys",
    "kw": 1.2,
    "spaending": 230,
    "cosphi": 1,
    "df": 1,
    "karakteristik": "B",
    "rcd": "–",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "DS/EN 1838",
    "note": "Egen kritisk gruppe uden RCD"
  },
  {
    "id": "LA1",
    "navn": "Pappresse (32 A CEE)",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 4,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "PAPPRESSER"
    ],
    "kilde": "Byggeprogram §4.4.2.11",
    "note": ""
  },
  {
    "id": "LA2",
    "navn": "Plastpresse",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 4,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "PLASTPRESSER"
    ],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA3",
    "navn": "Ladestation, stabler",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 3,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA7",
    "navn": "Flaskeautomat (nyt anlæg)",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 3.5,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "C",
    "rcd": "30 mA B",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "flaskeautomat",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [
      "FLASKEAUTOMAT"
    ],
    "kilde": "Byggeprogram §4.4.2.9",
    "note": "1×400 V + 2×230 V. Type B pga. DC-lækstrøm"
  },
  {
    "id": "LA11",
    "navn": "Varemodtagelse EDB + PC + vægt",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "it",
    "kw": 0.5,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.7,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA12",
    "navn": "Postudlevering EDB + vægt",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "it",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA13",
    "navn": "Frokoststue (køl/mikro/opvask)",
    "afdeling": "Personale",
    "rum": "personale",
    "kategori": "maskine",
    "kw": 4.5,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.4,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA14",
    "navn": "Gulvvaskemaskine (opladning)",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 1.5,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 0.3,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA15",
    "navn": "Rullegitre, motor",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 0.75,
    "spaending": 230,
    "cosphi": 0.85,
    "df": 0.05,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 2,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "LA16",
    "navn": "Toiletrum, stik + håndtørrer",
    "afdeling": "Personale",
    "rum": "personale",
    "kategori": "stik",
    "kw": 1.6,
    "spaending": 230,
    "cosphi": 1,
    "df": 0.2,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "D1",
    "navn": "POS + SCO, UPS-udgang",
    "afdeling": "IT, POS & sikring",
    "rum": "salg",
    "kategori": "it",
    "kw": 3.5,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.9,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.9,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §3.2",
    "note": "Kritisk – egen RCBO, ej fælles med komfortlast"
  },
  {
    "id": "D2",
    "navn": "IT-rack + netværk",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 2,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.3,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §3.2",
    "note": "Egen RCBO + SPD kl. III"
  },
  {
    "id": "D4",
    "navn": "Rengøringsstik + almen kraft",
    "afdeling": "IT, POS & sikring",
    "rum": "salg",
    "kategori": "stik",
    "kw": 3,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.25,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §4.3",
    "note": ""
  },
  {
    "id": "S1",
    "navn": "ABA brandcentral",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §4.4.2.14",
    "note": "Egen rødmærket gruppe"
  },
  {
    "id": "S2",
    "navn": "ABDL adgangskontrol",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 0.3,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §4.4.2.12",
    "note": ""
  },
  {
    "id": "S3",
    "navn": "AIA/tyverialarm",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 0.3,
    "spaending": 230,
    "cosphi": 0.95,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "S4",
    "navn": "Videoovervågning + NVR",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 0.4,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "S5",
    "navn": "Talevarsling/PA-anlæg",
    "afdeling": "IT, POS & sikring",
    "rum": "teknik",
    "kategori": "it",
    "kw": 0.3,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.2,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "S6",
    "navn": "Hjertestarter, udvendig (RCBO)",
    "afdeling": "Udvendigt",
    "rum": "udv",
    "kategori": "it",
    "kw": 0.2,
    "spaending": 230,
    "cosphi": 1,
    "df": 1,
    "karakteristik": "B",
    "rcd": "RCBO 30 mA",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "El-effektoversigt",
    "note": ""
  },
  {
    "id": "S7",
    "navn": "Varesikring/gates",
    "afdeling": "IT, POS & sikring",
    "rum": "salg",
    "kategori": "it",
    "kw": 0.3,
    "spaending": 230,
    "cosphi": 0.9,
    "df": 1,
    "karakteristik": "B",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0.5,
    "tavle": "HT01",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "CTS1",
    "navn": "CTS-tavle (Niagara 4) + servicestik",
    "afdeling": "CTS & bimåling",
    "rum": "teknik",
    "kategori": "it",
    "kw": 1.5,
    "spaending": 400,
    "cosphi": 0.9,
    "df": 0.5,
    "karakteristik": "C",
    "rcd": "30 mA A",
    "noedforsyning": true,
    "bimaaler": false,
    "varmeAfgivelse": 0.1,
    "tavle": "UT01 – CTS",
    "tilvalg": null,
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram §6",
    "note": "SPD kl. II + potentialfri melding til CTS"
  },
  {
    "id": "EL1",
    "navn": "Vareelevator",
    "afdeling": "Lager & varemodtag.",
    "rum": "lager",
    "kategori": "maskine",
    "kw": 7.5,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.3,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "elevator",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram",
    "note": "Startspids 5–6 × I_n, egen elevatortavle"
  },
  {
    "id": "EV1",
    "navn": "Ladestander el-bil 22 kW",
    "afdeling": "Udvendigt",
    "rum": "udv",
    "kategori": "maskine",
    "kw": 22,
    "spaending": 400,
    "cosphi": 1,
    "df": 0.6,
    "karakteristik": "C",
    "rcd": "30 mA B",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "ladestander",
    "skalering": {
      "type": "ladestander",
      "vaerdi": null,
      "forklaring": "Følger antal ladestandere"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Byggeprogram",
    "note": "Type B RCD, egen bimåler, lastbalancering anbefales"
  },
  {
    "id": "SPR",
    "navn": "Sprinklerpumpe (test)",
    "afdeling": "Teknik",
    "rum": "teknik",
    "kategori": "maskine",
    "kw": 30,
    "spaending": 400,
    "cosphi": 0.85,
    "df": 0.05,
    "karakteristik": "D",
    "rcd": "30 mA A",
    "noedforsyning": false,
    "bimaaler": false,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "sprinkler",
    "skalering": {
      "type": "fast",
      "vaerdi": 1,
      "forklaring": "Fast antal"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Marianne SB",
    "note": ""
  },
  {
    "id": "PV",
    "navn": "Solcelleanlæg, invertere",
    "afdeling": "Solceller (PV)",
    "rum": "tag",
    "kategori": "pv",
    "kw": -0.8,
    "spaending": 400,
    "cosphi": 1,
    "df": 1,
    "karakteristik": "C",
    "rcd": "300 mA B",
    "noedforsyning": false,
    "bimaaler": true,
    "varmeAfgivelse": 0,
    "tavle": "HT01",
    "tilvalg": "pv",
    "skalering": {
      "type": "pv",
      "vaerdi": null,
      "forklaring": "kW pr. kWp (inverter)"
    },
    "ampDatablad": null,
    "leverandoer": null,
    "plankoder": [],
    "kilde": "Kravspec. solceller §6",
    "note": "Produktion – modregnes ikke i hovedsikring. PSO-målerfelt reserveres"
  }
];
