/**
 * MODUL 4 - Dokumentationssøgning (statik)
 *
 * Automatiseringsgrad: MANUEL/ASSISTERET. Dette er flaskehalsen i hele
 * værktøjet.
 *
 * Byggesagsarkiver ligger ikke ét sted. De er fordelt på to konkurrerende
 * platforme, og en kommune bruger typisk kun den ene:
 *
 *   FilArkiv (public.filarkiv.dk) - fælles søgeindgang for en stor gruppe
 *       kommuner. Søges på adresse; offentlige sager åbnes i browseren.
 *   WebLager (weblager.dk)        - bruges af de øvrige kommuner. Søges på
 *       adresse, matrikel eller ejendomsnummer, og kræver i nogle kommuner
 *       MitID-login.
 *
 * Værktøjet scraper ingen af dem. weblager.dk afviser automatiseret adgang
 * i robots.txt, og begge arkiver viser kun afsluttede, offentligt
 * tilgængelige sager - fortrolige sager er låste, og verserende sager kan
 * mangle helt. Modulet åbner derfor det rigtige sted og lader mennesket
 * træffe afgørelsen.
 *
 * DEN AFGØRENDE REGEL: et fundet dokument må ALDRIG gå videre til modul 5
 * uden at brugeren udtrykkeligt har bekræftet, at det er den rigtige
 * bygning, den gældende revision, og at den aflæste værdi er rigtig.
 */

import { ARKIVPLATFORME, ARKIV_PR_KOMMUNE, Sikkerhed, kommuneNavn } from "../config/kommuner.js";
import { laes, opdater } from "../lib/lager.js";
import { bekraeftet, mangler, antagelse, hentet, beregnet } from "../lib/kilde.js";

const BEKRAEFTELSESFIL = "bekraeftede-opslag.json";

/** Sammenstiller den indbyggede tabel med de opslag, brugere har bekræftet. */
export async function arkivForKommune(kommunekode) {
  const kode = Number(kommunekode);
  const gemt = await laes(BEKRAEFTELSESFIL, { arkiver: {}, netselskaber: {} });
  const fraBruger = gemt.arkiver?.[kode];
  const indbygget = ARKIV_PR_KOMMUNE[kode];
  const post = fraBruger ?? indbygget;

  if (!post) {
    return {
      sikkerhed: Sikkerhed.UKORTLAGT,
      platform: null,
      begge: true,
      begrundelse:
        `Det er ikke kortlagt, om ${kommuneNavn(kode) ?? "kommunen"} bruger FilArkiv eller ` +
        "WebLager. De to systemer overlapper ikke, så et forkert valg giver et tomt " +
        "resultat, der ligner 'ingen byggesag'. Prøv derfor begge, og bekræft " +
        "hvilket der virkede - så er det kortlagt til næste gang.",
    };
  }
  return {
    sikkerhed: post.sikkerhed ?? Sikkerhed.INDIKATIV,
    platform: post.platform,
    begge: post.sikkerhed !== Sikkerhed.BEKRAEFTET,
    bekraeftetDato: post.bekraeftetDato ?? null,
    begrundelse: post.sikkerhed === Sikkerhed.BEKRAEFTET
      ? `Bekræftet ${post.bekraeftetDato} af en tidligere søgning i samme kommune.`
      : "Indikativt - bekræft at arkivet er det rigtige.",
  };
}

/** Registrerer at et arkiv virkede for en kommune, så tabellen bliver bedre. */
export async function bekraeftArkiv(kommunekode, platform) {
  if (!ARKIVPLATFORME[platform]) throw new Error(`Ukendt arkivplatform: ${platform}`);
  await opdater(BEKRAEFTELSESFIL, (n) => {
    n.arkiver = n.arkiver ?? {};
    n.arkiver[Number(kommunekode)] = {
      platform, sikkerhed: Sikkerhed.BEKRAEFTET,
      bekraeftetDato: new Date().toISOString().slice(0, 10),
    };
    return n;
  }, { arkiver: {}, netselskaber: {} });
  return { kommunekode: Number(kommunekode), platform, sikkerhed: Sikkerhed.BEKRAEFTET };
}

export async function bekraeftNetselskab(kommunekode, navn) {
  await opdater(BEKRAEFTELSESFIL, (n) => {
    n.netselskaber = n.netselskaber ?? {};
    n.netselskaber[Number(kommunekode)] = {
      navn, sikkerhed: Sikkerhed.BEKRAEFTET,
      bekraeftetDato: new Date().toISOString().slice(0, 10),
    };
    return n;
  }, { arkiver: {}, netselskaber: {} });
  return { kommunekode: Number(kommunekode), navn };
}

