import { getDb } from './index';

/** Danske kæder, appen kender til. `365discount` er Coops discountkæde. */
export const STORES = [
  'Netto',
  'Rema 1000',
  '365discount',
  'Lidl',
  'Aldi',
  'Føtex',
  'Bilka',
  'Coop 365',
  'SuperBrugsen',
  'Meny',
  'Andet',
] as const;

export type Store = (typeof STORES)[number];

export type Catalog = {
  id: number;
  store: string;
  week_label: string | null;
  valid_to: string | null;
  scanned_at: string;
};

export type Offer = {
  id: number;
  catalog_id: number;
  name: string;
  price_dkk: number | null;
  unit: string | null;
  quantity: string | null;
  category: string | null;
};

export type OfferInput = Omit<Offer, 'id' | 'catalog_id'>;

export async function insertCatalog(
  store: string,
  weekLabel: string | null,
  validTo: string | null,
  offers: OfferInput[],
): Promise<number> {
  const db = await getDb();
  let catalogId = 0;
  await db.withTransactionAsync(async () => {
    const res = await db.runAsync(
      'INSERT INTO catalogs (store, week_label, valid_to, scanned_at) VALUES (?, ?, ?, ?)',
      [store, weekLabel, validTo, new Date().toISOString()],
    );
    catalogId = res.lastInsertRowId;
    for (const o of offers) {
      await db.runAsync(
        `INSERT INTO offers (catalog_id, name, price_dkk, unit, quantity, category)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [catalogId, o.name, o.price_dkk, o.unit, o.quantity, o.category],
      );
    }
  });
  return catalogId;
}

export async function deleteCatalog(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM catalogs WHERE id = ?', [id]);
}

export async function listCatalogs(): Promise<(Catalog & { offer_count: number })[]> {
  const db = await getDb();
  return db.getAllAsync<Catalog & { offer_count: number }>(
    `SELECT c.*, COUNT(o.id) AS offer_count
     FROM catalogs c LEFT JOIN offers o ON o.catalog_id = c.id
     GROUP BY c.id ORDER BY c.scanned_at DESC`,
  );
}

export async function listOffers(catalogId?: number): Promise<(Offer & { store: string })[]> {
  const db = await getDb();
  if (catalogId) {
    return db.getAllAsync<Offer & { store: string }>(
      `SELECT o.*, c.store FROM offers o JOIN catalogs c ON c.id = o.catalog_id
       WHERE o.catalog_id = ? ORDER BY o.category, o.name`,
      [catalogId],
    );
  }
  return db.getAllAsync<Offer & { store: string }>(
    `SELECT o.*, c.store FROM offers o JOIN catalogs c ON c.id = o.catalog_id
     ORDER BY c.scanned_at DESC, o.category, o.name`,
  );
}
