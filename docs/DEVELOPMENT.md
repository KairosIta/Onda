<p align="center">
  <a href="../README.md">← Torna alla presentazione di Onda</a>
</p>

# Guida per sviluppatori

Configurazione dell'ambiente, architettura, collaudo e build di release di
Onda. Per la panoramica del prodotto, gli screenshot e lo stato corrente vedi
il [README principale](../README.md).

## Configurazione dell'ambiente

Per compilare o installare una copia personale su Linux o Windows usa prima la
guida dedicata [BUILD_PERSONAL.md](BUILD_PERSONAL.md). I comandi canonici sono:

```bash
npm ci
npm run doctor
npm run install:personal
```

Le sezioni sotto spiegano l'ambiente di sviluppo e la pipeline del maintainer.

### Cosa serve

- [Node.js](https://nodejs.org/) 22.15 o successivo e npm
- **JDK 17** (non JDK 21)
- **Android SDK 36** con build-tools 36.0.0
- un dispositivo Android con debug USB, oppure un emulatore
- un Client ID gratuito di Jamendo, da inserire nell'app al primo avvio

> [!IMPORTANT]
> Expo Go non è sufficiente: il player e lo storage usano moduli nativi.
> La prima compilazione scarica anche NDK 27.1 e CMake.

### Installazione

```bash
npm ci
npx expo run:android
```

Al termine Onda verrà installata e avviata sul dispositivo collegato: al primo
avvio chiede il Client ID ottenuto dal
[portale sviluppatori Jamendo](https://devportal.jamendo.com/). Dagli
avvii successivi basta eseguire `npm start` e aprire l'app già installata.

<details>
<summary><strong>Preparare JDK e Android SDK su Ubuntu</strong></summary>

```bash
sudo apt install openjdk-17-jdk
export ANDROID_HOME="$HOME/Android/Sdk"  # aggiungilo anche a ~/.bashrc
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
```

React Native richiede Java 17 per questa build. Se `adb devices` non mostra il
telefono, controlla che il debug USB sia attivo e che il dispositivo sia stato
autorizzato.

</details>

### Credenziali

Onda non incorpora credenziali: le inserisce ogni persona nell'app, al primo
avvio o da Libreria › Sorgenti.

- **Jamendo** — registrati sul portale sviluppatori, crea un'applicazione e
  inserisci il Client ID nell'app, che lo verifica con una richiesta prima di
  salvarlo. Senza, Jamendo resta spento.
- **Audius** — non serve una chiave per le operazioni di sola lettura usate da
  Onda. `app_name` (`Onda`, nel codice) è soltanto un'etichetta identificativa.
  Una API key dell'utente è facoltativa e viaggia nell'header `x-api-key`, mai
  nell'URL.

Le credenziali stanno in expo-secure-store, cifrate con una chiave del Keystore
(`services/credentials`). Una lettura che fallisce all'avvio non cancella
niente: le chiavi invalidate le gestisce gia' expo-secure-store, e per il
resto si riparte senza la credenziale e la si reinserisce da Sorgenti.
Jamendo mette il Client ID anche negli URL di stream (`from=app-<client_id>`):
l'adapter lo toglie prima di salvare il brano (`sources/jamendoStream`) e
`mediaItems.playbackUrl` rimette quello corrente solo nell'URL dato al player,
cosi' libreria, coda salvata, cache ed export non lo contengono; la migrazione
dello storage 4 → 5 ripulisce i dati scritti prima.
Non usare variabili `EXPO_PUBLIC_*` per credenziali:
finirebbero in chiaro nel bundle, e doctor e release si fermano se ne trovano
una nell'ambiente o in qualunque file `.env`/`.env.*`, anche se oscurata da
una precedenza. `scripts/build-environment.ts` applica la precedenza Expo
production e restituisce diagnostica senza valori; tutti questi file sono
ignorati da Git. Per `npm run smoke` il Client ID si passa come `JAMENDO_CLIENT_ID`,
nell'ambiente o in `.env`.

## Architettura

Onda è costruita con Expo, React Native e TypeScript. Gli adapter delle
sorgenti trasformano Audius e Jamendo in un unico modello dati; il player
nativo mantiene una sola coda, anche quando contiene brani di entrambe.

### Struttura del progetto

```
index.js                    entry custom: expo-router + registrazione del playback service
metro.config.js             configurazione di Expo, con la cache che segue i valori EXPO_PUBLIC_*
app/
  _layout.tsx               provider, Stack, registrazione della cronologia
  (tabs)/_layout.tsx        tab bar custom: disegna il MiniPlayer sopra i tab
  (tabs)/index.tsx          Scopri — home a sezioni: recenti, in ascesa, voci nuove, generi, trending
  (tabs)/search.tsx         Cerca — brani, artisti e album federati, ricerche recenti
  (tabs)/library.tsx        Libreria — preferiti, cronologia, playlist
  player.tsx                player a schermo intero (slider, shuffle, repeat, sleep timer)
  queue.tsx                 coda: salta, rimuovi, riordina trascinando, svuota con Annulla
  genre/[key].tsx           trending di un genere, federato, con scroll infinito
  collection/[kind].tsx     raccolte locali: favorites | history
  playlist/[id].tsx         playlist locale, con rinomina e riordino
  artist/[source]/[id].tsx  pagina artista (entrambe le sorgenti)
  album/[source]/[id].tsx   pagina album (solo Jamendo, vedi sotto)
  welcome.tsx               primo avvio: le sorgenti e il Client ID Jamendo, con «Salta»
  sources.tsx               Sorgenti (da Libreria): interruttori e credenziali
  +not-found.tsx            URL che non corrisponde a niente: messaggio e ritorno a Scopri
src/
  types/track.ts            modello unificato, interfaccia MusicSource, SOURCE_IDS (l'elenco delle sorgenti)
  player/index.ts           la facciata del player: l'app importa solo '@/player' (vedi sotto)
  player/backend.ts         il contratto con il modulo nativo del player
  player/types.ts           tipi ed eventi del player, con i nomi di Media3 e i tempi in secondi
  player/media3Backend.ts   il contratto sopra il modulo Media3: elementi, eventi, instradamento (puro)
  player/media3.ts          collega il modulo nativo, l'unico file dell'app che lo importa
  services/sources/         adapter Audius e Jamendo + registro federato (brani, vetrine, artisti, album)
  services/sources/meta.ts  nome, sigla e attribuzione di ogni sorgente (puro)
  services/sources/access.ts  come le sorgenti leggono interruttori e credenziali, senza Keystore ne' MMKV
  services/sourceSettings.ts  regole su sorgenti accese, credenziali e verifica Jamendo (puro)
  services/playableTracks.ts  cosa puo' entrare nel player quando una sorgente e' spenta (puro)
  services/sourceGuard.ts   toglie dalla riproduzione i brani di una sorgente appena spenta
  services/credentials.ts   Client ID Jamendo e API key Audius in expo-secure-store (Keystore)
  services/genres.ts        unica tabella di traduzione dei generi tra le due API
  services/storage.ts       istanza MMKV + lettura JSON sicura e scrittura
  services/storageSchema.ts versione dello schema, migrazioni con backup, quarantena (puro)
  services/libraryBackup.ts export e import della libreria su file: selettori di sistema e condivisione
  services/pickerErrors.ts  l'annullamento del selettore di cartelle, in ogni forma in cui Expo lo segnala (puro)
  services/setupPlayer.ts   configurazione del player (una volta per processo)
  services/buildInfo.ts     commit, canale e data della build per la schermata Informazioni; la lettura pura in buildInfoSchema.ts
  services/playbackService.ts  eventi del player, anche in background: cambi di brano, progresso, errori
  services/mediaItems.ts    andata e ritorno fra il nostro modello e i MediaItem del player
  services/playbackStatus.ts  lo stato unico del tasto play, ricavato dai segnali del player
  services/playerCommands.ts  play, pausa e skip con la semantica giusta per ogni stato
  services/playbackPolicy.ts  quando saltare uno stream morto e quando riprovare la rete da soli
  services/historyPolicy.ts   dopo quanti secondi un brano conta come ascoltato
  services/notificationPolicy.ts  regole del permesso notifiche (Android 13+), senza React Native
  services/playerLayout.ts    quanto puo' essere grande la copertina nel player
  services/progressPolicy.ts  quando, e quanto spesso, leggere la posizione dal player
  services/queryClient.ts   React Query reidratata da MMKV; potatura in queryPersistenceSchema.ts
  services/browseTree.ts    l'albero per Android Auto dalla libreria (puro); l'invio sta in browseTreeSync.ts
  store/library.ts          preferiti, playlist, cronologia (persistiti); validazione e tetto della cronologia in librarySchema.ts (puro)
  store/libraryExport.ts    formato JSON versionato dell'export, merge additivo e tetto di 8 MB all'import (puro)
  store/playback.ts         shuffle e repeat (persistiti); la rilettura tollerante in playbackSchema.ts (puro)
  store/session.ts          brano attivo + coda e posizione salvate, "in attesa" all'avvio; useNowPlaying (schema in sessionSchema.ts)
  store/progress.ts         l'unico osservatore di progresso dell'app
  store/playbackFault.ts    "il brano e' morto": su Android lo stato error non arriva mai
  store/notificationPermission.ts  stato del permesso notifiche, chiesto al primo play
  store/sleepTimer.ts       timer di spegnimento (volatile, di proposito)
  store/searchHistory.ts    le ultime ricerche (persistite); la regola in utils/recentQueries.ts
  store/sources.ts          interruttori, benvenuto e invito (persistiti) + credenziali; collega le sorgenti
  hooks/useQueue.ts         sostituzione coda, riproduci dopo, accoda
  hooks/useDebounced.ts     il valore della ricerca con il ritardo del debounce
  hooks/usePlaybackStatus.ts  lo stato del player come hook
  hooks/useUpNext.ts        cosa viene dopo il brano corrente; la regola in utils/upNext.ts
  utils/reorder.ts          geometria del riordino a trascinamento della coda (worklet)
  utils/routes.ts           validazione dei parametri di route (raccolta, id) da deep link
  hooks/useInfiniteTracks.ts  scroll infinito su qualunque elenco; il cursore per sorgente sta in services/sources
  components/               TrackList, TrackRow, MiniPlayer, menu contestuale, ...
  components/Artwork.tsx    ogni copertina passa da qui: expo-image, dissolvenza, cache, segnaposto
  components/PressableScale.tsx  bottone che si ritrae con la molla condivisa; aptica opzionale
  components/Skeleton.tsx   sagome di caricamento per liste, raccolte e vetrine, al posto delle rotelle
  components/TrackStrip.tsx vetrina orizzontale di brani (recenti, in ascesa, voci nuove)
  components/EntityStrip.tsx  vetrina di artisti o album nei risultati di ricerca
  components/GenreGrid.tsx  la griglia dei generi, ognuno con la sua pagina
  components/Snackbar.tsx   avviso in basso con un'azione (Annulla), al posto dei toast
  components/SourceCredentials.tsx  moduli per Client ID Jamendo e API key Audius, condivisi da benvenuto e Sorgenti
  services/haptics.ts       feedback tattile di sistema: l'unico file che parla con expo-haptics
  theme.ts                  palette, spaziature, tipografia (Manrope), molla condivisa
assets/fonts/               Manrope (SIL OFL 1.1), incorporata dal plugin expo-font come famiglia XML
modules/
  onda-player/              il player nativo: modulo Expo in Kotlin su AndroidX Media3, con test JVM
scripts/
  release.ts                pipeline fail-closed per APK di distribuzione
  release-policy.ts         validazione pura di ambiente e credenziali
  personal.ts               doctor, build e install della copia personale; le regole pure in personal-policy.ts
  build-environment.ts      i file .env* letti con la precedenza Expo e la diagnostica senza valori
  build-provenance.cjs      commit e canale nel nome di versione (puro, CommonJS per app.config.ts)
  audit.ts                  npm audit alla soglia alta con le eccezioni di audit-policy.ts
  installed.ts              confronta la versione installata sul telefono con il repository (npm run check:installed)
  verify-signing.ts         verifica keystore, password e identita' di release senza costruire
  *.test.ts                 i test di npm test, uno per area; unit.test.ts raccoglie le parti pure
  metro-cache-version.cjs   versione della cache di Metro dai valori EXPO_PUBLIC_* (puro)
  smoke.ts                  collaudo degli adapter contro le API vere (npm run smoke)
  node-hook.mjs             risolve l'alias '@/' quando il codice dell'app gira in Node (test e smoke)
  test-doubles.mjs          solo per npm test: al posto dei moduli nativi i doppi di scripts/doubles/
  doubles/player.ts         il player finto dei test, che segue il contratto di src/player/backend.ts
plugins/
  with-release-signing.js   firma e proprieta' Gradle della release (android/ e' rigenerabile)
  with-android-auto.js      descrittore automotive_app_desc e meta-data per Android Auto
  with-android-privacy.js   backup Android disabilitato ed esclusioni cloud e device-to-device
  with-android-quality.js   lint.xml, icone e stili generati corretti nel progetto Android
credentials/                chiave di firma — ignorata da git, non rigenerabile
```

### Come si tiene insieme

Gli store sono pochi file su `useSyncExternalStore`, senza librerie: uno stato
per file, sincrono, e quelli persistiti si riscrivono su MMKV a ogni mutazione. La libreria tiene le
tracce **normalizzate** in un catalogo e maneggia solo uid — la stessa traccia
in tre playlist e' un riferimento, non tre copie che divergono.

I dati letti da MMKV vengono validati campo per campo prima di entrare negli
store. Un campo di una vecchia versione o malformato viene normalizzato o
scartato senza buttare via le altre parti sane della libreria.

Lo storage ha una versione (`schema.version`, `services/storageSchema`,
puro e testato): `services/storage` la porta alla corrente prima che
qualunque store legga. Dati senza versione valgono come versione 1; prima di
migrare ogni chiave dei dati viene copiata in `backup.*`, e se una migrazione
lancia si ripristina tutto e la versione non avanza. La cache di React Query
non ha backup: si rifa' dalla rete, e una sua copia sopravvivrebbe alla
sessione a cui i termini di Audius limitano i loro dati. Una versione piu' nuova
della nostra non si tocca. Un valore che non si riesce nemmeno a parsare non
si cancella: finisce in `quarantine.*`. Una migrazione nuova e' una voce in
`MIGRATIONS` con la sua versione di arrivo e un test da versione vecchia.
Oggi sono quattro: 1 → 2 porta il repeat numerico a `off/one/all`, 2 → 3
toglie dalla cache di React Query gli elenchi a scorrimento salvati con
l'offset unico, che non sapevano dire da dove riprendere, 3 → 4 toglie dalla
cache i dati Audius scritti prima della regola di sessione, insieme alla loro
copia in `backup.*`, e 4 → 5 toglie il Client ID Jamendo dagli URL di stream
salvati in libreria, coda e cache, backup compreso.

La coda invece non e' in uno store nostro: vive nel player nativo, che resta
l'unica fonte di verita' anche quando i comandi arrivano dalla notifica.
`store/session` la fotografa su MMKV quando cambia (anche dal gestore in
background) e salva la posizione dai tick del timer nativo
(`progressUpdated`); all'avvio la rimette "in attesa" senza caricarla nel
player, cosi' niente stream e niente notifica prima di un play. Le schermate
leggono il brano da `useNowPlaying` (nello stesso store, cosi' brano del
player e coda in attesa cambiano in un solo snapshot), e i comandi di
trasporto passano da `services/playerCommands`, che consegna la coda al
player al primo play o skip. Per questo nessuna schermata legge brano o progresso dal player
per conto suo: il progresso lo legge un solo timer, `store/progress`, e lo
stato del tasto play viene da `usePlaybackStatus`.

Su Android lo stato `error` del player non arriva mai: dopo un errore ExoPlayer
torna `idle`, che per la tabella e' una pausa. `store/playbackFault` tiene
quindi un flag che `playbackService` alza quando un errore ferma il player e
che il primo caricamento o cambio brano abbassa; e' quel flag che fa comparire
l'avviso con Riprova. Per lo stesso motivo il salto automatico dopo un brano
morto usa `skipToNextAfterError()`: sul main thread verifica che ci siano
ancora un errore, un brano successivo e un play richiesto, poi salta,
riprepara e riparte in un solo comando. Una pausa arrivata da UI o da un
controller Android revoca anche questo recupero; il silenzio durante il
buffering non equivale a una pausa. Un errore di rete invece non
consuma il budget di salti: `playbackService` riprova da solo tre volte a
distanze crescenti (`NETWORK_RETRY_DELAYS_MS` in `playbackPolicy`), e solo
dopo resta all'utente il Riprova. L'attesa la conta il player
(`scheduleRetry`), perche' con l'app in background i timer JS sono fermi.
La pausa revoca anche il recupero: `PlaybackCore` osserva
`onPlayWhenReadyChanged`, perche' i controller Android chiamano ExoPlayer
direttamente e durante il buffering `isPlaying` e' gia' falso. Il timer
controlla `playWhenReady` sia quando si arma sia quando scatta, cosi' un
errore arrivato dopo la pausa non fa ripartire la musica.

La cronologia non si aggiorna al cambio di brano ma al tick di progresso:
`services/historyPolicy` dice quando un brano conta come ascoltato (trenta
secondi, o meta' se e' piu' corto di un minuto), cosi' un brano saltato non
finisce in «Ascoltati di recente». Il catalogo volatile viene comunque
avvisato subito, perche' la cronologia risolve per uid.

Da Android 13 la notifica del player richiede un permesso a runtime. Onda lo
chiede al primo play (`useQueue.playList` e `playerCommands.togglePlayback`),
non all'avvio: le regole stanno in `services/notificationPolicy`, lo stato in
`store/notificationPermission`, che si rilegge a ogni ritorno in primo piano.
Il player mostra l'avviso con «Consenti» finche' il sistema chiede ancora e
con «Impostazioni» quando e' bloccato.

React Query e' reidratata da MMKV prima del primo render
(`services/queryClient`): trending, vetrine, artisti e album tornano da disco
e si rinfrescano in background, la ricerca no. La potatura — trenta query,
due pagine per elenco, tre giorni — sta in `queryPersistenceSchema`, puro e
testato, e vale anche come `gcTime`. I dati Audius non vanno su disco: i
termini API di Audius ammettono solo una cache di sessione. Profili e album
Audius restano fuori interi; dagli elenchi federati si tolgono i brani
Audius e la query si segna da rinfrescare (`isInvalidated`), cosi' alla
riapertura mostra subito il resto e torna completa appena risponde la rete.
L'elenco delle sorgenti di sola sessione e' `SESSION_ONLY_SOURCES`.

Anche gli artwork seguono la sorgente (`artworkCachePolicy`): Audius e
provenienza sconosciuta usano solo memoria, Jamendo memoria e disco, con
chiavi distinte anche a URL uguale. Prima di montare le schermate,
`prepareArtworkCache` elimina una volta la vecchia cache mista; conferma la
versione della policy soltanto se la cancellazione riesce. Un fallimento non
ferma l'app: per quella sessione tutte le copertine restano in memoria
(`setArtworkDiskReady`) e si ritenta al prossimo avvio. expo-image risponde
«non riuscito» anche solo quando non ha un'Activity sotto mano.

Le sorgenti dichiarano le funzioni opzionali (`spotlight`, `searchArtists`,
`searchAlbums`, gli album) e la federazione salta chi non le ha senza
contarlo come caduta: Audius non cerca album, e la vetrina di Cerca resta
solo Jamendo senza avvisi inutili. `combine` e `interleave` sono generici
sul tipo di elemento, cosi' artisti e album si alternano come i brani.

Android Auto legge l'albero costruito da `services/browseTree` dalla
libreria persistita — preferiti, playlist, ascolti recenti — e
`browseTreeSync` lo rimanda al player (`setBrowseTree`) a ogni mutazione,
accorpando quelle ravvicinate. Il manifest lo dichiara tramite
`plugins/with-android-auto.js`; il servizio media e il suo intent filter li
dichiara il modulo del player.

La sessione rifiuta i controller non autorizzati. Chi puo' collegarsi e
comandare la riproduzione sono Onda, la sua notifica, Android Auto,
Automotive e i controller che Media3 dichiara fidati: oltre al sistema,
qualunque app con un servizio di ascolto delle notifiche attivo (smartwatch,
widget multimediali). La libreria privata la sfogliano invece soltanto Onda,
Android Auto e Automotive, e soltanto loro possono mandare una coda: a un
controller soltanto fidato la sessione toglie i comandi che impostano o
cambiano gli elementi (`RemoteCommands.QUEUE_COMMANDS`), e una richiesta di
coda che arrivasse comunque fallisce senza toccare il player. Altrimenti
un'app con l'accesso alle notifiche potrebbe far suonare a Onda un URL
qualsiasi, con titolo e copertina scelti da lei. Radice, figli ed elementi
passano tutti da
`LibraryAccess`, che verifica il permesso prima di leggere l'albero:
conoscere un id di playlist o cronologia non concede accesso. I test JVM
coprono anche richieste dirette con id noti e la paginazione dei controller
autorizzati; resta il collaudo tra app Android reali.

Quel descrittore accende in Android Lint due controlli in piu', entrambi
errori ed entrambi letti sul solo manifest sorgente dell'app. Il plugin li
tace sull'elemento `<application>`, e il perche' sta scritto accanto: il
controllo sul servizio e' un falso positivo, perche' il filtro
MediaBrowserService vive nel manifest del modulo del player; quello sulla
ricerca vocale (`MEDIA_PLAY_FROM_SEARCH`) segnala una mancanza vera, aperta
in TODO.md. Dichiarare quel filtro senza gestire la query aprirebbe Onda a
vuoto a ogni "metti jazz su Onda".

`TrackList` e' l'unica lista dell'app. Si abbona lei alla libreria e al player,
e passa `isFavorite` / `isActive` alle righe come prop: cosi' `TrackRow` resta
`memo` e un cuoricino toccato non ridisegna cinquanta righe. E' anche lei a
mostrare la `Snackbar` con l'esito del menu contestuale (`TrackActions` chiude
e riferisce con `onDone`): dentro un foglio che si chiude un avviso non fa in
tempo a essere letto.

Ogni controllo a icona ha un bersaglio di almeno 48x48 dp tramite
`touch.target` di `theme.ts`, messo sul contenitore che riceve il tocco
(`containerStyle` di `PressableScale`, `style` di un `Pressable`), non con
`hitSlop`: il fuoco di TalkBack e Switch Access segue i bordi veri della
vista. Le schermate artista e album tengono errore, vuoto e contenuto
mutuamente esclusivi: a lista vuota parla solo lo stato vuoto, con un solo
Riprova; con dei brani a schermo gli errori si dicono in testa, ciascuno con
il suo. I parametri di route da deep link passano da `utils/routes`, e un URL
che non corrisponde a niente apre `+not-found`.

Lo strato di "sensazione" ha quattro regole, e valgono per ogni schermata:
ogni copertina passa da `Artwork` (mai `Image` di React Native), ogni bottone,
chip o icona da `PressableScale` (le righe di lista tengono invece
l'evidenziazione di sfondo), ogni vibrazione da `services/haptics.ts` (mai
`expo-haptics` diretto, e una regola per azione: `tap`, `toggle`, `longPress`,
`success`, `reject`, `gestureEnd`), e il font si usa solo tramite i token
`type.*` di `theme.ts`, dove sta anche la molla condivisa `motion.press`. Ogni
animazione passa `ReduceMotion.System`, cosi' "Rimuovi animazioni" del sistema
vale davvero. Il font e' incorporato nel pacchetto nativo dal config plugin di
expo-font (vedi `app.json`): niente caricamento a runtime, e se manca un
prebuild Android ricade in silenzio su Roboto, che e' il primo sintomo da
riconoscere.

### Il player dietro una facciata

L'app non parla con il modulo nativo del player: passa da `src/player/`
(`import { player } from '@/player'`). La facciata e' nata per sostituire
`@rntp/player`, la cui licenza non permetteva di distribuire un APK che lo
incorpora; oggi sotto c'e' il modulo nostro su AndroidX Media3
([sotto](#il-modulo-media3)), e il resto dell'app non se n'e' accorto.

- `src/player/index.ts` e' la facciata: esporta `player`, gli hook
  `usePlaybackState` e `useIsPlaying` e i tipi. Cambiare modulo vuol dire
  cambiare li' l'import del backend.
- `src/player/backend.ts` e' il contratto, `PlayerControls`. Contiene solo
  quello che Onda usa: oltre ai metodi elenca i doveri del nativo, come il
  focus audio, la pausa a cuffie staccate, CPU e Wi-Fi svegli a schermo
  spento, i comandi esterni eseguiti anche con il JS sospeso e Android Auto.
- `src/player/types.ts` ha i tipi e gli eventi, con i nomi di Media3 e i
  tempi in secondi.
- `src/player/media3Backend.ts` mette il contratto sopra il modulo nativo.
  E' una fabbrica pura: modulo e `AppState` arrivano da fuori, cosi' i test
  in Node la provano con un modulo finto.
- `src/player/media3.ts` la collega al modulo vero, ed e' l'unico file
  dell'app che importa `modules/onda-player`.

ESLint fa rispettare il confine: nell'app (`index.js`, `app/`, `src/`)
importare un file interno di `src/player/` o il modulo nativo e' un errore,
anche con un percorso relativo. I doppi dei test in `scripts/` importano il
contratto apposta.

Tre regole del contratto contano piu' delle altre, perche' l'app ci
costruisce sopra. I comandi tornano subito e il nativo li esegue nell'ordine
in cui arrivano: `activateSession` manda coda, seek e play di fila. Le
letture vedono gia' l'effetto dei comandi dati prima: "Riproduci dopo" legge
l'indice attivo subito dopo aver consegnato la coda in attesa. Togliendo il
brano attivo diventa attivo il primo che resta dopo quelli tolti, come in
Media3: `sourceGuard` ci conta.

Nei casi di confine il contratto segue Media3, come risulta dalla sua
documentazione e dai suoi test, e il player finto con lui:

- tolto il brano attivo senza niente dopo, diventa attivo il primo della
  coda: con ripeti tutto si continua da li', altrimenti la riproduzione
  finisce (`ended`);
- indietro sul primo brano riavvolge, ma con ripeti tutto va all'ultimo;
  avanti sull'ultimo non fa niente; ripeti uno non conta per navigare;
- con lo shuffle "dopo" segue l'ordine shuffle, che il contratto non
  espone: la Coda e la riga "Prossimo" dichiarano di non saperlo
  (`utils/queueSummary`, `utils/upNext`). Un accessore e' una voce in TODO.md.

Una funzione nuova del player si aggiunge al contratto (`backend.ts`,
`types.ts`), al modulo nativo con la sua fabbrica JS e al player finto dei
test, con un test in Node che la usa da `@/player`.

Il modulo e' scritto senza consultare l'implementazione di RNTP, ne' il
JavaScript ne' il Kotlin: valgono il contratto, i test, la documentazione e
il sorgente di Media3. Chi lo modifica tiene la stessa regola.

### Il modulo Media3

`modules/onda-player` e' un modulo Expo locale in Kotlin (package
`com.onda.playback`), che l'autolinking di Expo collega da solo. Usa Media3
1.11.1 (`media3-exoplayer` e `media3-session`, Apache 2.0); una versione nuova
va provata su device prima di entrare.

Il modulo, il contratto e le regole di Onda sono codice originale del
progetto. Motore ExoPlayer, lettura dei formati e gestione degli stream
provengono da Media3; la decodifica usa anche i componenti Android. Dire
«player nostro» si riferisce al modulo e all'integrazione, non a un motore
audio scritto interamente da Onda.

- **Un player per processo, sul main thread** (`PlaybackCore`). Nasce al
  primo comando di coda o di play, oppure quando Android Auto avvia il
  servizio a freddo. Solo `play()` lo prepara e apre sessione, servizio e
  notifica: caricare la coda ripristinata per inserirci un brano o per
  aprire la Coda non apre lo stream. Audio musicale con il focus in esclusiva, pausa a cuffie staccate,
  CPU e Wi-Fi svegli (`WAKE_MODE_NETWORK`).
- **Thread.** Le funzioni del modulo sono sincrone e girano sul thread del
  JS. I comandi si accodano in ordine su un `Handler` del main thread e
  tornano subito; le letture passano dalla stessa coda e aspettano la
  risposta, quindi vedono i comandi dati prima, perche' ExoPlayer aggiorna lo
  stato visibile appena riceve un comando. Una lettura senza risposta in due
  secondi scrive `Lettura del player non riuscita` nel log e ripiega su un
  valore neutro: e' un guasto da cercare, non un caso previsto. Audio in
  uscita e stato fanno eccezione: valgono come li ha annunciati l'ultimo
  evento e si leggono senza aspettare.
- **Servizio** (`PlaybackService`, un `MediaLibraryService` dichiarato nel
  manifest del modulo). Quando la musica sta per partire il core lo avvia e
  ci resta legato con un `MediaController`; Media3 ne fa un foreground
  service con la notifica. I tasti di `setup` vanno al controller della
  notifica, ad Android Auto e ai controller fidati del sistema, che pero'
  non possono sostituire la coda; ogni altra app e' respinta alla
  connessione. Il tocco sulla notifica apre
  `onda://notification.click`, che `app/+native-intent.ts` porta al player.
- **Recenti.** Tolta dai recenti, Onda si ferma e il servizio si chiude, ma
  coda e posizione restano nel player: se processo e JS sopravvivono,
  riaprendo l'app il mini-player le mostra in pausa. Finche' l'app non torna
  in primo piano, o un controller esterno (notifica, Auto, Bluetooth) non fa
  ripartire la musica, un `play()` dal JS viene ignorato, cosi' un tentativo dopo
  un errore non fa ripartire la musica appena fermata.
- **Timer nativi**: posizione (`progressUpdated`, ogni
  `progressIntervalSeconds` e alla pausa), spegnimento (`sleepAfter`, contato
  su `elapsedRealtime`) e nuovo tentativo dopo un errore di rete
  (`scheduleRetry`). Con l'app in background React Native ferma i timer JS
  (`JavaTimerManager`, se non gira un task headless): un `setTimeout` per
  riprovare dopo un tunnel a schermo spento non partirebbe mai.
  Dal 13 ottobre 2026 una pausa (`playWhenReady=false`) annulla il retry;
  l'intenzione di riprodurre viene controllata anche quando si programma
  e quando si esegue il tentativo. Un errore tardivo dopo la pausa non
  deve far ripartire l'audio. Entrambi i casi sono collaudati su device.
- **Eventi.** Il modulo manda un solo evento, `onPlayerEvent`, con `type` e i
  campi del contratto. `media3Backend` lo consegna una volta sola e subito:
  ai listener se l'app e' `active`, al gestore in background altrimenti.
  Il gestore e' sincrono per contratto: con l'app in pausa Android ferma i
  timer JS, quindi un timer di guardia non scatterebbe e un lavoro rimandato
  non avrebbe nessuno che lo aspetta; le attese le conta il nativo
  (`scheduleRetry`). Gli stessi gestori stanno in entrambi i posti
  (`playbackService`), e un errore consegnato due volte salterebbe due
  brani. Per questo la Coda e la riga "Prossimo" rileggono il player anche
  al ritorno in primo piano (`services/appState.onAppActive`). La lettura
  della coda attraversa il bridge con gli `extras` di ogni brano: l'evento
  `queueChanged` non la provoca da solo, e la cache degli elementi si pota
  alla prima lettura di chi la chiede.
- **Elementi.** Gli `extras` e una chiave scelta dal JS viaggiano nel `tag`
  del `MediaItem`, che resta nel processo: in `MediaMetadata.extras`
  arriverebbero a ogni controller. Con la chiave, `media3Backend` restituisce
  lo stesso oggetto che aveva mandato; un elemento senza chiave (dopo una
  ricarica del JS, o scelto in Android Auto) si ricostruisce dai campi.
- **Errori.** I codici di `PlaybackException` diventano le categorie del
  contratto (`ErrorCategory`): rete, timeout e risposte HTTP 5xx, 408 e 429
  sono `network`, il resto dell'IO e il parsing `source`, decoder e uscita
  audio `renderer`.
- **Android Auto.** L'albero di `setBrowseTree` si salva in un file, per il
  servizio a freddo, senza il Client ID Jamendo negli URL
  (`BrowseTree.withoutStreamCredentials`): in memoria restano gli URL di
  riproduzione che manda il JS, e a freddo Jamendo suona senza il tag di
  attribuzione finche' il JS non rimanda l'albero. Lo stesso brano puo'
  stare in Preferiti, in una playlist
  e negli ascolti recenti, quindi in macchina il suo id porta anche la
  cartella (`cartella|uid`): scelto un brano, in coda vanno i brani suonabili
  della stessa cartella, a partire da lui. In coda torna l'uid nudo.

Le parti pure (categorie d'errore, tasti, timer di spegnimento, albero di
Auto) hanno test JVM in `modules/onda-player/android/src/test`. Il job
`native-player` del workflow Quality è configurato per compilare il Kotlin
ed eseguirli su Ubuntu e Windows a ogni PR e push su `main`. Dal 18 ottobre
2026 il job è verde su GitHub a ogni PR; il 24 ottobre i test JVM sono 27.
`main` è protetto: i cinque job del workflow Quality sono tutti
obbligatori, i commit devono essere firmati e la storia resta lineare, cioè
solo fast-forward. Lo stesso controllo gira in
`npm run build:personal` prima dell'Android Lint. Per eseguirlo da solo:

```bash
npm run prebuild
npm run android:test:player
```

Il comando richiede JDK 17, Platform 36 e Build-Tools 36.0.0, controllati
da doctor, e usa il wrapper Gradle della piattaforma: `gradlew` su Linux,
`gradlew.bat` su Windows. Esegue `:onda-player:compileReleaseKotlin` e
`:onda-player:testReleaseUnitTest`; non assembla un APK.

---

## Collaudo senza device

I test non usano rete ne' dispositivo e vanno eseguiti prima del collaudo
live:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

Coprono la validazione della libreria e delle preferenze playback persistite,
le migrazioni dello storage e il cursore della paginazione federata, con
sorgenti finte che scorrono un catalogo vero: una sorgente giu' per sempre,
una che cade e torna, un artista con una richiesta fallita. Sopra il player
finto coprono anche la sessione di ascolto, il guardiano delle sorgenti e la
reazione agli errori di riproduzione. L'adattatore sul modulo Media3 ha i suoi,
con un modulo nativo finto (`scripts/media3-backend.test.ts`); il Kotlin ha i
test JVM che girano in CI e nella build personale
([Il modulo Media3](#il-modulo-media3)).

`npm run check:audit` e' il controllo delle dipendenze che gira in CI:
`npm audit` alla soglia alta, con le sole eccezioni dichiarate in
`scripts/audit-policy.ts` per gli avvisi che non hanno ancora una versione
corretta. Ogni eccezione ha un motivo e una data di revisione.

`npm run typecheck` rigenera prima `.expo/types/router.d.ts` con
`expo customize tsconfig.json` e solo dopo lancia `tsc`. Con
`experiments.typedRoutes` attivo, ogni `router.push` viene confrontato con
le rotte presenti in `app/`, ma il file dei tipi e' generato, ignorato da Git
e non si aggiorna da solo: una copia lasciata da un `expo start` precedente a
una rotta nuova fa fallire il typecheck con un "not assignable" su una rotta
che esiste. Rigenerarlo ad ogni controllo rende l'esito uguale su ogni
computer, anche dove `.expo/` non e' mai stata creata.

### Il player finto e gli altri doppi

`npm test` carica, dopo `scripts/node-hook.mjs`, anche
`scripts/test-doubles.mjs`, che mette al posto dei moduli nativi i doppi in
memoria di `scripts/doubles/`: `react-native` (solo `AppState`, con
`setAppState` per simulare l'uscita dall'app), `react-native-mmkv` ed
`expo-secure-store`. Al posto di `src/player/media3.ts`, che collega il
modulo nativo, mette il player finto, `doubles/player.ts`: la facciata resta
quella vera, quindi store e servizi si provano cosi' come sono. Lo smoke non
carica i doppi.

Il player finto e' la lettura eseguibile del contratto, e nei casi che il
contratto fissa il modulo Media3 si comporta allo stesso modo
(`scripts/player-double.test.ts` lo tiene allineato):

- i comandi su coda, brano attivo, posizione e ripetizione cambiano subito
  lo stato che le letture vedono; gli altri (play, pausa, `retry`, shuffle,
  timer di spegnimento e nuovo tentativo, albero di Android Auto) vengono
  solo registrati.
  `fakePlayer.calls()` da' i nomi di tutti, in ordine, e
  `fakePlayer.argsOf(nome)` i loro argomenti;
- gli eventi che seguono i comandi (coda cambiata, cambio di brano)
  aspettano `fakePlayer.flush()`, come quelli che il nativo manda dopo;
- quelli che dipendono da rete e decoder (audio che esce, stato, errori,
  progresso) li manda il test con `fakePlayer.emit()`;
- non prepara stream: la durata resta 0 e lo shuffle non riordina niente.

Ogni file di test gira in un processo suo: i test di un file condividono
player finto e store, quelli di file diversi no. Per questo i file che usano
il player chiudono ogni test con un `afterEach` che consegna gli eventi
rimasti, cosi' non arrivano al test dopo.

I moduli che carica anche lo smoke prendono i tipi del player con
`import type { ... } from '@/player'`. La rimozione dei tipi di Node lascia
`import { type X } from '@/player'` come import senza nomi, che carica
comunque la facciata e con lei il modulo nativo, che fuori da React Native
non si carica.

### Smoke

```bash
npm run smoke
```

Gli adapter sono TypeScript puro, senza React Native dentro: girano in Node
cosi' come sono, contro le API vere. Il Client ID Jamendo arriva da
`JAMENDO_CLIENT_ID`, nell'ambiente o in `.env`; senza, Jamendo si salta e lo
script lo dice. Lo script controlla
per ogni sorgente ricerca, trending, paginazione, pagine artista e album,
la federazione, tutti i generi, e campiona gli stream con
`Range: bytes=0-1023` per verificarne la raggiungibilità e il supporto di
base alle richieste parziali. Un `206` sui primi byte non prova il seek
temporale avanzato: quello dipende anche dal formato, dalla durata e dal
calcolo dell'offset del player, e richiede un collaudo nativo. Con il Client
ID osserva anche una risposta grezza di `/tracks`: conta gli URL di stream
che portano `from=app-…`, verifica che l'adapter li ripulisca e che il player
rimetta il Client ID corrente, e campiona un chilobyte sia con sia senza il
tag. Stampa solo conteggi e stati HTTP, mai un URL.

Serve perche' il typecheck non puo' vedere niente di tutto questo: al primo
giro ha trovato tre bug reali in Jamendo (parametro `order` rifiutato sugli
album, pagine artista vuote, generi che sembravano inesistenti). Rilancialo
dopo ogni modifica agli adapter.

Un `warn` su un genere non e' un errore: e' una sorgente che per quel tag non
ha risultati. Un `FAIL` si', ed e' quasi sempre l'API che e' cambiata.

### Audit delle dipendenze

Verificato il 9 agosto 2026: l'override `xcode > uuid` in `package.json`
porta `uuid` alla versione corretta 11.1.1 e rimuove le segnalazioni moderate
GHSA-w5hq-g745-h8pq. Non va sostituito con `npm audit fix --force`: npm propone
un downgrade incompatibile a Expo 53 e React Native 0.72.

L'elenco corrente delle eccezioni è in
[`scripts/audit-policy.ts`](../scripts/audit-policy.ts): `node-forge`
(GHSA-86w9-cpqp-85rv, strumenti Expo per firma iOS e manifest expo-updates)
e `zod` (GHSA-mrhx-c7xc-m3w5, validazione nella CLI Expo: la correzione
esiste solo nella 4.6.6, che `@expo/cli` non accetta), con revisione entro
il 15 gennaio 2027. La policy registra il motivo dell'accettazione e il
fatto che questi strumenti non entrano nell'APK Android. L'eccezione per
`braces` (GHSA-vfj7-8cjw-p6xm, watcher Metro) è uscita il 24 ottobre 2026:
GitHub aveva ritirato l'avviso il giorno prima e, come previsto,
un'eccezione non più necessaria aveva fatto fallire il controllo. Gli avvisi
`image-size` riportati nell'audit storico di agosto non sono più
nell'elenco delle eccezioni.

Rieseguire periodicamente:

```bash
npm run check:audit
npx expo install --check
npx expo-doctor
```

Il rapporto aggiornato viene scaricato da `check:audit`: questa descrizione
documenta la policy del repository, non sostituisce una nuova verifica del
registro npm. Rimuovere ogni eccezione quando esiste una correzione
compatibile; eccezioni scadute o non più necessarie fanno fallire il controllo.

---

## Verifica dopo il primo avvio

Nell'ordine. Se salti un passaggio, il bug lo trovi tre settimane dopo.
Le prove gia' fatte, con data e dispositivo, stanno nel
[registro dei collaudi](VERIFICATION_LOG.md); quelle che mancano nella
checklist device di [TODO.md](../TODO.md).

1. La schermata **Scopri** mostra tracce di entrambe le sorgenti (la sigla
   `AUD` / `JAM` a destra di ogni riga).
2. Il tap fa partire l'audio e compare il mini-player in basso.
3. **Metti l'app in background**: l'audio continua e la notifica compare.
4. Dalla notifica: play, pausa e skip funzionano.
5. Nel player a schermo intero, trascina lo slider a meta': la traccia salta a
   meta' (verifica che l'header `Range` funzioni su entrambe le sorgenti).
6. Spegni lo schermo: l'audio non si interrompe.
7. Metti un brano nei preferiti, **chiudi e riapri l'app**: e' ancora li'.
   Se sparisce, MMKV non sta scrivendo (quasi sempre: build vecchia senza il
   modulo nativo, dopo aver aggiunto la dipendenza).
8. Tieni premuto un brano Jamendo: il menu mostra "Vai a ..." e "Album: ...".
   Su un brano Audius compare solo l'artista, ed e' corretto (vedi sotto).
9. Il testo e' in Manrope, tab bar compresa: se vedi Roboto il font non e'
   entrato nel pacchetto nativo e va rifatto il prebuild.
10. Nel player trascina la copertina verso il basso: il foglio segue il dito,
    sotto si intravede la schermata precedente e, oltre un terzo dello schermo,
    si chiude con una vibrazione leggera. Sotto la soglia torna su.
11. Metti in pausa a meta' brano, togli l'app dai recenti e riaprila: il
    mini-player c'e' gia', in pausa, senza notifica. Premi play: riparte da
    dove eri, con uno scarto di al massimo cinque secondi.
12. Con la rete lenta il tasto play mostra uno spinner e la barra sotto il
    mini-player ha tre toni: suonato, scaricato, da scaricare. In modalita'
    aereo a meta' brano il player dice "Il brano non risponde" e offre Riprova.
13. Chiudi l'app, togli la rete e riaprila: Scopri mostra i dati Jamendo
    conservati nella cache. Il catalogo Audius resta solo in memoria e non
    deve ricomparire da disco dopo la chiusura del processo.
14. Scopri ha le vetrine "In ascesa questa settimana" e "Voci nuove" con
    brani di entrambe le sorgenti, e un genere dalla griglia apre la sua
    pagina con Riproduci e Casuale.
15. In Cerca, "love" mostra artisti (tondi, da entrambe le sorgenti) e album
    (quadrati, solo Jamendo) sopra i brani; con la casella vuota compaiono
    le ricerche recenti.
16. Nella Coda trascina una riga dalla maniglia a destra: le altre si
    spostano per farle posto e all'arrivo il brano suona nell'ordine nuovo.
    "Svuota da qui in giu'" mostra un avviso con Annulla che rimette i brani.
17. Nel player, sotto i controlli, la riga "Prossimo" rispetta la
    ripetizione. Con lo shuffle nativo la UI dichiara che l'ordine non è
    disponibile: esporre la permutazione Media3 è ancora una voce in TODO.md.

Il punto 3 e' quello che rompe piu' spesso, ed e' anche quello che fallisce
in silenzio.

Le prove raccolte su Motorola Edge 50 Neo, Android 16 (SDK 36), sono datate
nel registro: i casi del backend precedente non certificano automaticamente
Media3. I controlli di base e il recupero della rete sono verificati sul
nuovo modulo il 13 ottobre 2026; la checklist completa resta nella roadmap.
Se ti servono prove misurabili invece che a occhio:

```bash
adb shell dumpsys media_session | grep -A12 "package=com.onda.player"
adb shell dumpsys activity services com.onda.player | grep isForeground
adb shell run-as com.onda.player ls -l files/mmkv/
```

Il primo dice se lo stato e' davvero `PLAYING` e a che posizione; il secondo
se il foreground service e' vivo con `types=0x2` (mediaPlayback); il terzo se
MMKV ha scritto su disco.

Il terzo comando funziona solo sulla build di debug: `run-as` richiede
un'app `debuggable`, e la release non lo e'. Li' la persistenza si verifica
dall'esterno — `am force-stop`, riapri, guarda se i preferiti ci sono ancora.

---

## Build di release

> [!WARNING]
> Questa è la pipeline del maintainer per una futura distribuzione ufficiale.
> Un clone privo delle credenziali di firma deve usare
> `npm run build:personal`; vedi [BUILD_PERSONAL.md](BUILD_PERSONAL.md).

La release destinata alla distribuzione si crea dalla radice del repository con
un solo comando:

```bash
npm run release:android
```

La pipeline accetta soltanto un worktree pulito e usa sempre `NODE_ENV=production`.
Prima di costruire controlla che nessuna credenziale `EXPO_PUBLIC_*` sia
definita, JDK 17, Android SDK 36,
le quattro proprieta' di firma e il file del keystore. Poi esegue test,
typecheck, ESLint, Prettier, prebuild Android pulito, Android Lint e Gradle.

Al termine `apksigner` verifica l'APK e il suo certificato SHA-256 viene
confrontato sia con quello letto dal keystore tramite `keytool`, sia con
l'identità pubblica fissata in `release/identity.json`: una firma valida ma
diversa viene quindi rifiutata. Vengono controllate anche le ABI
`arm64-v8a`/`armeabi-v7a`. APK, mapping R8 e manifest JSON con commit, dimensione,
hash, certificato e ABI finiscono in `dist/release/`, che e' ignorata da Git.

Il percorso Gradle originale resta disponibile per diagnosi, ma applica la
stessa policy di firma:

```bash
npx expo prebuild --platform android --clean
./android/gradlew -p android assembleRelease
```

L'APK intermedio finisce in
`android/app/build/outputs/apk/release/app-release.apk`, contiene il bundle JS e
non ha bisogno di Metro.

### Android Lint

```bash
npm run android:lint
```

Il comando controlla la variante release dell'app e tutte le dipendenze tranne
i task `lintAnalyzeRelease` di `react-native-worklets` e
`react-native-reanimated`. Con Expo SDK 57 questi due task fanno crashare il
motore Android Lint durante l'analisi dei rispettivi `build.gradle.kts` con
`Cannot find a KaModule for the VirtualFile`; non arrivano a produrre un report
o una segnalazione sul codice. L'eccezione e' esplicita nello script npm e va
rimossa appena un aggiornamento compatibile di Expo/AGP la rende superflua.

Il report dell'app resta disponibile in
`android/app/build/reports/lint-results-release.html` e un errore reale di Onda
continua a far fallire il comando.

Il controllo dell'11 agosto 2026 produce un report con **0 errori e 0 warning**.
La configurazione persistente sta in `plugins/with-android-quality.js`: corregge
le estensioni delle icone generate da Expo, rimuove l'orientamento fisso e
annota le sole eccezioni generate o governate dall'SDK (versioni Fresco,
drawable React Native e risorse caricate dinamicamente). I permessi storage
legacy portati dalle dipendenze vengono rimossi dal manifest finale.

### Backup Android

Onda sceglie di non trasferire la libreria locale tramite il backup di sistema.
Il plugin `plugins/with-android-privacy.js` imposta `allowBackup=false` e genera
entrambi i formati richiesti dalla piattaforma:

- `fullBackupContent` per Android 11/API 30 e inferiori;
- `dataExtractionRules` con esclusioni complete sia cloud sia device-transfer
  per Android 12 e superiori.

La distinzione non è ridondante: la
[documentazione Android](https://developer.android.com/identity/data/autobackup)
specifica che i due gruppi di versioni usano sintassi e percorsi differenti.
Inoltre il comportamento D2D di `allowBackup=false` può variare fra produttori,
quindi le esclusioni moderne restano necessarie e il collaudo D2D va mantenuto
separato dal backup cloud.

L'11 agosto 2026 una release firmata x86_64 è stata provata sull'AVD
`onda_api30` con transport locale: `backupnow` ha risposto
`Backup is not allowed`; dopo disinstallazione/reinstallazione e restore manuale
un marker sintetico non è ricomparso e il restore set ha selezionato zero
pacchetti. Sul Motorola Android 16 lo stesso tentativo viene rifiutato. Resta da
eseguire un trasferimento D2D reale Android 12+ con due dispositivi.

### La chiave di firma

Sta in `credentials/`, che e' in `.gitignore`. **Non e' rigenerabile.** Se la
perdi non potrai piu' pubblicare un aggiornamento riconosciuto come la stessa
app, ne' su Play Store ne' su F-Droid, e non esiste un supporto che possa
rimediare. Un backup del repo non la salva, proprio perche' e' ignorata:
va copiata a mano, offline.

L'impronta del certificato pubblico, che non contiene segreti, è versionata in
`release/identity.json`. Dopo avere creato o ripristinato un backup verifica
keystore, alias, entrambe le password, accesso alla chiave privata e identità
senza costruire un APK:

```bash
npm run verify:signing
```

Il comando non stampa le password. Può verificare direttamente anche la
directory `credentials` copiata su un supporto montato, senza sostituire i file
locali:

```bash
npm run verify:signing -- /percorso/del/backup/credentials
```

Un esito positivo non sostituisce il test periodico di lettura della copia
offline; dopo il controllo smonta e conserva separatamente il supporto.

Il backup offline verificato l'11 agosto 2026 è un archivio GPG simmetrico
AES-256 contenente soltanto `keystore.properties`, il keystore e
`release/identity.json`. La passphrase non deve essere salvata sulla stessa USB
né inserita in comandi, shell history o documentazione. Per riprovare il restore
senza sostituire le credenziali locali:

```bash
mkdir /tmp/onda-signing-restore
gpg --decrypt /percorso/onda-signing-backup-20260811.tar.gpg \
  | tar -C /tmp/onda-signing-restore -xf -
npm run verify:signing -- /tmp/onda-signing-restore/credentials
```

Elimina la directory temporanea dopo la prova e smonta correttamente il
supporto. L'archivio verificato ha SHA-256
`ddb43f42a6d669e14208178d68046294e6f7534b625a3ab7494653a713c85605`;
ricalcolalo dopo ogni copia o migrazione del supporto.

Per rifarla da zero (solo se non hai mai pubblicato nulla):

```bash
keytool -genkeypair -v -keystore credentials/onda-release.keystore \
  -alias onda -keyalg RSA -keysize 4096 -validity 10000
```

e poi `credentials/keystore.properties` con `storeFile`, `keyAlias`,
`storePassword`, `keyPassword`.

Se `credentials/keystore.properties`, una proprieta' o il keystore mancano, le
task Gradle che producono o installano una release falliscono. Non esiste piu'
un fallback implicito sulla chiave di debug.

Per una prova locale su un clone privo di credenziali il fallback va richiesto
esplicitamente:

```bash
ONDA_ALLOW_DEBUG_RELEASE=1 npm run android:release
```

Gradle segnala chiaramente che quell'artefatto non e' distribuibile. Il comando
`npm run release:android` rimuove sempre il flag e non puo' usare la debug key.

### Perche' la firma non e' in android/app/build.gradle

Perche' `android/` e' un artefatto di prebuild ed e' in `.gitignore`: viene
ricreata da zero a ogni `expo prebuild`. Una configurazione di firma scritta
li' sparirebbe senza rumore, e te ne accorgeresti pubblicando un APK firmato
con la chiave di debug. Sta quindi in `plugins/with-release-signing.js`, che
la re-inietta a ogni rigenerazione. Lo stesso plugin imposta tre proprieta'
Gradle, per lo stesso motivo:

| proprieta'                                          | perche'                                                                             |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `reactNativeArchitectures=armeabi-v7a,arm64-v8a`    | senza, l'APK porta 41 MB di librerie `x86`/`x86_64` che servono solo agli emulatori |
| `android.enableMinifyInReleaseBuilds=true`          | R8 sui ~45 MB di dex                                                                |
| `android.enableShrinkResourcesInReleaseBuilds=true` | risorse mai referenziate                                                            |

Le tre insieme portano l'APK da 103 MB a 50 MB.

### Verificare manualmente la firma

```bash
apksigner verify --print-certs app-release.apk        # deve dire CN=Onda
keytool -list -v -keystore credentials/onda-release.keystore
```

I due SHA-256 devono coincidere. `npm run release:android` esegue gia' questo
confronto senza stampare o passare le password sulla command line.

### R8 e le trappole che non ha

R8 rinomina e rimuove classi, e il codice che usa la reflection salta solo a
runtime: il typecheck e la build non se ne accorgono. Media3 e' il rischio
serio, perche' fa parecchia reflection.

Non serve nessuna regola di keep: gli AAR moderni portano le proprie
`consumer-proguard-rules`, e con questo stack R8 passa senza aggiunte.
Provato in release minificata su device: catalogo, ricerca federata,
riproduzione con media session `PLAYING`, menu contestuale, preferiti,
persistenza dopo `am force-stop`. Se un giorno qualcosa si rompe _solo_ in
release, e' quasi certamente qui — guarda `ClassNotFound` / `NoSuchMethod`
in logcat prima di cercare altrove.

### Che versione ho sul telefono

`version` e `versionCode` in `app.json` dicono a quale release appartiene
l'app, non da quale commit e' stata costruita. Fra due build personali dello
stesso pomeriggio erano identici, e sul telefono non resta altro: "ho
l'ultima versione?" era una domanda senza risposta.

`app.config.ts` ci aggiunge la provenienza. Legge Git al momento della build
e mette il commit in due posti:

- nel nome di versione, che diventa `0.2.0+68d225e`, con `.dirty` in coda se
  il worktree non era pulito. E' quello che risponde a
  `adb shell dumpsys package com.onda.player | grep versionName`, quindi si
  legge da fuori senza aprire l'app;
- in `extra.build`, che la schermata Informazioni mostra per esteso: numero
  di build, canale, commit e data.

Il confronto e' uno script:

```bash
npm run check:installed
```

Non costruisce e non installa niente: legge il telefono collegato, calcola
il nome di versione che una build fatta adesso produrrebbe e dice se
combaciano. Esce 0 se il telefono e' allineato, 2 se e' indietro o se Onda
non c'e'.

L'allineamento riguarda soltanto il nome di versione. Modifiche locali
diverse sullo stesso commit producono tutte il suffisso `.dirty`: il comando
non distingue questi APK e non confronta i loro byte. Per identificare
l'artefatto usa l'hash SHA-256 di `dist/personal/Onda-personal.json`; dopo
ulteriori modifiche locali ricompila e installa. È il caso delle due build
del 13 ottobre 2026, con lo stesso nome e hash diversi nel registro.

Il commit finisce nel nome di versione solo per le build personali, quelle
con `ONDA_FORCE_DEBUG_RELEASE=1`. La release ufficiale tiene il suo numero
pulito: e' quello che deve leggersi in un negozio o in una segnalazione.
La regola sta in `scripts/build-provenance.cjs`, che non tocca ne' Git ne' il
filesystem ed e' coperta dai test. E' CommonJS e non TypeScript di proposito:
`app.config.ts` lo carica Expo, che dal SDK 57 non transpila i moduli
importati e si affida alla rimozione dei tipi di Node, presente dalla 22.18 e
assente sulla 22.15 che il progetto dichiara come minimo. Un modulo `.cjs` si
carica su entrambe; i tipi stanno in `build-provenance.d.cts`.

`app.json` resta la fonte di verita' dell'identita' di release: gli script
che lo leggono come JSON (`personal.ts`, `release.ts`, `verify-signing.ts`)
continuano a vedere i valori dichiarati. Quando esce una release nuova si
alzano li', a mano: `version` in semver e `versionCode` di uno, perche' e'
il numero che Android confronta per accettare l'aggiornamento.

### Aggiornare l'app installata

Debug e release hanno firme diverse, quindi Android rifiuta l'aggiornamento
in place fra le due: bisogna disinstallare, e i dati dell'app se ne vanno.
Fra due release, invece, `adb install -r` conserva tutto.

Prima di disinstallare una build di debug con dentro dati che ti servono:

```bash
adb exec-out run-as com.onda.player cat files/mmkv/onda > onda.bak
```

E' solo una copia di sicurezza: non c'e' modo di reimportarla in una release,
che non essendo `debuggable` non concede `run-as`.

### Se un giorno vuoi il Play Store

Serve un `.aab`, non un APK:

```bash
cd android && ./gradlew bundleRelease
```

Alza `versionCode` in `app.json` a ogni caricamento. Il Client ID Jamendo non
e' nel bundle, lo inserisce ogni persona in app; la API gratuita Jamendo resta
comunque solo per uso non commerciale, e una distribuzione richiede prima le
conferme della [nota di conformità](RELEASE_COMPLIANCE.md).

---

## Gotcha Android

**La notifica non compare.** L'app chiede `POST_NOTIFICATIONS` al primo play
su Android 13+, ma le notifiche legate a una media session sono
[esenti dal permesso](https://developer.android.com/develop/ui/compose/notifications/notification-permission#media-sessions).
Controlla anche che la sessione e il servizio Media3 siano attivi: il
rifiuto del permesso da solo non spiega l'assenza dei controlli multimediali.

**L'audio si ferma andando in background.** Manca il servizio o il suo
`foregroundServiceType`. Il manifest del modulo
(`modules/onda-player/android/src/main/AndroidManifest.xml`) dichiara
`com.onda.playback.PlaybackService` con
`android:foregroundServiceType="mediaPlayback"`, e il merge lo porta
nell'APK: controllalo con
`aapt2 dump xmltree --file AndroidManifest.xml dist/personal/Onda-personal.apk`.

**Nel log `Lettura del player non riuscita`.** Il main thread non ha risposto
in due secondi a una lettura del JS: qualcosa lo tiene occupato o lo blocca, e
intanto la lettura ha restituito un valore neutro. E' un guasto da cercare
(vedi [Il modulo Media3](#il-modulo-media3)).

**HTTP 416 dopo un seek avanzato.** Il 13 ottobre 2026 è successo alla
ripresa di un lungo mix Audius dopo un seek a circa 1:07:00. Onda classifica
la risposta come `source` e passa al brano successivo. La causa non è
ancora accertata: un `206` sui primi byte nello smoke non esclude il
problema. Ripetere con uno stream fresco, confrontando durata dichiarata,
dimensione del file, `Range` richiesto dal player e `Content-Range` della
risposta, senza registrare credenziali. La prova e l'anomalia aperta sono
nel [registro dei collaudi](VERIFICATION_LOG.md).

**Una sorgente non risponde.** L'errore compare come banner senza bloccare
l'altra sorgente: e' voluto. Il banner ora si accende anche se la sorgente
cade a meta' scroll, non solo sulla prima pagina. Per spegnerne una del
tutto, usa gli interruttori in Libreria › Sorgenti. La disponibilità passa
da `src/services/sources/access.ts` e dalle preferenze in `src/store/sources.ts`.

**Non risponde nessuna sorgente.** Caso diverso, e va tenuto diverso: la
federazione lancia invece di tornare una lista vuota. Una lista vuota
sarebbe indistinguibile da un catalogo finito, e chi pagina la leggerebbe
come "fine elenco" chiudendo lo scroll infinito per sempre — la stessa
trappola delle liste vuote di Jamendo, un piano piu' in alto. La schermata
mostra allora il motivo e un bottone **Riprova**, perche' la query resta in
cache e da sola non ritenta piu'.

**Preferiti e playlist non sopravvivono al riavvio.** MMKV e' un modulo nativo:
dopo averlo aggiunto serve una build nuova (`npx expo run:android`), non basta
ricaricare il bundle.

**Qualcosa finisce sotto la barra di navigazione.** Android 16 rende
l'edge-to-edge obbligatorio (`edgeToEdgeEnabled` non e' piu' configurabile):
il contenuto disegna sotto le barre di sistema. Le schermate dentro le tab
sono coperte da `Screen`; il player e i fogli modali si compensano da soli
con `useSafeAreaInsets()`. Se aggiungi un foglio nuovo, ricordatene.

**L'app parte e crasha subito con `TurboModuleInteropUtils$ParsingException`.**
Un modulo nativo vecchio stile sotto la Nuova Architettura. RN 0.86 non ha
piu' l'architettura vecchia, quindi non si aggira: serve una versione del
modulo che sia un TurboModule vero. E' anche il motivo per cui il player e'
un modulo Expo, che la supporta.

**Un genere mostra solo tracce Audius.** Prima di sospettare il tag, lancia
`npm run smoke`: quasi sempre e' l'instabilita' di Jamendo qui sotto, non un
tag inesistente. Se il genere risulta vuoto anche li' e in modo ripetibile,
allora il tag e' davvero fuori uso: la traduzione sta in
`src/services/genres.ts`.

**Jamendo restituisce liste vuote a caso.** Misurato: circa 3 risposte su 10
arrivano con `status: success` e zero risultati anche quando i risultati
esistono, e non dipende dalla frequenza delle chiamate. E' il motivo per cui
`fetchResults` in `sources/jamendo.ts` riprova fino a tre volte prima di
credere a una lista vuota — senza, lo scroll infinito toglie Jamendo
dall'elenco (una pagina vuota per lui significa "questa sorgente ha finito")
e i generi sembrano rotti. Le vetrine di artisti e album della ricerca fanno
due tentativi invece di tre (`NAME_SEARCH_ATTEMPTS`): li' una lista vuota e'
il caso normale, e una vuota per errore costa una riga di vetrina, non un
elenco che si chiude.

**Una traccia parte, poi il player salta da solo alla successiva.** Voluto.
Nel catalogo Jamendo esistono brani il cui file audio non c'e' piu' (404
sull'URL restituito dall'API) e uno di questi sta stabilmente in cima ai
brani popolari. `playbackService` salta al successivo, ma non piu' di tre
volte di fila: il budget torna pieno appena un brano suona. Gli errori
classificati `network` non fanno avanzare: si riprova da soli tre volte, a
distanze crescenti e anche a schermo spento, e poi resta Riprova.

---

## Scelte da conoscere

**Il player e' un modulo nostro su Media3.** Fino all'11 ottobre 2026 era
`@rntp/player` 5.8.0, la cui licenza non permette di distribuire un APK che lo
incorpora. Onda ha scelto di mantenere qui il modulo nativo per controllare
coda con riordino, comandi con il JS sospeso, timer, recupero della rete e
integrazione Android Auto. `modules/onda-player` usa AndroidX Media3 dietro la
[facciata `src/player/`](#il-player-dietro-una-facciata). La versione di
Media3 e' esatta e si aggiorna solo insieme al collaudo su device di coda,
notifica, background e Android Auto.

**Il player non si apre se si interpreta subito un brano nullo come fine coda.**
Il brano attivo puo' arrivare dopo il primo render: `useActiveMediaItem()` di
RNTP, usato prima di `useNowPlaying`, partiva da `null` e lo riceveva un tick
dopo. Un `if (!active) router.back()` in un effetto chiude quindi la
schermata _sempre_, prima ancora che si veda. `app/player.tsx` esce solo dopo
aver visto davvero una traccia sparire. Vale per qualunque schermata nuova
che voglia chiudersi quando la riproduzione finisce.

**I tempi del player sono in secondi.** Posizioni, durate, `seekTo`,
`sleepAfter` e `progressIntervalSeconds`. Un valore in millisecondi passa il
typecheck e sbaglia di mille volte: con `progressIntervalSeconds: 5000` la
posizione si salverebbe ogni 83 minuti circa. E' la stessa trappola di
`useProgress` di RNTP, che misurava l'intervallo in secondi:
`useProgress(500)` avrebbe interrogato il player ogni 8 minuti e 20 secondi
invece che ogni mezzo secondo. Verificare sempre sia l'avanzamento sia
l'azzeramento al cambio traccia.

**Gli album esistono solo su Jamendo.** Audius espone `album_backlink` sulle
tracce, ma nella pratica e' quasi sempre `null`: mappare il campo avrebbe
prodotto una voce di menu che porta a una schermata vuota. La pagina artista
invece funziona su entrambe (`/users/{id}/tracks` e `/tracks/?artist_id=`).

**Il riordino delle playlist usa le frecce, non il drag.** Evita una libreria
nativa in piu' e funziona con TalkBack. Se preferisci il trascinamento:
`react-native-draggable-flatlist`, sostituendo il ramo `editing` in
`app/playlist/[id].tsx`.

**L'offset della paginazione e' per sorgente, non globale.** Ogni pagina
porta il cursore della successiva, `{ audius: 40, jamendo: 20 }`
(`SourceCursor` in `services/sources/federation.ts`, puro e testato), e
`useInfiniteTracks` lo passa alla richiesta dopo senza leggerlo. Una sorgente
che risponde avanza di una pagina; una caduta richiede la stessa pagina alla
volta dopo, senza fermare le altre; una che torna vuota senza errori ha finito
e non si interroga piu'. Cosi' con Jamendo giu' per ore lo scroll continua su
Audius, e quando Jamendo torna riparte da dove era: niente buchi, niente
doppioni, e il dedup per uid resta solo come difesa per il trending che cambia
ordine. I brani di un artista (`artistTracksPage`) usano lo stesso cursore con
una sorgente sola.

**Le richieste di catalogo si annullano.** Ogni `queryFn` passa il `signal`
di React Query alla sorgente (`ListParams.signal`) e da li' a `fetchJSON`:
una ricerca superata o una schermata chiusa mentre carica interrompono le
richieste in volo e i tentativi ancora da fare. `fetchJSON` distingue chi ha
interrotto: il tetto di tempo e' un guasto di rete da mostrare, l'annullamento
un `AbortError` che nessuno mostra. Una sorgente nuova deve passare
`params.signal` a ogni richiesta, altrimenti le sue continuano a girare.

**La cache di Metro segue i valori `EXPO_PUBLIC_*`.** babel-preset-expo li
scrive dentro il codice trasformato, ma la chiave della cache di Metro non li
considerava: quando il Client ID Jamendo stava in `.env`, dopo un suo cambio
il bundle successivo poteva portare quello vecchio. `metro.config.js` estende la configurazione di
Expo e mette in `cacheVersion` un'impronta di quei valori
(`scripts/metro-cache-version.cjs`): la cache si rinnova quando cambiano,
resta valida quando sono uguali e non serve svuotarla a mano.

**Le credenziali le inserisce la persona, in app.** L'APK non ne contiene:
Client ID Jamendo e API key Audius stanno in expo-secure-store
(`services/credentials`), con `configureAndroidBackup: false` perche' il backup
di Onda e' gia' disabilitato e le sue regole non vanno toccate. Gli adapter non
importano Keystore ne' MMKV: chiedono interruttori e credenziali a
`services/sources/access`, che `store/sources` collega all'avvio (lo importa il
layout radice) e che i test e `npm run smoke` collegano a valori finti. Senza
collegamento non lavora nessuna sorgente. La credenziale si legge a ogni
richiesta, quindi una cambiata vale subito; dopo ogni cambio di interruttori o
credenziali le query si azzerano (`resetQueries`), cosi' gli elenchi non
mostrano una sorgente appena spenta. Il primo avvio passa da `welcome.tsx`;
chi salta trova in Scopri un invito finche' non configura Jamendo o non lo
chiude (`showJamendoInvite`).

**Spegnere una sorgente non tocca la Libreria, ma la riproduzione si.** Un
brano salvato porta con se' il suo stream, e prima bastava quello a farlo
suonare: un preferito Jamendo partiva anche a Jamendo spenta. Ora preferiti,
playlist e cronologia lo tengono, attenuato, e tornano a suonarlo quando la
sorgente si riaccende; ma il player non lo riceve da nessuna strada.
`useQueue` e la coda ripristinata passano da `playableQueue`, l'albero di
Android Auto lo esclude, e `sourceGuard` toglie dalla coda del player e da
quella in attesa i brani della sorgente appena spenta. Il tocco su una riga
spenta mostra un avviso con il collegamento a Sorgenti, e il menu del brano
offre solo preferiti, playlist e Sorgenti.

**Il timer di spegnimento non e' persistito.** Un timer sopravvissuto al
riavvio metterebbe in pausa la musica senza che nessuno capisca perche'.

---

## Prossimi passi

- **Offline** — solo per sorgenti e licenze che lo consentono espressamente.
  I termini API di Jamendo vietano applicazioni progettate per memorizzare i
  contenuti o offrirne l'accesso offline: non implementarlo per quella
  sorgente senza un accordo dedicato.
- **Radio / simili** — Audius ha `/tracks/{id}/related`: e' la base per un
  "continua ad ascoltare" vero quando la coda finisce.
- **Playlist Audius** — `/v1/playlists/{id}/tracks` per navigare anche le
  raccolte pubbliche, non solo i brani singoli.
- **Terza sorgente** — si comincia aggiungendone l'id a `SOURCE_IDS` in
  `src/types/track.ts`: `SourceId`, la validazione della libreria e la
  lettura degli uid ne derivano, e TypeScript segnala le tre tabelle da
  completare, cioe' il registro in `services/sources/index.ts`, la
  descrizione in `services/sources/meta.ts` (nome, sigla di tre lettere,
  diritti di ripiego, eventuali condizioni da collegare a ogni brano) e un
  nome per ogni genere in `services/genres.ts`. Poi l'adapter: implementa
  `MusicSource`, passa `params.signal` a ogni richiesta e filtra i brani non
  riproducibili prima di restituirli. Restano scritti a mano, perche' sono
  testi legali o editoriali da rivedere comunque: i collegamenti a privacy
  e termini in `app/about.tsx`, `THIRD_PARTY_CONTENT.md`, `PRIVACY.md` e il
  suggerimento della ricerca vuota. Infine lo smoke (`scripts/smoke.ts`).
- **Comportamento senza rete** — il catalogo e' coperto a livello di
  adapter (caduta totale e parziale, ripresa con il cursore per sorgente,
  annullamento). Su Media3 reale, il 13 ottobre 2026, sono verificati
  recupero automatico a schermo spento, esaurimento dei tre retry e Riprova
  manuale. La pausa durante l'attesa o il caricamento cancella il recupero
  automatico anche se un errore arriva dopo; al ritorno della rete l'audio
  resta fermo finché non si preme play o Riprova (registro dei collaudi).
  Restano rete lenta, captive portal e cambio Wi-Fi/5G, nella checklist
  device. Per un player musicale l'aereo e la metropolitana sono normalita',
  non casi limite.
- **Test sugli store** — con i doppi in memoria di MMKV e del player gli store
  si provano in Node: sessione di ascolto, libreria (`scripts/library-store.test.ts`:
  ogni mutazione lascia su disco lo stato che i componenti leggono, il
  catalogo si pota, l'import fonde e non scrive a vuoto) e preferenze di
  riproduzione (`playback-store.test.ts`) sono coperti, come il cablaggio
  della cache di React Query su MMKV (`query-client.test.ts`: solo chiavi
  persistibili, senza brani Audius, rilettura del solo fresco). Restano
  `searchHistory`, `progress`, `sleepTimer` e `notificationPermission`.

---

## Licenze

Il codice e la documentazione originale di Onda sono distribuiti sotto
[licenza MIT](../LICENSE). Musica, artwork, metadati remoti, credenziali e
marchi sono esclusi: consulta le [note sui contenuti di terze parti](../THIRD_PARTY_CONTENT.md)
prima di modificare o distribuire l'app.

La licenza MIT permette l'uso commerciale del codice, ma non concede diritti
commerciali sulle API o sui cataloghi. Jamendo richiede un accordo dedicato
per gli usi commerciali; ogni contenuto Audius resta soggetto alla licenza o
alle restrizioni selezionate dall'artista.
