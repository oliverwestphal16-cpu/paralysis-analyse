import Dexie, { type Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_CRITERIA } from '../domain/rating';
import type { Game, GamePhoto, Profile, RatingCriterion } from '../domain/types';

/** Key/value settings; currently only the rating criteria. */
interface SettingRow {
  id: string;
  value: unknown;
}

class AppDb extends Dexie {
  profiles!: Table<Profile, string>;
  games!: Table<Game, string>;
  photos!: Table<GamePhoto, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('paralysis-analyse');
    this.version(1).stores({
      profiles: 'id, name, createdAt',
      games: 'id, createdAt, status, title',
    });
    this.version(2).stores({
      photos: 'id, gameId, createdAt',
    });
    this.version(3).stores({
      settings: 'id',
    });
  }
}

export const db = new AppDb();

export async function saveGame(game: Game): Promise<void> {
  await db.games.put(game);
}

/** Deletes a game together with its photos. */
export async function deleteGame(id: string): Promise<void> {
  await db.transaction('rw', db.games, db.photos, async () => {
    await db.photos.where('gameId').equals(id).delete();
    await db.games.delete(id);
  });
}

const CRITERIA_KEY = 'criteria';

export async function loadCriteria(): Promise<RatingCriterion[]> {
  const row = await db.settings.get(CRITERIA_KEY);
  return (row?.value as RatingCriterion[] | undefined) ?? DEFAULT_CRITERIA;
}

export async function saveCriteria(criteria: RatingCriterion[]): Promise<void> {
  await db.settings.put({ id: CRITERIA_KEY, value: criteria });
}

/** Current rating criteria (defaults until changed in the settings). */
export function useCriteria(): RatingCriterion[] {
  return useLiveQuery(loadCriteria, []) ?? DEFAULT_CRITERIA;
}

export interface ExportFile {
  app: 'paralysis-analyse';
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  games: Game[];
  criteria?: RatingCriterion[];
}

/** Photos are deliberately not exported (size); the originals live in the device gallery. */
export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'paralysis-analyse',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: await db.profiles.toArray(),
    games: await db.games.toArray(),
    criteria: await loadCriteria(),
  };
}

/** Merges an export into the database; records with the same id are overwritten. */
export async function importAll(data: unknown): Promise<{ profiles: number; games: number }> {
  const f = data as Partial<ExportFile>;
  if (f?.app !== 'paralysis-analyse' || !Array.isArray(f.profiles) || !Array.isArray(f.games)) {
    throw new Error('Keine gültige ParalysisAnalyse-Exportdatei');
  }
  await db.transaction('rw', db.profiles, db.games, db.settings, async () => {
    await db.profiles.bulkPut(f.profiles!);
    await db.games.bulkPut(f.games!);
    if (Array.isArray(f.criteria)) await db.settings.put({ id: CRITERIA_KEY, value: f.criteria });
  });
  return { profiles: f.profiles.length, games: f.games.length };
}
