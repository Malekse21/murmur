import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MascotSession } from "@/lib/mascot-session";

type StoredRecord = { session: MascotSession; twitchToken?: string };
type StoreFile = Record<string, StoredRecord>;

const dataFile = process.env.BLOUB_DATA_FILE || path.join(process.cwd(), ".data", "sessions.json");
let queue = Promise.resolve();

async function serialized<T>(work: () => Promise<T>): Promise<T> {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}

async function readStore(): Promise<StoreFile> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreFile;
  } catch {
    return {};
  }
}

async function writeStore(store: StoreFile) {
  await mkdir(path.dirname(dataFile), { recursive: true });
  const temporary = `${dataFile}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(store), { encoding: "utf8", mode: 0o600 });
  await rename(temporary, dataFile);
}

export function validOverlayKey(value: string | null | undefined): value is string {
  return Boolean(value && /^[A-Za-z0-9_-]{32,80}$/.test(value));
}

export async function readBloubSession(key: string) {
  return serialized(async () => (await readStore())[key]?.session ?? null);
}

export async function writeBloubSession(key: string, session: MascotSession) {
  if (!validOverlayKey(key) || session.overlayKey !== key) throw new Error("Invalid overlay key.");
  return serialized(async () => {
    const store = await readStore();
    store[key] = { ...store[key], session };
    await writeStore(store);
  });
}

export async function updateBloubSession(key: string, update: (session: MascotSession) => MascotSession) {
  if (!validOverlayKey(key)) return null;
  return serialized(async () => {
    const store = await readStore();
    const current = store[key]?.session;
    if (!current) return null;
    const session = update(current);
    store[key] = { ...store[key], session };
    await writeStore(store);
    return session;
  });
}

export async function readTwitchToken(key: string) {
  return serialized(async () => (await readStore())[key]?.twitchToken ?? null);
}

export async function writeTwitchToken(key: string, twitchToken: string) {
  return serialized(async () => {
    const store = await readStore();
    const current = store[key];
    if (!current) throw new Error("Create an overlay session before connecting Twitch.");
    store[key] = { ...current, twitchToken };
    await writeStore(store);
  });
}

export async function deleteTwitchToken(key: string) {
  return serialized(async () => {
    const store = await readStore();
    const current = store[key];
    if (!current) return;
    const { twitchToken: _removed, ...remaining } = current;
    store[key] = remaining;
    await writeStore(store);
  });
}

export async function listStoredBloubRecords() {
  return serialized(async () => {
    const store = await readStore();
    return Object.entries(store).map(([key, record]) => ({ key, ...record }));
  });
}
