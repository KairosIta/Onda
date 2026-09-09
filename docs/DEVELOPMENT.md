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
npm run setup:personal
npm run doctor
npm run install:personal
```

Le sezioni sotto spiegano l'ambiente di sviluppo e la pipeline del maintainer.

### Cosa serve

- [Node.js](https://nodejs.org/) e npm
- **JDK 17** (non JDK 21)
- **Android SDK 36** con build-tools 36.0.0
- un dispositivo Android con debug USB, oppure un emulatore
- un Client ID gratuito di Jamendo

> [!IMPORTANT]
> Expo Go non è sufficiente: il player e lo storage usano moduli nativi.
> La prima compilazione scarica anche NDK 27.1 e CMake.

### Installazione

```bash
npm ci
npm run setup:personal
```

Apri `.env` e inserisci il Client ID ottenuto dal
[portale sviluppatori Jamendo](https://devportal.jamendo.com/), quindi:

```bash
npm run smoke
npx expo run:android
```

Al termine Onda verrà installata e avviata sul dispositivo collegato. Dagli
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

- **Jamendo** — registrati sul portale sviluppatori, crea un'applicazione,
  copia il Client ID in `.env`.
- **Audius** — non serve una chiave per le operazioni di sola lettura usate da
  Onda. `app_name` è soltanto un'etichetta identificativa, non un segreto.

`.env` è in `.gitignore`. Le variabili `EXPO_PUBLIC_*` finiscono comunque nel
bundle: non devono contenere segreti destinati a una distribuzione pubblica.

## Architettura

Onda è costruita con Expo, React Native e TypeScript. Gli adapter delle
sorgenti trasformano Audius e Jamendo in un unico modello dati; il player
nativo mantiene una sola coda, anche quando contiene brani di entrambe.

### Struttura del progetto

```
index.js                    entry custom: expo-router + registrazione del playback service
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
src/
  types/track.ts            modello unificato + interfaccia MusicSource
  services/sources/         adapter Audius e Jamendo + registro federato (brani, vetrine, artisti, album)
  services/genres.ts        unica tabella di traduzione dei generi tra le due API
  services/storage.ts       istanza MMKV + lettura JSON sicura e scrittura
  services/setupPlayer.ts   configurazione RNTP (una volta per processo)
  services/playbackService.ts  comandi da notifica, lockscreen, Bluetooth
  services/mediaItems.ts    andata e ritorno fra il nostro modello e gli elementi di coda RNTP
  services/playbackStatus.ts  lo stato unico del tasto play, ricavato dai segnali RNTP
  services/playerCommands.ts  play, pausa e skip con la semantica giusta per ogni stato
  services/progressPolicy.ts  quando, e quanto spesso, leggere la posizione dal player
  services/queryClient.ts   React Query reidratata da MMKV; potatura in queryPersistenceSchema.ts
  services/browseTree.ts    l'albero per Android Auto dalla libreria (puro); l'invio sta in browseTreeSync.ts
  store/library.ts          preferiti, playlist, cronologia (persistiti)
  store/playback.ts         shuffle e repeat (persistiti)
  store/session.ts          brano attivo + coda e posizione salvate, "in attesa" all'avvio; useNowPlaying (schema in sessionSchema.ts)
  store/progress.ts         l'unico osservatore di progresso dell'app
  store/sleepTimer.ts       timer di spegnimento (volatile, di proposito)
  store/searchHistory.ts    le ultime ricerche (persistite); la regola in utils/recentQueries.ts
  hooks/useQueue.ts         sostituzione coda, riproduci dopo, accoda
  hooks/usePlaybackStatus.ts  lo stato del player come hook
  hooks/useUpNext.ts        cosa viene dopo il brano corrente; la regola in utils/upNext.ts
  utils/reorder.ts          geometria del riordino a trascinamento della coda (worklet)
  hooks/useInfiniteTracks.ts  scroll infinito su qualunque elenco, federato o no
  services/playbackService.ts registra i cambi di traccia, anche in background
  components/               TrackList, TrackRow, MiniPlayer, menu contestuale, ...
  components/Artwork.tsx    ogni copertina passa da qui: expo-image, dissolvenza, cache, segnaposto
  components/PressableScale.tsx  bottone che si ritrae con la molla condivisa; aptica opzionale
  components/Skeleton.tsx   sagome di caricamento per liste, raccolte e vetrine, al posto delle rotelle
  components/TrackStrip.tsx vetrina orizzontale di brani (recenti, in ascesa, voci nuove)
  components/EntityStrip.tsx  vetrina di artisti o album nei risultati di ricerca
  components/GenreGrid.tsx  la griglia dei generi, ognuno con la sua pagina
  components/Snackbar.tsx   avviso in basso con un'azione (Annulla), al posto dei toast
  services/haptics.ts       feedback tattile di sistema: l'unico file che parla con expo-haptics
  theme.ts                  palette, spaziature, tipografia (Manrope), molla condivisa
