import { useSyncExternalStore } from 'react';
import { getStoredCredentials, saveCredential, subscribeCredentials } from '@/services/credentials';
import {
  type Credentials,
  isSourceActive,
  loadSourceSettings,
  type SourceSettings,
} from '@/services/sourceSettings';
import { setSourceAccess } from '@/services/sources/access';
import { readJSON, writeJSON } from '@/services/storage';
import { SOURCE_IDS, type SourceId } from '@/types/track';

/**
 * Le sorgenti come le ha scelte la persona: interruttori, benvenuto e
 * invito su MMKV, credenziali nel Keystore (`services/credentials`).
 *
 * Al caricamento collega le sorgenti a questo stato (`setSourceAccess`):
 * va importato prima di qualunque richiesta di catalogo, e lo importa il
 * layout radice.
 */

const KEY = 'sources.v1';

let settings: SourceSettings = loadSourceSettings(readJSON(KEY));

export interface SourcesState {
  settings: SourceSettings;
  credentials: Credentials;
  /** Le sorgenti che lavorano davvero: accese e con le credenziali che servono. */
  active: Record<SourceId, boolean>;
}

function compute(): SourcesState {
  const credentials = getStoredCredentials();
  const active = Object.fromEntries(
    SOURCE_IDS.map((id) => [id, isSourceActive(id, settings, credentials)]),
  ) as Record<SourceId, boolean>;
  return { settings, credentials, active };
}

let snapshot = compute();
const listeners = new Set<() => void>();

function publish(): void {
  snapshot = compute();
  listeners.forEach((l) => l());
}

subscribeCredentials(publish);

setSourceAccess({
  credentials: getStoredCredentials,
  isActive: (id) => snapshot.active[id],
});

function commit(next: SourceSettings): void {
  settings = next;
  writeJSON(KEY, settings);
  publish();
}

/** Per chi non e' un componente: il player e l'albero di Android Auto. */
export function subscribeSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSources(): SourcesState {
  return snapshot;
}

export function useSources(): SourcesState {
  return useSyncExternalStore(subscribeSources, getSources);
}

export function setSourceEnabled(id: SourceId, enabled: boolean): void {
  commit({ ...settings, enabled: { ...settings.enabled, [id]: enabled } });
}

export function finishWelcome(): void {
  if (!settings.welcomeDone) commit({ ...settings, welcomeDone: true });
}

export function dismissJamendoInvite(): void {
  commit({ ...settings, jamendoInviteDismissed: true });
}

/** Lancia se il Keystore rifiuta la scrittura (vedi `saveCredential`). */
export function setCredential(name: keyof Credentials, value: string): void {
  saveCredential(name, value);
}
