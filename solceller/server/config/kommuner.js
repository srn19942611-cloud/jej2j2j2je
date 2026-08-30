/**
 * Kommuneregister og de to kommune-afhængige opslag, værktøjet ikke kan
 * automatisere: byggesagsarkiv (modul 4) og netselskab (modul 9).
 *
 * VIGTIGT OM PÅLIDELIGHED
 * ------------------------
 * Ingen af de to mappings findes som et åbent, maskinlæsbart register.
 * Derfor er de her ikke "data" men et arbejdsregister med tre tilstande:
 *
 *   bekræftet  - en bruger har brugt linket og bekræftet at det var rigtigt
 *   indikativ   - vores bedste bud; SKAL bekræftes af brugeren før brug
 *   ukortlagt   - vi ved det ikke, og vi påstår ikke noget
 *
 * Modul 4 og 9 må aldrig sende en "indikativ" værdi videre til rapporten
 * uden at brugeren har bekræftet den. Bekræftelser skrives til
 * data/bekræftede-opslag.json og løfter posten til "bekræftet".
 */

export const Sikkerhed = Object.freeze({
  BEKRAEFTET: "bekraeftet",
  INDIKATIV: "indikativ",
  UKORTLAGT: "ukortlagt",
});

/** De 98 kommuner med officiel kommunekode. */
export const KOMMUNER = {
  101: "København", 147: "Frederiksberg", 151: "Ballerup", 153: "Brøndby",
  155: "Dragør", 157: "Gentofte", 159: "Gladsaxe", 161: "Glostrup",
  163: "Herlev", 165: "Albertslund", 167: "Hvidovre", 169: "Høje-Taastrup",
  173: "Lyngby-Taarbæk", 175: "Rødovre", 183: "Ishøj", 185: "Tårnby",
  187: "Vallensbæk", 190: "Furesø", 201: "Allerød", 210: "Fredensborg",
  217: "Helsingør", 219: "Hillerød", 223: "Hørsholm", 230: "Rudersdal",
  240: "Egedal", 250: "Frederikssund", 253: "Greve", 259: "Køge",
  260: "Halsnæs", 265: "Roskilde", 269: "Solrød", 270: "Gribskov",
  306: "Odsherred", 316: "Holbæk", 320: "Faxe", 326: "Kalundborg",
  329: "Ringsted", 330: "Slagelse", 336: "Stevns", 340: "Sorø",
  350: "Lejre", 360: "Lolland", 370: "Næstved", 376: "Guldborgsund",
  390: "Vordingborg", 400: "Bornholm", 410: "Middelfart", 420: "Assens",
  430: "Faaborg-Midtfyn", 440: "Kerteminde", 450: "Nyborg", 461: "Odense",
  479: "Svendborg", 480: "Nordfyns", 482: "Langeland", 492: "Ærø",
  510: "Haderslev", 530: "Billund", 540: "Sønderborg", 550: "Tønder",
  561: "Esbjerg", 563: "Fanø", 573: "Varde", 575: "Vejen",
  580: "Aabenraa", 607: "Fredericia", 615: "Horsens", 621: "Kolding",
  630: "Vejle", 657: "Herning", 661: "Holstebro",
  665: "Lemvig", 671: "Struer", 706: "Syddjurs", 707: "Norddjurs",
  710: "Favrskov", 727: "Odder", 730: "Randers", 740: "Silkeborg",
  741: "Samsø", 746: "Skanderborg", 751: "Aarhus", 756: "Ikast-Brande",
  760: "Ringkøbing-Skjern", 766: "Hedensted", 773: "Morsø", 779: "Skive",
  787: "Thisted", 791: "Viborg", 810: "Brønderslev", 813: "Frederikshavn",
  820: "Vesthimmerlands", 825: "Læsø", 840: "Rebild", 846: "Mariagerfjord",
  849: "Jammerbugt", 851: "Aalborg", 860: "Hjørring",
};

/**
 * Generiske søgeindgange. Disse to er faste og virker uanset kommune -
 * det er kun spørgsmålet om HVILKEN af dem, der er kommuneafhængigt.
 */
export const ARKIVPLATFORME = {
  filarkiv: {
    navn: "FilArkiv",
    soegeUrl: "https://public.filarkiv.dk/",
    beskrivelse:
      "Fælles søgeindgang for de kommuner der er gået på FilArkiv. Søges på adresse; " +
      "offentlige sager kan åbnes direkte i browseren.",
    automatiserbar: false,
    note: "Kun afsluttede og offentligt tilgængelige sager. Fortrolige og verserende sager vises ikke.",
  },
  weblager: {
    navn: "WebLager",
    soegeUrl: "https://www.weblager.dk/",
    beskrivelse:
      "Bruges af de kommuner der ikke er på FilArkiv. Søges på adresse, matrikel eller ejendomsnummer.",
    automatiserbar: false,
    note:
      "weblager.dk afviser automatiseret adgang i robots.txt, og enkelte kommuner kræver MitID-login. " +
      "Opslaget er derfor bygget som et assisteret flow, ikke som scraping.",
  },
};

/**
 * Kommune -> arkivplatform.
 *
 * Listen er med vilje kort. Der findes ikke en offentlig, vedligeholdt
 * oversigt over hvilke kommuner der bruger hvad, og et forkert gæt sender
 * brugeren hen i det forkerte arkiv og får dem til at konkludere at der
 * ikke findes en byggesag. Derfor: kun poster nogen har bekræftet står
 * her, resten håndteres som UKORTLAGT, hvor brugeren får begge links.
 *
 * Udfyldes løbende af data/bekræftede-opslag.json når brugere bekræfter.
 */
