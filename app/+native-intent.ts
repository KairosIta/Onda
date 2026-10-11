/**
 * Il tocco sulla media notification apre la MainActivity con
 * `onda://notification.click` (la sessione del player, in
 * `modules/onda-player`). Senza una riscrittura Expo Router cerca una route
 * chiamata `notification.click` e mostra la schermata Unmatched Route: qui
 * diventa il player.
 *
 * `+native-intent` viene eseguito sia sul cold start sia quando l'app e' gia'
 * aperta. Limitiamo la riscrittura all'URL noto: tutti gli altri deep link
 * continuano a seguire il routing normale.
 */
const NOTIFICATION_CLICK_URLS = new Set(['onda://notification.click']);

type SystemPathEvent = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: SystemPathEvent): string {
  const normalized = path.trim().replace(/\/+$/, '').toLowerCase();
  return NOTIFICATION_CLICK_URLS.has(normalized) ? '/player' : path;
}
