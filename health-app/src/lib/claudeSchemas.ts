import { z } from 'zod';

/**
 * Svarformaterne for de tre analyser. De ligger for sig selv uden
 * React Native-afhængigheder, så formen kan efterprøves i testene.
 *
 * Felterne er med vilje ikke valgfrie: strukturerede svar bliver mere
 * forudsigelige, når modellen skal udfylde alt — det, der kan mangle, er
 * `null` i stedet.
 */

export const MealAnalysisSchema = z.object({
  titel: z.string(),
  varer: z.array(
    z.object({
      navn: z.string(),
      portion: z.string(),
      kcal: z.number(),
    }),
  ),
  kcal: z.number(),
  protein_g: z.number(),
  fedt_g: z.number(),
  kulhydrat_g: z.number(),
  sikkerhed: z.enum(['lav', 'middel', 'hoej']),
  bemaerkning: z.string(),
});

export type MealAnalysis = z.infer<typeof MealAnalysisSchema>;

export const CatalogReadSchema = z.object({
  butik: z.string(),
  uge: z.string().nullable(),
  gyldig_til: z.string().nullable(),
  tilbud: z.array(
    z.object({
      navn: z.string(),
      pris_dkk: z.number().nullable(),
      maengde: z.string().nullable(),
      enhed: z.string().nullable(),
      kategori: z.string(),
    }),
  ),
});

export type CatalogRead = z.infer<typeof CatalogReadSchema>;

export const MealPlanSchema = z.object({
  maaltider: z.array(
    z.object({
      dag: z.string(),
      ret: z.string(),
      hovedvarer: z.array(z.string()),
      kcal_pr_portion: z.number(),
      protein_g_pr_portion: z.number(),
      baseret_paa_tilbud: z.array(z.string()),
    }),
  ),
  indkoebsliste: z.array(
    z.object({
      vare: z.string(),
      maengde: z.string(),
      butik: z.string(),
      pris_dkk: z.number().nullable(),
    }),
  ),
  bemaerkning: z.string(),
});

export type MealPlanOut = z.infer<typeof MealPlanSchema>;