assets/fonts/               Manrope (SIL OFL 1.1), incorporata dal plugin expo-font come famiglia XML
scripts/
  release.ts                pipeline fail-closed per APK di distribuzione
  release-policy.ts         validazione pura di ambiente e credenziali
  smoke.ts                  collaudo degli adapter contro le API vere (npm run smoke)
  node-hook.mjs             risolve l'alias '@/' quando gli adapter girano in Node
plugins/
  with-release-signing.js   firma e proprieta' Gradle della release (android/ e' rigenerabile)
  with-android-auto.js      descrittore automotive_app_desc e meta-data per Android Auto
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

La coda invece non e' in uno store nostro: vive dentro RNTP, che resta l'unica
fonte di verita' anche quando i comandi arrivano dalla notifica. `store/session`
la fotografa su MMKV quando cambia (anche dal gestore headless) e salva la
posizione dai tick del timer nativo `progressSync`; all'avvio la rimette "in
attesa" senza caricarla nel player, cosi' niente stream e niente notifica
prima di un play. Le schermate leggono il brano da `useNowPlaying` (nello stesso store, cosi'
brano del player e coda in attesa cambiano in un solo snapshot), e i comandi di trasporto
passano da `services/playerCommands`, che consegna la coda al player al primo
play o skip. Per questo nessuna schermata chiama `useActiveMediaItem` o
`useProgress` di RNTP direttamente: il progresso lo legge un solo timer,
`store/progress`, e lo stato del tasto play viene da `usePlaybackStatus`.

React Query e' reidratata da MMKV prima del primo render
(`services/queryClient`): trending, vetrine, artisti e album tornano da disco
e si rinfrescano in background, la ricerca no. La potatura — trenta query,
due pagine per elenco, tre giorni — sta in `queryPersistenceSchema`, puro e
testato, e vale anche come `gcTime`.

Le sorgenti dichiarano le funzioni opzionali (`spotlight`, `searchArtists`,
`searchAlbums`, gli album) e la federazione salta chi non le ha senza
contarlo come caduta: Audius non cerca album, e la vetrina di Cerca resta
solo Jamendo senza avvisi inutili. `combine` e `interleave` sono generici
sul tipo di elemento, cosi' artisti e album si alternano come i brani.

Android Auto legge l'albero costruito da `services/browseTree` dalla
libreria persistita — preferiti, playlist, ascolti recenti — e
`browseTreeSync` lo rimanda a RNTP a ogni mutazione, accorpando quelle
ravvicinate. Il manifest lo dichiara tramite `plugins/with-android-auto.js`;
il servizio media e il suo intent filter li porta gia' RNTP.

`TrackList` e' l'unica lista dell'app. Si abbona lei alla libreria e al player,
e passa `isFavorite` / `isActive` alle righe come prop: cosi' `TrackRow` resta
`memo` e un cuoricino toccato non ridisegna cinquanta righe.

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

---

## Collaudo delle API senza device

I test unitari non usano rete, MMKV o moduli React Native e vanno eseguiti
prima del collaudo live:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

Coprono la validazione della libreria e delle preferenze playback persistite,
le migrazioni dei vecchi valori repeat e il cursore della paginazione
federata, compreso il recupero dopo una risposta parziale.

`npm run typecheck` rigenera prima `.expo/types/router.d.ts` con
`expo customize tsconfig.json` e solo dopo lancia `tsc`. Con
`experiments.typedRoutes` attivo, ogni `router.push` viene confrontato con
le rotte presenti in `app/`, ma il file dei tipi e' generato, ignorato da Git
e non si aggiorna da solo: una copia lasciata da un `expo start` precedente a
una rotta nuova fa fallire il typecheck con un "not assignable" su una rotta
che esiste. Rigenerarlo ad ogni controllo rende l'esito uguale su ogni
computer, anche dove `.expo/` non e' mai stata creata.

`npm test` disattiva l'isolamento per processo del test runner di Node: in
questo modo il riepilogo mostra i singoli casi invece di contarli come un solo
file, senza cambiare il loro ambiente o la loro semantica.

```bash
npm run smoke
```

### Audit delle dipendenze

Verificato il 9 agosto 2026: l'override `xcode > uuid` in `package.json`
porta `uuid` alla versione corretta 11.1.1 e rimuove le segnalazioni moderate
GHSA-w5hq-g745-h8pq. Non va sostituito con `npm audit fix --force`: npm propone
un downgrade incompatibile a Expo 53 e React Native 0.72.

