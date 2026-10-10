import { AUDIUS_OPEN_MUSIC_LICENSE_URL } from '@/config/legal';
import type { SourceId, Track } from '@/types/track';

/**
 * Come si presenta ogni sorgente: nome, sigla e attribuzione. Modulo puro,
 * separato dagli adapter: le righe, il player e i test lo leggono senza
 * toccare la rete, e vale anche per i brani salvati di una sorgente spenta
 * nel registro.
 *
 * E' un `Record` su `SourceId`: una sorgente aggiunta a `SOURCE_IDS` senza
 * la sua descrizione non compila.
 */
export interface SourceMeta {
  /** Nome della piattaforma, come si scrive a schermo. */
  label: string;
  /** Sigla di tre lettere nelle righe e nelle schede. */
  badge: string;
  /** Diritti da dichiarare quando il brano non ne porta di suoi. */
  defaultRights: string;
  /**
   * Condizioni della piattaforma da collegare accanto a ogni brano, oltre
   * alla licenza del brano stesso, quando l'attribuzione lo richiede.
   */
  termsLink?: { label: string; url: string };
}

export const SOURCE_META: Record<SourceId, SourceMeta> = {
  audius: {
    label: 'Audius',
    badge: 'AUD',
    defaultRights: 'Regime di diritti non specificato',
    // Il modello pubblico di Audius non porta sempre tutti gli elementi di
    // attribuzione: accanto al regime dichiarato va il collegamento
    // esplicito alla Open Music License (THIRD_PARTY_CONTENT.md).
    termsLink: { label: 'Open Music License', url: AUDIUS_OPEN_MUSIC_LICENSE_URL },
  },
  jamendo: {
    label: 'Jamendo',
    badge: 'JAM',
    defaultRights: 'Creative Commons',
  },
};

/** Un elenco di nomi in italiano: «A», «A e B», «A, B e C». */
export function joinLabels(labels: readonly string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

/**
 * L'avviso per una sorgente caduta, con il nome della piattaforma: prima
 * ogni schermata scriveva l'id, e a schermo compariva «jamendo non risponde».
 */
export const failureNotice = ({ source, message }: { source: SourceId; message: string }): string =>
  `${SOURCE_META[source].label} non risponde: ${message}`;

export type AttributionPart =
  { kind: 'link'; label: string; url: string } | { kind: 'text'; label: string };

export interface Attribution {
  /** «Brano fornito da …». */
  provider: string;
  parts: AttributionPart[];
}

/**
 * Cosa mostrare sotto il player per attribuire un brano, nell'ordine:
 * la pagina originale; la licenza del brano come collegamento se la
 * sorgente ne da' l'URL, altrimenti il regime di diritti come testo; le
 * condizioni della piattaforma, se ne ha.
 *
 * Prima la regola stava nel player come `track.source === 'audius'`, e una
 * terza sorgente sarebbe finita nel ramo di Jamendo senza che nessuno se ne
 * accorgesse. Per Audius e Jamendo il risultato e' quello di prima, con una
 * sola differenza voluta: un brano Jamendo senza URL di licenza non
 * mostrava alcun diritto, ora dichiara «Creative Commons» come testo.
 */
export function describeAttribution(track: Track): Attribution {
  const meta = SOURCE_META[track.source];
  const parts: AttributionPart[] = [];
  if (track.sourceUrl) {
    parts.push({ kind: 'link', label: 'Pagina del brano', url: track.sourceUrl });
  }

  const rights = track.rightsLabel ?? meta.defaultRights;
  if (track.licenseUrl) parts.push({ kind: 'link', label: rights, url: track.licenseUrl });
  else parts.push({ kind: 'text', label: rights });

  if (meta.termsLink) parts.push({ kind: 'link', ...meta.termsLink });
  return { provider: meta.label, parts };
}
