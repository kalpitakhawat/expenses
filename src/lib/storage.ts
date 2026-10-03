import type { Profile, Snapshot } from '../types';

const LIBRARY_KEY = 'expenses.profiles.v1';
const LEGACY_CONFIG_KEY = 'expenses.config.v1';
const LEGACY_CACHE_KEY = 'expenses.cache.v1';
const PREVIEW_KEY = 'expenses.preview';
const PREVIEW_DATA_KEY = 'expenses.preview.data';

export type Library = {
  activeId: string | null;
  profiles: Profile[];
};

function cacheKey(id: string) {
  return `expenses.cache.${id}`;
}

export function readLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Library;
      const profiles = Array.isArray(parsed.profiles) ? parsed.profiles.filter(isProfile) : [];
      const activeId = profiles.some((profile) => profile.id === parsed.activeId) ? parsed.activeId : profiles[0]?.id ?? null;
      return { activeId, profiles };
    }
  } catch {
    // Fall through to the older single-connection save.
  }
  return migrateLegacy();
}

export function writeLibrary(library: Library) {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
}

export function readProfileCache(id: string): (Snapshot & { savedAt: number }) | null {
  try {
    const raw = localStorage.getItem(cacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot & { savedAt: number };
    if (!Array.isArray(parsed.events) || !Array.isArray(parsed.expenses)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProfileCache(id: string, snapshot: Snapshot) {
  localStorage.setItem(cacheKey(id), JSON.stringify({ ...snapshot, savedAt: Date.now() }));
}

export function clearProfileCache(id: string) {
  localStorage.removeItem(cacheKey(id));
}

function migrateLegacy(): Library {
  try {
    const raw = localStorage.getItem(LEGACY_CONFIG_KEY);
    if (!raw) return { activeId: null, profiles: [] };
    const parsed = JSON.parse(raw) as { webAppUrl?: string; token?: string };
    if (!parsed.webAppUrl || !parsed.token) return { activeId: null, profiles: [] };
    const id = crypto.randomUUID();
    const library: Library = {
      activeId: id,
      profiles: [{ id, name: 'My sheet', webAppUrl: parsed.webAppUrl, token: parsed.token }],
    };
    writeLibrary(library);
    const oldCache = localStorage.getItem(LEGACY_CACHE_KEY);
    if (oldCache) localStorage.setItem(cacheKey(id), oldCache);
    localStorage.removeItem(LEGACY_CONFIG_KEY);
    localStorage.removeItem(LEGACY_CACHE_KEY);
    return library;
  } catch {
    return { activeId: null, profiles: [] };
  }
}

function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Profile;
  return Boolean(profile.id && profile.name && profile.webAppUrl && profile.token);
}

export function previewFlag() {
  return sessionStorage.getItem(PREVIEW_KEY) === '1';
}

export function setPreviewFlag(on: boolean) {
  if (on) sessionStorage.setItem(PREVIEW_KEY, '1');
  else sessionStorage.removeItem(PREVIEW_KEY);
}

export function readPreviewData(): Snapshot | null {
  try {
    const raw = sessionStorage.getItem(PREVIEW_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function writePreviewData(snapshot: Snapshot) {
  sessionStorage.setItem(PREVIEW_DATA_KEY, JSON.stringify(snapshot));
}

export function clearPreviewData() {
  sessionStorage.removeItem(PREVIEW_KEY);
  sessionStorage.removeItem(PREVIEW_DATA_KEY);
}
