/** `AppState` di React Native per i test in Node: parte attiva, la cambia `setAppState`. */

type Listener = (status: string) => void;

const listeners = new Set<Listener>();

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
