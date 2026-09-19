export interface ExplorerProfile {
  id: string;
  avatarId: string;
  createdAt: number;
  lastUsedAt: number;
}

const STORAGE_KEY = "dyslex-shield-explorer-profiles";

function readProfiles(): ExplorerProfile[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((profile): profile is ExplorerProfile => Boolean(profile?.id && profile?.avatarId)) : [];
  } catch {
    return [];
  }
}

export function getExplorerProfiles(): ExplorerProfile[] {
  return readProfiles();
}

export function saveExplorerProfile(avatarId: string): ExplorerProfile {
  const now = Date.now();
  const profiles = readProfiles();
  const existing = profiles.find((profile) => profile.avatarId === avatarId);
  const profile = existing
    ? { ...existing, lastUsedAt: now }
    : { id: `explorer-${now}`, avatarId, createdAt: now, lastUsedAt: now };
  const nextProfiles = [...profiles.filter((item) => item.id !== profile.id), profile].slice(-6);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProfiles));
  } catch {
    // The active profile remains available even when browser storage is unavailable.
  }
  return profile;
}
