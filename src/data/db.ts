import Dexie, { type Table } from 'dexie';
import type { Game, Profile } from '../domain/types';

class AppDb extends Dexie {
  profiles!: Table<Profile, string>;
  games!: Table<Game, string>;

  constructor() {
    super('paralysis-analyse');
    this.version(1).stores({
      profiles: 'id, name, createdAt',
      games: 'id, createdAt, status, title',
    });
  }
}

export const db = new AppDb();

export async function saveGame(game: Game): Promise<void> {
  await db.games.put(game);
}

export interface ExportFile {
  app: 'paralysis-analyse';
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  games: Game[];
}

export async function exportAll(): Promise<ExportFile> {
  return {
    app: 'paralysis-analyse',
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles: await db.profiles.toArray(),
    games: await db.games.toArray(),
  };
}

/** Merges an export into the database; records with the same id are overwritten. */
export async function importAll(data: unknown): Promise<{ profiles: number; games: number }> {
  const f = data as Partial<ExportFile>;
  if (f?.app !== 'paralysis-analyse' || !Array.isArray(f.profiles) || !Array.isArray(f.games)) {
    throw new Error('Keine gültige ParalysisAnalyse-Exportdatei');
  }
  await db.transaction('rw', db.profiles, db.games, async () => {
    await db.profiles.bulkPut(f.profiles!);
    await db.games.bulkPut(f.games!);
  });
  return { profiles: f.profiles.length, games: f.games.length };
}
