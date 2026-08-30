/**
 * Brandtekniske afstandskrav anvendt af modul 10.
 *
 * VIGTIGT: Dette er en regelmotor, ikke en gengivelse af gældende ret.
 * Kravene til solcelleanlæg på tage følger af BR18 kapitel 5 med
 * tilhørende vejledninger, Beredskabsstyrelsens vejledninger om
 * redningsberedskabets indsatsmuligheder samt det lokale beredskabs
 * konkrete vurdering. Tallene herunder er projekteringsværdier, der
 * afspejler almindelig dansk praksis - de skal verificeres mod den
 * gældende udgave af vejledningerne og aftales med det stedlige beredskab,
 * før et layout lægges til grund for en ansøgning.
 *
 * Hver regel bærer sit eget `grundlag`-felt, som skrives direkte i
 * rapporten, så læseren kan se hvad kontrollen bygger på.
 */

export const BRANDREGLER = {
  version: "0.1-udkast",
  gaeldendeFra: "2026-08-30",
  generelForbehold:
    "Afstandskravene er projekteringsværdier efter almindelig praksis. De erstatter " +
    "ikke det stedlige beredskabs konkrete vurdering, og de skal verificeres mod den " +
    "gældende udgave af BR18 kapitel 5 og Beredskabsstyrelsens vejledninger.",

  regler: [
    {
      id: "friareal-tagkant",
      navn: "Friareal langs tagkant",
      kravM: 1.0,
      grundlag:
        "Redningsberedskabet skal kunne færdes langs tagkanten og komme til " +
        "brandventilation og afvanding. Almindelig praksis er mindst 1 m frit.",
      alvor: "kritisk",
    },
    {
      id: "brandvej-bredde",
      navn: "Bredde på gennemgående brandvej over taget",
      kravM: 1.0,
      grundlag:
        "En fri gang på mindst 1 m, så mandskab kan nå alle dele af taget " +
        "uden at træde på anlægget.",
      alvor: "kritisk",
    },
    {
      id: "brandvej-afstand",
      navn: "Største afstand mellem gennemgående brandveje",
      kravM: 40.0,
      grundlag:
        "Et sammenhængende panelfelt må ikke være så stort, at der ikke kan " +
        "nås ind til midten. Praksis ligger typisk på 20-40 m mellem frie gange.",
      alvor: "kritisk",
    },
    {
      id: "afstand-brandsektionsvaeg",
      navn: "Afstand til brandsektions- og brandkamsadskillelse",
      kravM: 1.0,
      grundlag:
        "Anlægget må ikke fore ild over en brandsektionsadskillelse. Der holdes " +
        "frit på begge sider, og kabler føres ikke hen over adskillelsen uden " +
        "brændbar isolering afbrudt.",
      alvor: "kritisk",
    },
    {
      id: "afstand-brandventilation",
      navn: "Afstand til brandventilation og røglemme",
      kravM: 1.5,
      grundlag:
        "Røglemme skal kunne åbne frit, og røgen må ikke ledes ind under " +
        "panelfeltet.",
      alvor: "kritisk",
    },
    {
      id: "afstand-ovenlys",
      navn: "Afstand til ovenlys",
      kravM: 1.0,
      grundlag:
        "Ovenlys er både en mulig indsatsvej og et svagt punkt i tagfladen. " +
        "Paneler placeres ikke, så de spærrer adgangen.",
      alvor: "vigtig",
    },
    {
      id: "afstand-tagopgang",
      navn: "Fri plads ved tagopgang og adgangsluge",
      kravM: 2.0,
      grundlag: "Mandskab skal kunne komme op og ud med udstyr.",
      alvor: "kritisk",
    },
    {
      id: "noedafbryder",
      navn: "Nødafbryder for redningsberedskabet",
      kravM: null,
      grundlag:
        "Der skal kunne afbrydes for anlægget fra et sted, redningsberedskabet " +
        "kan nå - typisk ved hovedtavle eller ved bygningens indgang - og " +
        "afbryderen skal være tydeligt mærket. DC-siden forbliver spændingsførende " +
        "frem til afbryderen, så placeringen skal fremgå af situationsplanen.",
      alvor: "kritisk",
      erDokumentationskrav: true,
    },
    {
      id: "maerkning",
      navn: "Mærkning og situationsplan til beredskabet",
      kravM: null,
      grundlag:
        "Anlægget mærkes ved hovedtavle, målerskab og ved tilgang til taget, og " +
        "der udarbejdes en situationsplan, der viser panelfelter, kabelføringer, " +
        "invertere og afbrydere.",
      alvor: "vigtig",
      erDokumentationskrav: true,
    },
  ],
};

export const regel = (id) => BRANDREGLER.regler.find((r) => r.id === id);
