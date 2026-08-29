import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { getSetting, setSetting } from '../db/settings';
import {
  CatalogReadSchema,
  MealAnalysisSchema,
  MealPlanSchema,
  type CatalogRead,
  type MealAnalysis,
  type MealPlanOut,
} from './claudeSchemas';

export type { CatalogRead, MealAnalysis, MealPlanOut };

/**
 * Adgang til Claude.
 *
 * Nøglen ligger i Android Keystore via expo-secure-store og indtastes én gang
 * under Indstillinger. Den er aldrig en del af koden eller af APK'en. Fordi
 * appen kalder API'et direkte fra telefonen (ingen server), skal SDK'et have
 * `dangerouslyAllowBrowser` — det er i orden her, hvor nøglen er din egen og
 * kun ligger på din egen enhed.
 */

const KEY_STORE = 'anthropic_api_key';
export const MODEL_KEY = 'anthropic_model';
export const DEFAULT_MODEL = 'claude-opus-5';

export const MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5', hint: 'Bedst — standard' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5', hint: 'Billigere, stadig stærk' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', hint: 'Billigst og hurtigst' },
];

/** På web findes Keystore ikke; der bruges browserens eget lager til afprøvning. */
const webStore = {
  get: (k: string) => {
    try {
      return globalThis.localStorage?.getItem(k) ?? null;
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      globalThis.localStorage?.setItem(k, v);
    } catch {
      /* ignoreres */
    }
  },
  del: (k: string) => {
    try {
      globalThis.localStorage?.removeItem(k);
    } catch {
      /* ignoreres */
    }
  },
};

export async function getApiKey(): Promise<string | null> {
  if (Platform.OS === 'web') return webStore.get(KEY_STORE);
  return SecureStore.getItemAsync(KEY_STORE);
}

export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (Platform.OS === 'web') {
    webStore.set(KEY_STORE, trimmed);
    return;
  }
  await SecureStore.setItemAsync(KEY_STORE, trimmed);
}

export async function clearApiKey(): Promise<void> {
  if (Platform.OS === 'web') {
    webStore.del(KEY_STORE);
    return;
  }
  await SecureStore.deleteItemAsync(KEY_STORE);
}

export async function hasApiKey(): Promise<boolean> {
  return (await getApiKey()) !== null;
}

export async function getModel(): Promise<string> {
  return (await getSetting(MODEL_KEY)) ?? DEFAULT_MODEL;
}

export function setModel(model: string): Promise<void> {
  return setSetting(MODEL_KEY, model);
}

export class MissingApiKeyError extends Error {
  constructor() {
    super('Der er ingen API-nøgle gemt. Tilføj den under Indstillinger.');
    this.name = 'MissingApiKeyError';
  }
}

