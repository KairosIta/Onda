/**
 * Il tocco sulla media notification puo' aprire la MainActivity con un URL
 * del player: `onda://notification.click`, con lo scheme dell'app, oppure
 * `trackplayer://notification.click`, usato in passato con RNTP. Senza una
 * riscrittura Expo Router cerca una route chiamata `notification.click` e
 * mostra la schermata Unmatched Route.
 *
 * Oggi non arriva nessuno dei due: `@rntp/player` 5.8 apre l'app con
 * l'intent di avvio, senza URL, e il tocco la riporta dov'era (vedi
 * TODO.md). La riscrittura resta pronta per il modulo Media3 che prendera'
 * il posto di RNTP, la cui sessione aprira' `onda://notification.click`.
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
