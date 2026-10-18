import { AppState } from 'react-native';

/**
 * Chiama `callback` ogni volta che l'app torna in primo piano. In
 * background gli eventi del player vanno al gestore headless, non ai
 * listener delle schermate: chi mostra la coda o un permesso rilegge lo
 * stato al ritorno invece di fidarsi dell'ultimo evento visto. Ritorna la
 * funzione che smette di ascoltare.
 */
export function onAppActive(callback: () => void): () => void {
  const subscription = AppState.addEventListener('change', (status) => {
    if (status === 'active') callback();
  });
  return () => subscription.remove();
}