Restano segnalazioni alte propagate da un'unica dipendenza di Metro,
`image-size@1.2.1` (GHSA-w3rx-r6r6-pgpr e GHSA-5p2g-fcmc-qvqq). Alla data
della verifica non esiste una versione corretta. Il rischio riguarda un DoS
del processo Node quando il bundler analizza file ICNS, JXL o HEIF costruiti
appositamente; non e' codice eseguito nell'APK. Onda usa soltanto asset locali
revisionati e non accetta asset di build da utenti o dalla rete.

Rieseguire periodicamente:

```bash
npm audit
npx expo install --check
npx expo-doctor
```

Rimuovere l'eccezione non appena Metro/Expo pubblica una dipendenza corretta
compatibile con SDK 57.

Gli adapter sono TypeScript puro, senza React Native dentro: girano in Node
cosi' come sono, contro le API vere e con il tuo `.env`. Lo script controlla
per ogni sorgente ricerca, trending, paginazione, pagine artista e album,
la federazione, tutti i generi, e chiede agli stream un `Range` per verificare
che il seek sia possibile.

Serve perche' il typecheck non puo' vedere niente di tutto questo: al primo
giro ha trovato tre bug reali in Jamendo (parametro `order` rifiutato sugli
album, pagine artista vuote, generi che sembravano inesistenti). Rilancialo
dopo ogni modifica agli adapter.

Un `warn` su un genere non e' un errore: e' una sorgente che per quel tag non
ha risultati. Un `FAIL` si', ed e' quasi sempre l'API che e' cambiata.

---

## Verifica dopo il primo avvio

Nell'ordine. Se salti un passaggio, il bug lo trovi tre settimane dopo.

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
13. Chiudi l'app, togli la rete e riaprila: Scopri mostra l'ultimo trending
    invece delle sagome.
14. Scopri ha le vetrine "In ascesa questa settimana" e "Voci nuove" con
    brani di entrambe le sorgenti, e un genere dalla griglia apre la sua
    pagina con Riproduci e Casuale.
15. In Cerca, "love" mostra artisti (tondi, da entrambe le sorgenti) e album
    (quadrati, solo Jamendo) sopra i brani; con la casella vuota compaiono
    le ricerche recenti.
16. Nella Coda trascina una riga dalla maniglia a destra: le altre si
    spostano per farle posto e all'arrivo il brano suona nell'ordine nuovo.
    "Svuota da qui in giu'" mostra un avviso con Annulla che rimette i brani.
17. Nel player, sotto i controlli, la riga "Prossimo" dice il brano che
    viene dopo e cambia con shuffle e ripetizione.

Il punto 3 e' quello che rompe piu' spesso, ed e' anche quello che fallisce
in silenzio.

Tutti e otto sono stati percorsi su un Motorola Edge 50 Neo con Android 16
(SDK 36). Se ti servono prove misurabili invece che a occhio:

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
Prima di costruire controlla `.env`, Client ID Jamendo, JDK 17, Android SDK 36,
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
runtime: il typecheck e la build non se ne accorgono. Media3 e track-player
erano il rischio serio, perche' Media3 fa parecchia reflection.

Non serve nessuna regola di keep: gli AAR moderni portano le proprie
`consumer-proguard-rules`, e con questo stack R8 passa senza aggiunte.
Provato in release minificata su device: catalogo, ricerca federata,
riproduzione con media session `PLAYING`, menu contestuale, preferiti,
persistenza dopo `am force-stop`. Se un giorno qualcosa si rompe _solo_ in
release, e' quasi certamente qui — guarda `ClassNotFound` / `NoSuchMethod`
in logcat prima di cercare altrove.

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

Alza `versionCode` in `app.json` a ogni caricamento. E ricordati che il
`client_id` Jamendo e' inlinato nel bundle (`EXPO_PUBLIC_*`): prima di
pubblicare va spostato dietro un proxy, e la API gratuita Jamendo e' comunque
solo per uso non commerciale.

---

## Gotcha Android

**La notifica non compare.** Permesso `POST_NOTIFICATIONS` non concesso
(obbligatorio da Android 13). L'app lo richiede all'avvio; se hai negato,
riabilitalo dalle impostazioni di sistema.

**L'audio si ferma andando in background.** Il service e' stato registrato
dentro React invece che in `index.js`, oppure manca `foregroundServiceType`
nel manifest. Dopo `npx expo prebuild --platform android`, controlla che
`android/app/src/main/AndroidManifest.xml` contenga il service RNTP con
`android:foregroundServiceType="mediaPlayback"`. Le versioni recenti di RNTP
lo dichiarano da sole nel merge del manifest: se non c'e', aggiungilo a mano.

**Errore "player is not initialized".** `setupPlayer()` chiamato prima che
il modulo nativo sia pronto, tipico dopo un fast refresh. Ricarica l'app.

