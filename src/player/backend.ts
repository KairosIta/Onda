import type {
  BrowseCategory,
  MediaItem,
  PlaybackState,
  PlayerEventName,
  PlayerEventOf,
  PlayerEvent,
  PlayerSetup,
  Progress,
  RepeatMode,
} from './types';

/**
 * Il contratto fra Onda e il modulo nativo del player, oggi il nostro su
 * Media3 (`modules/onda-player`, collegato da `media3.ts`). Cambiare modulo
 * vuol dire scrivere un altro backend: il resto dell'app non se ne accorge.
 *
 * Contiene solo quello che Onda usa. Oltre ai metodi, ogni backend deve:
 * - dichiarare contenuto musicale e prendere il focus audio in esclusiva;
 * - mettere in pausa quando l'audio sta per uscire dall'altoparlante
 *   (cuffie staccate);
 * - tenere svegli CPU e Wi-Fi a schermo spento, perche' i brani sono stream;
 * - fermare la riproduzione quando l'app viene tolta dai recenti;
 * - eseguire da solo i `commands` di `setup`, anche con il JS sospeso o
 *   mai partito, come in Android Auto: il servizio nativo li ricorda;
 * - far partire da solo i brani scelti in Android Auto (`setBrowseTree`).
 *
 * I comandi tornano subito e il nativo li esegue nell'ordine in cui
 * arrivano: un `seekTo` dopo `setMediaItems` vale per il brano appena
 * caricato. Le letture vedono gia' l'effetto dei comandi dati prima:
 * `useQueue` legge l'indice attivo subito dopo aver caricato la coda in
 * attesa, per inserire un brano dopo quello corrente.
 */
export interface PlayerControls {
  /** Una volta per processo, prima che le schermate usino il player. */
  setup(options: PlayerSetup): void;
  /**
   * Il gestore degli eventi quando l'app non e' in primo piano; ogni evento
   * va sbrigato in pochi secondi. Va registrato all'avvio del processo,
   * fuori dall'albero React e prima di `setup` (`index.js`). Android Auto
   * non lo chiama: in macchina comanda il nativo.
   */
  registerBackgroundHandler(handler: (event: PlayerEvent) => Promise<void>): void;
  /** Eventi in primo piano; ritorna la funzione che smette di ascoltare. */
  subscribe<K extends PlayerEventName>(
    name: K,
    listener: (event: PlayerEventOf<K>) => void,
  ): () => void;

  /** A coda finita (`ended`) non riparte da solo: prima un `seekTo` o un salto. */
  play(): void;
  /** Annulla anche un `scheduleRetry` in attesa. */
  pause(): void;
  seekTo(seconds: number): void;
  /**
   * Passa al brano dopo; sull'ultimo non fa niente, ma con `all` torna al
   * primo. Con `one` si naviga come senza ripetizione.
   */
  skipToNext(): void;
  /**
   * Torna al brano precedente; oltre i primi 3 secondi riavvolge quello
   * attivo. Sul primo brano riavvolge, ma con `all` va all'ultimo, come in
   * Media3.
   */
  skipToPrevious(): void;
  skipToIndex(index: number): void;
  /**
   * Riprepara il brano attivo dopo un errore; fuori da un errore non fa
   * niente. Non riparte da solo.
   */
  retry(): void;
  /**
   * `retry` e poi `play` fra `seconds` secondi, con un timer nativo: con
   * l'app in background i timer JS sono fermi. Ne vale uno alla volta, e lo
   * annullano un cambio di brano, `pause` e `cancelRetry`.
   */
  scheduleRetry(seconds: number): void;
  cancelRetry(): void;

  /**
   * Sostituisce la coda, attiva `startIndex` e si mette all'inizio del
   * brano. Non scarica niente e non apre la notifica prima di un `play`: la
   * coda ripristinata si carica anche solo per inserirci un brano.
   */
  setMediaItems(items: MediaItem[], startIndex: number): void;
  /** Accoda in fondo. */
  addMediaItem(item: MediaItem): void;
  insertMediaItem(index: number, item: MediaItem): void;
  insertMediaItems(index: number, items: MediaItem[]): void;
  removeMediaItem(index: number): void;
  /**
   * Toglie gli elementi in `[from, to)`. Se fra loro c'e' il brano attivo,
   * diventa attivo il primo che resta dopo di loro, come in Media3:
   * `sourceGuard` ci conta. Con lo shuffle "dopo" segue l'ordine shuffle.
   * Se dopo non resta niente diventa attivo il primo della coda: con `all`
   * si continua da li', altrimenti la riproduzione finisce (`ended`).
   */
  removeMediaItems(from: number, to: number): void;
  /** `to` e' la posizione finale dell'elemento: spostare da 2 a 3 li scambia. */
  moveMediaItem(from: number, to: number): void;

  getQueue(): MediaItem[];
  getActiveMediaItem(): MediaItem | null;
  /** `null` a coda vuota. */
  getActiveIndex(): number | null;
  getProgress(): Progress;
  /** Se sta davvero uscendo audio: durante un buffering e' falso. */
  isPlaying(): boolean;

  setRepeatMode(mode: RepeatMode): void;
  /** Lo shuffle nativo non riordina la coda: tiene a parte una permutazione. */
  setShuffleModeEnabled(enabled: boolean): void;

  /**
   * Mette in pausa fra `seconds` secondi di orologio, che passano anche a
   * riproduzione ferma; un timer nuovo sostituisce il precedente. E' nativo,
   * perche' un timer JS sotto Doze scatterebbe in ritardo.
   */
  sleepAfter(seconds: number): void;
  cancelSleep(): void;

  /**
   * L'albero di Android Auto; sostituisce quello di prima. Scelto un brano
   * in macchina, il nativo mette in coda i brani della stessa cartella e
   * parte da solo, senza passare dal JS: quello che non deve suonare non
   * va messo nell'albero.
   */
  setBrowseTree(categories: BrowseCategory[]): void;
}

export interface PlayerBackend extends PlayerControls {
  usePlaybackState(): PlaybackState;
  useIsPlaying(): boolean;
}