async function client(): Promise<Anthropic> {
  const apiKey = await getApiKey();
  if (!apiKey) throw new MissingApiKeyError();
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/** Oversætter SDK'ets fejl til noget, der kan stå på en telefonskærm. */
export function describeError(err: unknown): string {
  if (err instanceof MissingApiKeyError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) {
    return 'API-nøglen blev afvist. Tjek den under Indstillinger.';
  }
  if (err instanceof Anthropic.RateLimitError) {
    return 'For mange kald lige nu. Prøv igen om lidt.';
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Forespørgslen blev afvist: ${err.message}`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return 'Ingen forbindelse til Claude. Tjek internettet.';
  }
  if (err instanceof Anthropic.APIError) {
    return `Fejl fra Claude (${err.status}): ${err.message}`;
  }
  return err instanceof Error ? err.message : String(err);
}

const imageBlock = (base64: string): Anthropic.ImageBlockParam => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
});

/* ------------------------------------------------- fase 4: mad fra billede */

const MEAL_SYSTEM = `Du analyserer billeder af måltider for en dansk bruger, der tæller kalorier.

Sådan gør du:
- Nævn kun det, du faktisk kan se på billedet. Gæt ikke ingredienser, der ikke er synlige.
- Anslå portionsstørrelser ud fra kendte referencer i billedet (tallerkenstørrelse, bestik, hænder).
- Brug almindelige danske madvarer og danske navne.
- Kalorier og makroer er skøn, og de skal være konsistente: protein × 4 + kulhydrat × 4 + fedt × 9 skal ligge tæt på kcal-tallet.
- Sæt "sikkerhed" til "lav", hvis billedet er utydeligt, retten er svær at gennemskue, eller portionen er svær at bedømme. Vær ærlig frem for optimistisk.
- "bemaerkning" er én kort dansk sætning om, hvad der er mest usikkert ved skønnet.`;

export async function analyzeMealPhoto(
  base64: string,
  hint?: string,
): Promise<MealAnalysis> {
  const c = await client();
  const res = await c.messages.parse({
    model: await getModel(),
    max_tokens: 4000,
    system: MEAL_SYSTEM,
    output_config: { format: zodOutputFormat(MealAnalysisSchema) },
    messages: [
      {
        role: 'user',
        content: [
          imageBlock(base64),
          {
            type: 'text',
            text: hint?.trim()
              ? `Analysér måltidet. Brugerens egen note: ${hint.trim()}`
              : 'Analysér måltidet.',
          },
        ],
      },
    ],
  });
  if (!res.parsed_output) throw new Error('Svaret kunne ikke læses.');
  return res.parsed_output;
}

/* -------------------------------------------- fase 5: tilbudsavis og plan */

const CATALOG_SYSTEM = `Du læser danske supermarkeders tilbudsaviser (Netto, Rema 1000, 365discount, Lidl, Aldi, Føtex, Bilka, Coop 365, SuperBrugsen, Meny m.fl.).

Sådan gør du:
- Skriv kun tilbud, du rent faktisk kan læse på billedet. Find ikke på varer eller priser.
- "pris_dkk" er tilbudsprisen i kroner som tal. Kan prisen ikke læses, sæt null.
- "maengde" er den mængde, prisen gælder for, som den står i avisen (fx "500 g", "2 stk.", "1 kg").
- "kategori" er én af: kød, fisk, mejeri, grønt, frugt, kolonial, brød, frost, drikkevarer, snacks, andet.
- Kan butikkens navn ikke ses, skriv "Ukendt".`;

export async function readCatalog(
  images: string[],
  storeHint?: string,
): Promise<CatalogRead> {
  const c = await client();
  const res = await c.messages.parse({
    model: await getModel(),
    max_tokens: 16000,
    system: CATALOG_SYSTEM,
    output_config: { format: zodOutputFormat(CatalogReadSchema) },
    messages: [
      {
        role: 'user',
        content: [
          ...images.map(imageBlock),
          {
            type: 'text',
            text: storeHint
              ? `Læs tilbuddene ud af siderne. Brugeren siger, det er fra ${storeHint}.`
              : 'Læs tilbuddene ud af siderne.',
          },
        ],
      },
    ],
  });
  if (!res.parsed_output) throw new Error('Tilbudsavisen kunne ikke læses.');
  return res.parsed_output;
}

const PLAN_SYSTEM = `Du laver ugentlige madplaner for én dansk voksen, der er i gang med et vægttab.

Sådan gør du:
- Byg planen op om de varer, der står på tilbud i den vedlagte liste. Nævn hvilke tilbud hver ret bygger på.
- Ret dig efter brugerens kalorie- og proteinmål pr. dag. Aftensmaden må typisk fylde 35-45 % af dagens kalorier.
- Varieret og almindelig dansk hverdagsmad. Grønt til hvert måltid, og protein i hver ret.
- Skriv ærlige kalorie- og proteintal pr. portion. Rund til nærmeste 10 kcal og nærmeste 5 g protein.
- Indkøbslisten skal dække præcis det, planen kræver — med butik og pris, hvor tilbuddet oplyser det.
- "bemaerkning" er én kort dansk sætning om, hvad planen forudsætter.`;

export async function generateMealPlan(input: {
  offersText: string;
  targetKcal: number;
  proteinG: number;
  days: number;
  preferences: string;
}): Promise<MealPlanOut> {
  const c = await client();
  const res = await c.messages.parse({
    model: await getModel(),
    max_tokens: 16000,
    system: PLAN_SYSTEM,
    output_config: { format: zodOutputFormat(MealPlanSchema) },
    messages: [
      {
        role: 'user',
        content: `Lav en madplan for ${input.days} dage.

Mine mål pr. dag: ${input.targetKcal} kcal og mindst ${input.proteinG} g protein.
${input.preferences ? `Præferencer: ${input.preferences}` : 'Ingen særlige præferencer.'}

Tilbud på lager lige nu:
${input.offersText}`,
      },
    ],
  });
  if (!res.parsed_output) throw new Error('Madplanen kunne ikke læses.');
  return res.parsed_output;
}

/* ------------------------------------------------------- fase 6: coachen */

const COACH_SYSTEM = `Du er sundhedscoach i en privat app for én bruger, der arbejder mod et vægttabsmål. Du svarer på dansk, kort og konkret.

Du får et databilag med brugerens faktiske tal: vægtudvikling, beregnet kaloriebehov og -mål, mad-log, træningslog og Health Connect-data. Alt, du siger om brugeren, skal kunne genfindes i det bilag.

Regler:
- Find aldrig på tal. Mangler et tal i bilaget, så sig at det mangler, og hvad brugeren skal logge for at få det.
- Kaloriemål og proteinmål er allerede regnet ud af appen. Gentag dem — lav ikke dine egne.
- Anbefalinger skal bygge på almindeligt anerkendte principper: kalorieunderskud, tilstrækkeligt protein, styrketræning for at holde på muskelmassen, kondition og søvn.
- Vær konkret: peg på det, brugeren faktisk har spist og trænet, og foreslå den mindste ændring der virker.
- Er vægttabet gået i stå (under 0,1 kg/uge over tre uger) eller går det for hurtigt (over ca. 1 % af kropsvægten om ugen), så sig det og foreslå en justering.
- Du er ikke læge. Ved tegn på spiseforstyrrelse, meget lavt indtag over tid eller helbredsmæssige bekymringer henviser du til egen læge eller en klinisk diætist.
- Hold svaret under 200 ord, medmindre brugeren beder om mere. Brug korte afsnit, ikke lange punktlister.`;

export type CoachTurn = { role: 'user' | 'assistant'; content: string };

export async function coachReply(
  history: CoachTurn[],
  contextBlock: string,
): Promise<string> {
  const c = await client();
  const res = await c.messages.create({
    model: await getModel(),
    max_tokens: 4000,
    system: [
      { type: 'text', text: COACH_SYSTEM, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      {
        role: 'user',
        content: `Her er mine data lige nu.\n\n${contextBlock}`,
      },
      {
        role: 'assistant',
        content: 'Tak — jeg har læst dine tal og holder mig til dem.',
      },
      ...history.map((t) => ({ role: t.role, content: t.content })),
    ],
  });

  if (res.stop_reason === 'refusal') {
    return 'Jeg kan ikke svare på det her. Prøv at spørge om noget andet — eller tal med din læge, hvis det handler om helbred.';
  }
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