**Una sorgente non risponde.** L'errore compare come banner senza bloccare
l'altra sorgente: e' voluto. Il banner ora si accende anche se la sorgente
cade a meta' scroll, non solo sulla prima pagina. Per spegnerne una del
tutto, metti `enabled: false` in `src/services/sources/index.ts`.

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
modulo che sia un TurboModule vero. E' esattamente il motivo per cui
il player deve essere `@rntp/player` 5.x, costruito per la New Architecture.

**Un genere mostra solo tracce Audius.** Prima di sospettare il tag, lancia
`npm run smoke`: quasi sempre e' l'instabilita' di Jamendo qui sotto, non un
tag inesistente. Se il genere risulta vuoto anche li' e in modo ripetibile,
allora il tag e' davvero fuori uso: la traduzione sta in
`src/services/genres.ts`.

**Jamendo restituisce liste vuote a caso.** Misurato: circa 3 risposte su 10
arrivano con `status: success` e zero risultati anche quando i risultati
esistono, e non dipende dalla frequenza delle chiamate. E' il motivo per cui
`fetchResults` in `sources/jamendo.ts` riprova fino a tre volte prima di
credere a una lista vuota — senza, lo scroll infinito si ferma per sempre
(una pagina vuota per lui significa "fine elenco") e i generi sembrano rotti.

**Una traccia parte, poi il player salta da solo alla successiva.** Voluto.
Nel catalogo Jamendo esistono brani il cui file audio non c'e' piu' (404
sull'URL restituito dall'API) e uno di questi sta stabilmente in cima ai
brani popolari. `playbackService` salta al successivo, ma non piu' di tre
volte per coda. Gli errori classificati `network` non fanno avanzare: la coda
resta ferma finche' la connessione non torna o l'utente sceglie altro.

---

## Scelte da conoscere

**Il player e' `@rntp/player@5.8.0`.** E' la linea stabile ufficiale RNTP
scritta per la New Architecture con JSI e TurboModules. Non va confusa con
il vecchio pacchetto npm `react-native-track-player`, rimasto sulla linea 4.x
e con una vecchia alpha 5 non compatibile con l'API stabile. La versione e'
esatta, senza caret: e' il componente che fa suonare la musica e si aggiorna
solo insieme alla checklist playback/background/notifica.

**Il player non si apre se si interpreta subito un media item nullo come fine coda.**
`useActiveMediaItem()` parte da `null` prima della prima transizione. Un
`if (!active) router.back()` in un effetto chiude quindi la
schermata _sempre_, prima ancora che si veda. `app/player.tsx` esce solo dopo
aver visto davvero una traccia sparire. Vale per qualunque schermata nuova
che voglia chiudersi quando la riproduzione finisce.

**`useProgress` 5.8 misura l'intervallo in secondi.** `useProgress(0.5)`
interroga il player ogni 500 ms; `useProgress(500)` lo farebbe soltanto ogni
8 minuti e 20 secondi, lasciando fermi slider, tempi e mini-player. Verificare
sempre sia l'avanzamento sia l'azzeramento al cambio traccia.

**Gli album esistono solo su Jamendo.** Audius espone `album_backlink` sulle
tracce, ma nella pratica e' quasi sempre `null`: mappare il campo avrebbe
prodotto una voce di menu che porta a una schermata vuota. La pagina artista
invece funziona su entrambe (`/users/{id}/tracks` e `/tracks/?artist_id=`).

**Il riordino delle playlist usa le frecce, non il drag.** Evita una libreria
nativa in piu' e funziona con TalkBack. Se preferisci il trascinamento:
`react-native-draggable-flatlist`, sostituendo il ramo `editing` in
`app/playlist/[id].tsx`.

**L'offset della paginazione e' per sorgente, non globale.** Chiedendo la
pagina 2 a entrambe si ottengono risultati nuovi da entrambe; `useInfiniteTracks`
salva l'offset realmente usato in ogni pagina. Dopo un risultato completo lo
incrementa di `pageSize`; se una sorgente fallisce mantiene lo stesso offset,
ritenta senza creare buchi e deduplica i risultati gia' mostrati.

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
- **Terza sorgente** — implementa `MusicSource` e registrala. Il resto dell'app
  non cambia di una riga.
- **Comportamento senza rete** — coperto solo il lato catalogo: caduta totale,
  caduta parziale e ripristino sono collaudati a livello di adapter (fetch
  sostituita, contro le API vere), ma **non ancora su device**. Restano da
  provare la riproduzione che perde la rete a meta' brano e il rientro dalla
  modalita' aereo. Per un player musicale l'aereo e la metropolitana sono
  normalita', non casi limite.
- **Test sugli store** — lo smoke copre le API, non `library`/`playback`. Sono
  i bug che l'utente paga di piu', perche' perde dati.

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
