import { getDb } from './index';

export type CoachMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export async function addCoachMessage(
  role: 'user' | 'assistant',
  content: string,
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO coach_messages (role, content, created_at) VALUES (?, ?, ?)',
    [role, content, new Date().toISOString()],
  );
  return res.lastInsertRowId;
}

/** Ældst først — klar til at sendes som samtalehistorik. */
export async function listCoachMessages(limit = 40): Promise<CoachMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CoachMessage>(
    'SELECT * FROM coach_messages ORDER BY id DESC LIMIT ?',
    [limit],
  );
  return rows.reverse();
}

export async function clearCoachMessages(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM coach_messages');
}