export const ARKIV_PR_KOMMUNE = {
  // Eksempel på formatet - udfyld efterhånden som opslag bekræftes:
  // 751: { platform: "filarkiv", sikkerhed: Sikkerhed.BEKRÆFTET, bekræftetDato: "2026-08-30" },
};

/**
 * Kommune -> netselskab.
 *
 * Der findes ingen bekræftet åben API til dette opslag. Posterne herunder
 * er INDIKATIVE: de bygger på netselskabernes egne beskrivelser af deres
 * forsyningsområde, og flere kommuner er delt mellem to selskaber, så selv
 * en rigtig kommune-mapping kan give det forkerte selskab for en konkret
 * adresse. Modul 9 viser derfor altid værdien som "skal bekræftes" og
 * henviser til det endelige opslag på målerens adresse.
 */
export const NETSELSKAB_PR_KOMMUNE = {
  101: ["Radius Elnet"], 147: ["Radius Elnet"], 151: ["Radius Elnet"],
  153: ["Elektrus"], 155: ["Radius Elnet"], 157: ["Radius Elnet"],
  159: ["Radius Elnet"], 161: ["Elektrus"], 163: ["Radius Elnet"],
  165: ["Radius Elnet"], 167: ["Radius Elnet"], 169: ["Radius Elnet"],
  173: ["Radius Elnet"], 175: ["Radius Elnet"], 183: ["Radius Elnet"],
  185: ["Radius Elnet"], 187: ["Radius Elnet"], 190: ["Radius Elnet"],
  201: ["Radius Elnet"], 210: ["Radius Elnet"], 217: ["Radius Elnet"],
  219: ["Radius Elnet"], 223: ["Radius Elnet"], 230: ["Radius Elnet"],
  240: ["Radius Elnet"], 250: ["Radius Elnet"], 253: ["Cerius"],
  259: ["Cerius"], 260: ["Radius Elnet"], 265: ["Cerius"],
  269: ["Cerius"], 270: ["Radius Elnet"], 306: ["Cerius"],
  316: ["Cerius"], 320: ["Cerius"], 326: ["Cerius"], 329: ["Cerius"],
  330: ["Cerius"], 336: ["Cerius"], 340: ["Cerius"], 350: ["Cerius"],
  360: ["Cerius"], 370: ["Cerius"], 376: ["Cerius"], 390: ["Cerius"],
  400: ["Bornholms Energi og Forsyning"],
  461: ["Vores Elnet"], 430: ["Vores Elnet"], 440: ["Vores Elnet"],
  450: ["Vores Elnet"], 480: ["Vores Elnet"], 479: ["Vores Elnet"],
  482: ["Vores Elnet"], 492: ["Ærø Elforsyning"],
  410: ["Konstant Net"], 420: ["Vores Elnet"],
  607: ["Konstant Net"], 621: ["Konstant Net"], 630: ["Konstant Net"],
  751: ["N1", "Dinel"], 740: ["N1"], 746: ["Dinel"], 727: ["Dinel"],
  710: ["N1"], 730: ["N1"], 706: ["N1"], 707: ["N1"],
  851: ["N1"], 840: ["N1"], 846: ["N1"], 820: ["N1"], 810: ["N1"],
  849: ["N1"], 791: ["N1"], 779: ["N1"], 657: ["N1"], 756: ["N1"],
  615: ["N1"], 766: ["N1"], 661: ["N1"], 665: ["N1"], 671: ["N1"],
  787: ["Thy-Mors Energi Elnet"], 773: ["Thy-Mors Energi Elnet"],
  813: ["Nord Energi Net"], 860: ["Nord Energi Net"], 825: ["Læsø Elnet"],
  760: ["RAH Net"], 561: ["N1"], 563: ["N1"], 573: ["N1"], 575: ["N1"],
  510: ["Dinel"], 530: ["N1"], 540: ["Sønderborg Forsyning"],
  550: ["N1"], 580: ["N1"], 741: ["N1"],
};

/**
 * Vindzone efter DK NA til EN 1991-1-4. Grundvindhastigheden er forhøjet
 * i et bælte langs den jyske vestkyst og i Nordjylland.
 */
export const VINDZONE_PR_KOMMUNE = {
  standard: { vb0: 24, beskrivelse: "Danmark generelt" },
  forhoejet: { vb0: 27, beskrivelse: "Vestkystnært Jylland og Nordjylland" },
  forhoejedeKommuner: [
    573, 760, 665, 671, 787, 773, 860, 813, 849, 825, 561, 563,
  ],
  kilde: "EN 1991-1-4 DK NA - zoneinddelingen SKAL VERIFICERES mod annekset for den konkrete adresse",
};

export const kommuneNavn = (kode) => KOMMUNER[Number(kode)] ?? null;

export function kommunekodeFraNavn(navn) {
  if (!navn) return null;
  const n = String(navn).trim().toLowerCase();
  for (const [kode, k] of Object.entries(KOMMUNER)) {
    if (k.toLowerCase() === n) return Number(kode);
  }
  // Faldes tilbage på delvis match ("Aarhus Kommune" -> "Aarhus")
  for (const [kode, k] of Object.entries(KOMMUNER)) {
    if (n.startsWith(k.toLowerCase())) return Number(kode);
  }
  return null;
}

export function vindzone(kommunekode) {
  const forhoejet = VINDZONE_PR_KOMMUNE.forhoejedeKommuner.includes(Number(kommunekode));
  return forhoejet
    ? { ...VINDZONE_PR_KOMMUNE.forhoejet, zone: "forhoejet" }
    : { ...VINDZONE_PR_KOMMUNE.standard, zone: "standard" };
}