/**
 * @param {object} input
 * @param {number} input.kommunekode
 * @param {string} input.adresse
 * @param {string} [input.matrikelnummer] @param {string} [input.ejerlav]
 * @param {Array}  [input.bekræftedeDokumenter] dokumenter brugeren har fundet OG bekræftet
 */
export async function koer(input) {
  const advarsler = [];
  const kommunekode = input.kommunekode;

  if (!kommunekode) {
    return {
      modul: 4, navn: "Dokumentationssøgning (statik)", status: "ufuldstaendig",
      blokerende: ["Kommunen er ikke bestemt i modul 1, så arkivet kan ikke udpeges."],
      advarsler,
    };
  }

  const valg = await arkivForKommune(kommunekode);
  const soegninger = byggSoegninger(valg, input);

  /* --- Bekræftede dokumenter ---------------------------------------- */
  const dokumenter = (input.bekraeftedeDokumenter ?? []).map(normaliserDokument);
  const ubekraeftede = dokumenter.filter((d) => !d.bekraeftet);
  if (ubekraeftede.length) {
    advarsler.push(
      `${ubekraeftede.length} dokument(er) er registreret uden bekræftelse og indgår ` +
      "IKKE i den strukturelle vurdering. Bekræft at dokumentet gælder den rigtige " +
      "bygning og den gældende revision."
    );
  }

  const brugbare = dokumenter.filter((d) => d.bekraeftet);

  /* --- Bæreevne ------------------------------------------------------ */
  const baereevne = udtraekBaereevne(brugbare);
  if (!baereevne) {
    advarsler.push(
      "Der er ikke bekræftet en dokumenteret bæreevne. Modul 5 kan derfor ikke " +
      "konkludere andet end 'utilstrækkelig dokumentation'."
    );
  }

  return {
    modul: 4,
    navn: "Dokumentationssøgning (statik)",
    status: baereevne ? "ok" : "kraever-brugerhandling",
    automatisering: "manuel-assisteret",
    advarsler,
    kommune: hentet(kommuneNavn(kommunekode) ?? String(kommunekode), "Modul 1"),
    arkivvalg: {
      platform: valg.platform
        ? (valg.sikkerhed === Sikkerhed.BEKRAEFTET
            ? bekraeftet(ARKIVPLATFORME[valg.platform].navn, "Tidligere bekræftet opslag",
                { dato: valg.bekraeftetDato })
            : antagelse(ARKIVPLATFORME[valg.platform].navn, "Intern kommune-tabel (indikativ)",
                { note: valg.begrundelse }))
        : mangler("Intern kommune-tabel", valg.begrundelse),
      sikkerhed: valg.sikkerhed,
      visBegge: valg.begge,
    },
    soegninger,
    vejledning: {
      overskrift: "Sådan finder du den statiske dokumentation",
      trin: [
        "Åbn søgelinket herunder og søg på adressen (eller matrikelnummer, hvis adressen ikke giver noget).",
        "Find byggesagen for den rigtige bygning - en ejendom kan have flere bygninger og flere sager.",
        "Led efter statiske beregninger, konstruktionstegninger, spærplaner eller " +
          "en statisk dokumentationsrapport. Det er tagkonstruktionens bæreevne, du skal bruge.",
        "Kontrollér at tegningen er den GÆLDENDE revision, og at den dækker det tag, " +
          "panelerne skal ligge på - ikke en senere tilbygning eller en ældre udgave.",
        "Aflæs den dokumenterede nyttelast eller reservekapacitet i kN/m2 eller kg/m2.",
        "Registrér dokumentet herunder med sagsnummer, tegningsnummer og dato, og bekræft aflæsningen.",
      ],
      hvisIntetFindes: [
        "Arkiverne viser kun afsluttede, offentligt tilgængelige sager. En tom søgning " +
          "betyder ikke, at der ikke findes dokumentation.",
        "Spørg kommunen om aktindsigt i sagen - fortrolige og personfølsomme sager er låste i arkivet.",
        "Spørg ejeren eller driftsafdelingen: de har ofte selv tegningerne.",
        "Er den oprindelige dokumentation ikke til at opdrive, skal bæreevnen fastlægges " +
          "ved en opmåling og beregning af en rådgivende ingeniør. Det er den " +
          "sikreste vej, og for et erhvervstag ofte den eneste farbare.",
      ],
    },
    dokumenter,
    dokumenteretBaereevne: baereevne ?? mangler(
      "Byggesagsarkiv / rådgiver",
      "Ingen bekræftet dokumentation for tagets bæreevne"
    ),
    forbehold:
      "Værktøjet søger ikke selv i arkiverne. Det udpeger det rigtige arkiv og " +
      "registrerer, hvad brugeren har fundet og bekræftet. Ansvaret for at " +
      "dokumentet er det rigtige, ligger hos den, der bekræfter det.",
  };
}

