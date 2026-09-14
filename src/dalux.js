/* Vejen fra en sag til en opgave i Dalux FM.
 *
 * Der skrives aldrig til Dalux uden et menneske. Dialogen viser den præcise
 * payload, før den sendes, og opgaveteksten beder altid om ét ekstra svar:
 * hvad var årsagen? Uden det felt måler vi kun, om vi er overbevisende —
 * ikke om vi har ret.
 */

import { state, skriv } from './state.js';
import { fmtKr, fmtKwh } from './engine.js';
import { fgNavn } from './taxonomy.js';

/** Henter skabeloner, prioriteter, teams og statusser fra Dalux. */
export async function hentMetadata() {
  if (state.daluxMetadata) return state.daluxMetadata;
  const data = await state.klienter.dalux.call('dalux_workorder_metadata', {});
  state.daluxMetadata = normaliser(data);
  return state.daluxMetadata;
}

function normaliser(d) {
  const tag = (x) => (Array.isArray(x) ? x : (x && (x.items || x.data)) || []);
  return {
    templates:  tag(d && (d.templates || d.workOrderTemplates)),
    priorities: tag(d && (d.priorities || d.workOrderPriorities)),
    teams:      tag(d && (d.teams || d.workOrderTeams)),
    statuses:   tag(d && (d.statuses || d.workOrderStatuses)),
    raa: d,
  };
}

/** Dalux-prioritet, der passer til sagens P-niveau. Vælges kun som forslag. */
export function foreslaaPrioritet(sag, priorities) {
  const navne = { P1: /akut|kritisk|høj|1/i, P2: /høj|high|2/i, P3: /normal|medium|3/i, P4: /lav|low|4/i };
  const re = navne[sag.prioritet];
  const match = (priorities || []).find((p) => re && re.test(String(p.name || p.navn || p.title || '')));
  return match ? idAf(match) : null;
}

export const idAf = (o) => String(o && (o.id ?? o.priorityId ?? o.templateId ?? o.teamId ?? o.statusId ?? ''));
export const navnAf = (o) => String(o && (o.name ?? o.navn ?? o.title ?? o.description ?? idAf(o)));

/** Opgavetekst til servicepartneren. Skrevet, så den kan læses på en telefon. */
export function opgavetekst(sag) {
  const l = [];
  l.push(`ENERGI- OG DRIFTSHUB · SAG ${sag.id}`);
  l.push('');
  l.push(`Butik: ${sag.butik} (${sag.butiksnummer})`);
  l.push(`Anlæg: ${sag.anlaeg} · ${fgNavn(sag.faggruppe)}`);
  l.push(`Prioritet: ${sag.prioritet} · Fag: ${sag.fag}`);
  l.push('');
  l.push('HVAD VI TROR');
  l.push(sag.hypotese);
  l.push(`Konfidens: ${sag.konfidens.samlet} %.`);
  l.push('');
  l.push('HVORFOR');
  for (const s of sag.signaler) {
    l.push(`· ${s.detektor} (${s.periode}): ${s.symptom}`);
    for (const [k, v] of s.evidens) l.push(`    ${k}: ${v}`);
  }
  l.push('');
  l.push('HVAD DET KOSTER AT LADE STÅ');
  l.push(`${fmtKr(sag.krAar)} kr./år. ${sag.krMetode}`);
  l.push('');
  l.push('HVAD DER SKAL TJEKKES — I DENNE RÆKKEFØLGE');
  sag.tjekpunkter.forEach((t, i) => l.push(`${i + 1}. ${t}`));
  l.push('');
  l.push('HVAD VI FORVENTER, DER BLIVER FUNDET');
  l.push(sag.forventetFund || '—');
  if (sag.forbehold.length) {
    l.push('');
    l.push('FORBEHOLD');
    for (const f of sag.forbehold) l.push(`· ${f}`);
  }
  if (sag.manglerKilder.length) {
    l.push(`· Følgende kilder er ikke koblet på endnu: ${sag.manglerKilder.join(', ')}.`);
  }
  l.push('');
  l.push('SVAR VENLIGST PÅ DETTE VED AFSLUTNING');
  l.push('Hvad var årsagen? (Feltet er det, der gør overvågningen bedre næste gang —');
  l.push('uden det ved vi kun, om anbefalingen lød overbevisende, ikke om den var rigtig.)');
  return l.join('\n');
}

/** Bygger den payload, dalux_create_workorder skal have. */
export function byggWorkOrder(sag, valg) {
  const wo = {
    subject: `${sag.sagsnavn} — ${sag.butik}`,
    description: opgavetekst(sag),
  };
  if (valg.buildingId) wo.buildingId = valg.buildingId;
  if (valg.templateId) wo.templateId = valg.templateId;
  if (valg.priorityId) wo.priorityId = valg.priorityId;
  if (valg.teamId)     wo.teamId = valg.teamId;
  if (valg.assetId)    wo.assetId = valg.assetId;
  if (valg.deadline)   wo.deadline = valg.deadline;
  return wo;
}

/** Opretter opgaven. Kaldes først efter at brugeren har set payloaden. */
export async function opretOpgave(sag, valg) {
  const workOrder = byggWorkOrder(sag, valg);
  const svar = await state.klienter.dalux.call('dalux_create_workorder', { workOrder });
  const id = svar && (svar.workOrderId || svar.id || (svar.data && svar.data.workOrderId));
  skriv(`Opgave oprettet i Dalux på ${sag.butik}${id ? ` (id ${id})` : ''}.`, 'ok');
  return { id: id ? String(id) : null, svar };
}

/** Henter bygningens anlæg, så sagen kan hænges på det rigtige komponent. */
export async function hentAnlaeg(daluxBuildingId) {
  if (!daluxBuildingId) return [];
  const data = await state.klienter.dalux.call('dalux_list_building_assets', { id: String(daluxBuildingId), limit: 200 });
  return Array.isArray(data) ? data : (data && (data.items || data.assets || data.data)) || [];
}

/** Henter åbne opgaver på bygningen — bruges til at foreslå sambesøg. */
export async function hentOpgaver(daluxBuildingId) {
  if (!daluxBuildingId) return [];
  const data = await state.klienter.dalux.call('dalux_list_building_workorders', { id: String(daluxBuildingId), limit: 50 });
  return Array.isArray(data) ? data : (data && (data.items || data.workOrders || data.data)) || [];
}
