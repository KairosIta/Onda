/** `AppState` di React Native per i test in Node: parte attiva, la cambia `setAppState`. */

type Listener = (status: string) => void;

const listeners = new Set<Listener>();

/** Permessi gia' concessi nel dispositivo finto: nessuna finestra di sistema. */
export const Platform = { OS: 'android', Version: 34 };
export const PermissionsAndroid = {
  check: async () => true,
  request: async () => 'granted',
};
export const Linking = { openSettings: async () => {} };

export const AppState = {
  currentState: 'active',
  addEventListener(_type: 'change', listener: Listener) {
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  },
};

export function setAppState(status: 'active' | 'background' | 'inactive'): void {
  AppState.currentState = status;
  listeners.forEach((l) => l(status));
}
