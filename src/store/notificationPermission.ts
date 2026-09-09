import { useSyncExternalStore } from 'react';
import { AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  type NotificationPermission,
  type RequestResult,
  notificationPermissionRequired,
  notificationRemedy,
  shouldRequest,
  statusFromCheck,
  statusFromRequest,
} from '@/services/notificationPolicy';

/**
 * Stato del permesso notifiche, chiesto al primo play e non all'avvio.
 * Le regole stanno in `services/notificationPolicy.ts`; qui c'è solo il
 * ponte con Android e con il ciclo di vita dell'app.
 */

const PERMISSION = 'android.permission.POST_NOTIFICATIONS';

let status: NotificationPermission = notificationPermissionRequired(Platform.OS, Platform.Version)
  ? 'unknown'
  : 'unnecessary';
let askedThisRun = false;
const listeners = new Set<() => void>();

function set(next: NotificationPermission): void {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getNotificationPermission = (): NotificationPermission => status;

export function useNotificationPermission(): NotificationPermission {
  return useSyncExternalStore(subscribe, getNotificationPermission, getNotificationPermission);
}

/** Rilegge lo stato senza mostrare finestre: serve tornando dalle impostazioni. */
export async function refreshNotificationPermission(): Promise<void> {
  if (status === 'unnecessary') return;
  try {
    const granted = await PermissionsAndroid.check(PERMISSION as never);
    set(statusFromCheck(granted, status));
  } catch {
    // Senza risposta il permesso resta com'era: meglio nessun avviso di uno falso.
  }
}

/**
 * Mostra la finestra di sistema, una sola volta per avvio dell'app a meno
 * che non sia la persona a chiederlo (`force`): chi ha negato non va
 * rincorso a ogni brano.
 */
export async function requestNotificationPermission({ force = false } = {}): Promise<void> {
  if (!shouldRequest(status)) return;
  if (askedThisRun && !force) return;
  askedThisRun = true;
  try {
    const result = (await PermissionsAndroid.request(PERMISSION as never)) as RequestResult;
    set(statusFromRequest(result));
  } catch {
    // Come sopra: senza esito non si cambia stato.
  }
}

/** L'azione dell'avviso: richiedere o aprire la pagina dell'app. */
export function resolveNotificationPermission(): void {
  const remedy = notificationRemedy(status);
  if (remedy?.kind === 'request') {
    requestNotificationPermission({ force: true });
  } else if (remedy?.kind === 'settings') {
    Linking.openSettings().catch(() => {});
  }
}

/**
 * Controlla lo stato all'avvio e a ogni ritorno in primo piano: chi
 * riabilita le notifiche dalle impostazioni deve vedere sparire l'avviso.
 */
export function startNotificationPermissionWatch(): () => void {
  if (status === 'unnecessary') return () => {};
  refreshNotificationPermission();
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') refreshNotificationPermission();
  });
  return () => sub.remove();
}
