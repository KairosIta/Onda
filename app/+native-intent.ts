/**
 * RN Track Player apre la MainActivity con `trackplayer://notification.click`
 * quando si tocca la media notification. Expo puo' consegnare lo stesso
 * intent usando lo scheme dell'app (`onda://notification.click`). Senza una
 * riscrittura Expo Router cerca una route chiamata `notification.click` e
 * mostra la schermata Unmatched Route.
 *
 * `+native-intent` viene eseguito sia sul cold start sia quando l'app e' gia'
 * aperta. Limitiamo la riscrittura ai due URL noti: tutti gli altri deep link
 * continuano a seguire il routing normale.
 */
const NOTIFICATION_CLICK_URLS = new Set([
  'trackplayer://notification.click',
  'onda://notification.click',
]);

type SystemPathEvent = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: SystemPathEvent): string {
  const normalized = path.trim().replace(/\/+$/, '').toLowerCase();
  return NOTIFICATION_CLICK_URLS.has(normalized) ? '/player' : path;
}