function byggSoegninger(valg, input) {
  const ud = [];
  const platforme = valg.begge || !valg.platform
    ? ["filarkiv", "weblager"]
    : [valg.platform];

  for (const p of platforme) {
    const a = ARKIVPLATFORME[p];
    ud.push({
      platform: p,
      navn: a.navn,
      url: a.soegeUrl,
      soegetekst: input.adresse ?? null,
      alternativSoegning: input.matrikelnummer
        ? `Matrikel ${input.matrikelnummer}${input.ejerlav ? `, ${input.ejerlav}` : ""}`
        : null,
      beskrivelse: a.beskrivelse,
      note: a.note,
      anbefalet: valg.platform === p,
    });
  }
  return ud;
}

function normaliserDokument(d) {
  return {
    id: d.id ?? `dok-${Math.random().toString(36).slice(2, 8)}`,
    titel: d.titel ?? "Uden titel",
    platform: d.platform ?? null,
    sagsnummer: d.sagsnummer ?? null,
    tegningsnummer: d.tegningsnummer ?? null,
    dokumentdato: d.dokumentdato ?? null,
    revision: d.revision ?? null,
    url: d.url ?? null,
    filnavn: d.filnavn ?? null,
    type: d.type ?? "ukendt",
    // Aflæst af brugeren fra dokumentet
    aflaestBaereevne: d.aflaestBaereevne ?? null,
    aflaestEnhed: d.aflaestEnhed ?? null,
    aflaestNote: d.aflaestNote ?? null,
    // De tre ting brugeren skal have taget stilling til
    bekraeftetRigtigBygning: Boolean(d.bekraeftetRigtigBygning),
    bekraeftetGaeldendeRevision: Boolean(d.bekraeftetGaeldendeRevision),
    bekraeftetAflaesning: Boolean(d.bekraeftetAflaesning),
    bekraeftetAf: d.bekraeftetAf ?? null,
    bekraeftetDato: d.bekraeftetDato ?? null,
    get bekraeftet() {
      return this.bekraeftetRigtigBygning && this.bekraeftetGaeldendeRevision && this.bekraeftetAflaesning;
    },
  };
}

/**
 * Finder den bekræftede bæreevne. Er der flere, vælges den laveste - det
 * er den, der begrænser.
 */
function udtraekBaereevne(dokumenter) {
  const med = dokumenter.filter((d) => d.aflaestBaereevne != null && d.aflaestEnhed);
  if (!med.length) return null;

  const iKNPrM2 = med.map((d) => ({
    dok: d,
    vaerdi: d.aflaestEnhed === "kg/m2"
      ? (Number(d.aflaestBaereevne) * 9.81) / 1000
      : Number(d.aflaestBaereevne),
  })).filter((x) => Number.isFinite(x.vaerdi));

  if (!iKNPrM2.length) return null;
  const lavest = iKNPrM2.reduce((a, b) => (b.vaerdi < a.vaerdi ? b : a));

  return bekraeftet(rund(lavest.vaerdi, 3), "Byggesagsarkiv, bekræftet af bruger", {
    enhed: "kN/m2",
    reference: [
      lavest.dok.titel,
      lavest.dok.sagsnummer && `sag ${lavest.dok.sagsnummer}`,
      lavest.dok.tegningsnummer && `tegning ${lavest.dok.tegningsnummer}`,
      lavest.dok.revision && `rev. ${lavest.dok.revision}`,
    ].filter(Boolean).join(", "),
    dato: lavest.dok.dokumentdato ?? lavest.dok.bekraeftetDato,
    note: iKNPrM2.length > 1
      ? `Laveste af ${iKNPrM2.length} bekræftede værdier - den begrænsende. ${lavest.dok.aflaestNote ?? ""}`.trim()
      : lavest.dok.aflaestNote,
  });
}

const rund = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
