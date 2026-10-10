# Registro dei collaudi di Onda

Qui sta l'evidenza: cosa è stato verificato, quando, su quale dispositivo o
build e con quale prova. La [roadmap](../TODO.md) tiene solo le voci aperte;
quando una si chiude passa qui con la sua prova, così niente di ciò che è
stato verificato si perde e si sa che cosa non deve regredire.

Le voci sono riportate come erano nella roadmap al momento della chiusura:
date, misure, conteggi di test e nomi di file si riferiscono a quel momento.

---

## Baseline verificata

### Verificato il 10 ottobre 2026 su Motorola Edge 50 Neo, Android 16

Build personale del branch della PR #30, all'ultimo commit di codice
(`409bb56`).

- [x] Ambiente preparato da zero con JDK 17 (Temurin 17.0.20.1) e Android
      SDK (command-line tools 23, platform-tools 37.0.1, Platform 36,
      Build-Tools 36.0.0); `npm ci` e `npm run doctor` verdi. Le
      command-line tools 23 sostituiscono `sdkmanager` con «Android CLI»,
      che registra la licenza dell'SDK in `licenses/` durante
      l'installazione.
- [x] `npm run install:personal` completo: test, typecheck, ESLint,
      Prettier, prebuild, Android Lint, APK da 55.468.617 byte e
      installazione; `npm run check:installed` conferma sul dispositivo la
      build di quel commit. Installazione pulita: la migrazione 2 → 3 non è
      stata esercitata su dati esistenti.
- [x] Jamendo guasto, con un Client ID finto passato da terminale: in Scopri
      compare l'avviso «Jamendo non risponde» e lo scroll di «Di tendenza» va
      oltre i primi venti brani con le pagine di Audius. È la prova su device
      del cursore per sorgente.
- [x] Prove manuali sulla stessa build, superate: navigazione fra tab,
      pagine e modali dopo l'aggiornamento di expo-router alla 57.0.25,
      attribuzione nel player per brani Audius e Jamendo, ricerca.
- [x] Trovato durante la stessa prova: la cache delle trasformazioni di Metro
      (`/tmp/metro-cache`) conserva i valori `EXPO_PUBLIC_*` della build
      precedente. A cache intatta la build con il Client ID finto conteneva
      ancora quello vero; a cache svuotata il bundle aveva quello finto, e la
      build normale successiva, di nuovo a cache svuotata, quello vero.
      Verificato contando le occorrenze nell'APK, senza esporre il valore.
      Corretto lo stesso giorno: voce chiusa in P2.
- [x] Correzione della cache di Metro verificata sulla pipeline vera: due
      `npm run build:personal` di fila senza svuotare la cache, la prima con
      un Client ID finto e la seconda con quello di `.env`. Ogni APK contiene
      solo il proprio valore.
- [x] Cache di sessione per Audius, con la build del branch della PR #41
      (`d5d081f`) installata sopra la precedente, dati compresi. Al primo
      avvio il log riporta la migrazione dello storage 3 → 4
      (`query-cache.v1: via i dati Audius`). Riaperta a rete spenta, la
      vetrina «In ascesa questa settimana» torna da disco con i soli brani
      Jamendo, mentre «Ascoltati di recente» e il mini-player conservano il
      brano Audius della libreria. Con la rete la vetrina torna con brani di
      entrambe le sorgenti.

### Verificato il 9 ottobre 2026, senza device

Controlli automatici sul lavoro della PR #30: cursore per sorgente, annullamento delle
richieste, vetrine di nomi, player, audit e patch dell'SDK 57. Nessuna build
installata su un telefono: le prove device di questi cambi stanno nelle voci
aperte della roadmap.

- [x] 123 test, typecheck, ESLint, Prettier, Expo Doctor 21/21 e prebuild
      Android passano; `npx expo export --platform android` genera il bundle
      Hermes.
- [x] CI verde su `ubuntu-latest`, `windows-latest` e controllo delle
      dipendenze sull'ultimo commit della PR.
- [x] `npm run check:audit` blocca sul lockfile precedente (brace-expansion,
      compression, shell-quote critico, source-map-js) e passa dopo gli
      override, con `braces` e `node-forge` accettati fino al 15 gennaio 2027.
- [x] Prova di mutazione: con la regola vecchia del cursore («una sorgente
      caduta ferma tutte») tre test diventano rossi.

### Verificato il 9 settembre 2026 su Motorola Edge 50 Neo, Android 16

Build personale dal branch degli sprint di settembre, comandata via ADB dal
computer (tocchi, screenshot, `dumpsys media_session`, logcat).

- [x] Manrope ovunque, tab bar compresa; cifre tabulari nelle durate.
- [x] Scopri a sezioni: recenti, «In ascesa questa settimana» e «Voci nuove»
      con brani di entrambe le sorgenti, griglia dei generi e pagina Jazz con
      Riproduci/Casuale; un tocco su una vetrina fa partire il brano con la
      vetrina come coda e i recenti si aggiornano subito.
- [x] Ripresa: pausa a 36 s, `am force-stop`, riapertura: mini-player con lo
      stesso brano, nessuna notifica, player nativo senza `prepare`; al play
      riparte da 36,5 s e la Coda mostra tutti e 20 i brani.
- [x] Coda in attesa: skip avanti dal mini-player carica la coda salvata e
      passa al brano seguente senza far sparire il mini-player.
- [x] Stream morto (Jamendo 404) a metà coda: il salto automatico arriva al
      brano dopo e suona. Trovato e corretto stasera: prima l'indice si
      spostava ma il player restava `idle` in silenzio.
- [x] Modalità aereo a metà brano: avviso «Il brano non risponde» con Riprova,
      tasto play rosso; tornata la rete, Riprova riparte dalla stessa
      posizione. Trovato e corretto stasera: su Android lo stato `error` non
      arriva mai e l'avviso non compariva.
- [x] Coda: trascinare dalla maniglia sposta la riga di tre posti, le altre
      fanno posto e il brano continua; «Svuota i successivi» e Annulla entro
      quattro secondi rimettono i 19 brani nello stesso ordine.
- [x] Cerca «love»: artisti tondi da entrambe le sorgenti, album Jamendo,
      brani sotto; a casella vuota il chip della ricerca recente con Cancella;
      il tocco su un artista apre la sua pagina anche con la tastiera aperta
      (corretto stasera: le strisce annidate chiudevano solo la tastiera).
- [x] Player: trascinamento sotto la soglia torna su, oltre chiude; la riga
      «Prossimo» mostra il brano seguente e apre la Coda.
- [x] L'APK contiene `xml/automotive_app_desc` e il meta-data per Android
      Auto; nessuna prova con un'unità o con il Desktop Head Unit.

### Verificato il 10 settembre 2026 su Motorola Edge 50 Neo, Android 16

Cinque build personali in sequenza, comandate via ADB; le prove sono
descritte nelle voci che chiudono (permesso notifiche, route e not-found,
stati errore/vuoto, snackbar del menu, cronologia a soglia, migrazione MMKV,
player adattivo, bersagli da 48 dp).

- [x] Il dump di `uiautomator` fallisce con «could not get idle state» mentre
      la barra del mini-player avanza: si mette in pausa dalla sessione media
      (`cmd media_session dispatch pause`) e poi si misura.
- [x] Ripresa, le due varianti che mancavano al 9 settembre. Swipe dai
      recenti: il processo sopravvive sia in riproduzione sia in pausa, perché
      il foreground service (`isForeground=true`, `types=0x2`) lo protegge, e
      nemmeno `am kill` lo scalfisce; quindi lo swipe da solo non dimostra
      niente sulla persistenza. Dopo un riavvio del telefono, con RAM azzerata
      e pid nuovo: mini-player con lo stesso brano, zero notifiche, **zero
      byte** di rete misurati su `dumpsys netstats` per uid 10542, sessione
      media `NONE(0) position=0`; al play la sequenza è `PAUSED 0` →
      `PAUSED 71158` → `BUFFERING` → `PLAYING 71160`, cioè due millisecondi
      di scarto dalla posizione salvata prima del riavvio. Con il force-stop
      lo scarto era di sette millisecondi. Buffering di 6 s a rete fredda
      contro 1,4 s a rete già stabilita.
- [x] Cronologia e avanzamento durante la stessa prova: un brano ascoltato
      oltre la soglia finisce in «Ascoltati di recente», e a fine traccia la
      coda avanza da sola al brano seguente.

### Verificato il 22 agosto 2026

- [x] 25 test, typecheck, ESLint, Prettier ed Expo Doctor 21/21 passano.
- [x] `npm run doctor` verifica Linux/Windows, Node, JDK 17, SDK 36,
      Build-Tools 36.0.0, ADB, dipendenze e Client ID Jamendo.
- [x] `npm run build:personal` completa prebuild, Android Lint, bundle
      standalone, R8 e APK da 52.640.322 byte su Linux.
- [x] La firma personale persistente è diversa dall'identità ufficiale; la
      pipeline verifica firma, certificato e presenza del bundle JS.
- [x] Screenshot con artwork reali sostituiti da contenuti dimostrativi
      originali; documentazione source-only, Windows, Codex e Claude aggiunta.
- [x] Build manuale completa su GitHub Actions (`Verify personal build`,
      [run 32597197344](https://github.com/KairosIta/Onda/actions/runs/32597197344))
      passata su `ubuntu-latest` in circa 21 minuti e su `windows-latest` in
      circa 38, dopo il primo push pubblico.

### Verificato il 7 agosto 2026

- [x] `npm run typecheck` passa.
- [x] Smoke live Audius + Jamendo passa: trending, ricerca, paginazione,
      artista, album Jamendo, federazione, alternanza e 13 generi.
- [x] Campione stream: Audius **5/5** vivi; Jamendo **4/5** vivi; tutti gli
      stream vivi supportano richieste `Range`.
- [x] Git contiene uno storico e un remote `origin`.
- [x] README, guida sviluppatori, MIT e note sui contenuti terzi sono presenti.

### Verificato il 10-11 agosto 2026 sul worktree locale

- [x] Ventuno test unitari passano: validazione della libreria, preferenze
      playback, migrazione dei vecchi repeat, cursore federato e identità di
      firma della release.
- [x] Typecheck, ESLint, Prettier ed Expo Doctor 20/20 passano.
- [x] Smoke live completo: Audius 5/5 e Jamendo 4/5 stream vivi, tutti con
      `Range`; federazione funzionante, 12 generi alimentati da entrambe le
      sorgenti e Hip-Hop oggi disponibile solo da Audius.
- [x] APK release con R8/resource shrinking da **52.653.176 byte**, ABI
      `arm64-v8a` + `armeabi-v7a`, firma `CN=Onda` RSA 4096 e schema APK v2.
- [x] Android Lint dell'app passa con **0 errori e 0 warning** dopo la triage
      dell'11 agosto; resta un'esclusione temporanea e dichiarata dei task
      `lintAnalyzeRelease` di Worklets/Reanimated, che fanno crashare il motore
      Lint su `build.gradle.kts` prima di produrre segnalazioni.
- [x] Pipeline `npm run release:android` provata end-to-end su snapshot Git
      pulito: preflight, test, prebuild, Lint, R8, firma, confronto certificato,
      ABI e archiviazione di APK/mapping/manifest completati. Il test ha prodotto
      un APK da **52.654.226 byte** con certificato Onda atteso.
- [x] Clone pulito da GitHub al commit `c093ec7`: `npm ci`, 20 test originari,
      typecheck, ESLint, Prettier, Expo Doctor 20/20 e prebuild Android senza
      `.env` completati; worktree del clone rimasto pulito.
- [x] Backup offline della firma creato su volume separato `ONDA_BACKUP` come
      archivio GPG AES-256. Decifratura, confronto byte-per-byte e
      `npm run verify:signing` sulla copia ripristinata passano; l'archivio
      persiste dopo remount con SHA-256
      `ddb43f42a6d669e14208178d68046294e6f7534b625a3ab7494653a713c85605`.

Le prove device complete del 5 agosto non sono ancora state ripetute in ogni
scenario sull'APK dell'11 agosto. Il nuovo artefatto non è quindi un candidato
pubblico collaudato.

### Verificato il 10-11 agosto 2026 su Motorola Edge 50 Neo, Android 16

- [x] Upgrade release con `adb install -r`: firma accettata, data della prima
      installazione invariata al 5 agosto e cronologia/libreria conservate.
- [x] Quattro cold start standalone fra 247 e 315 ms; catalogo federato e artwork
      caricati senza eccezioni JavaScript o crash nativi.
- [x] Riproduzione, pausa/play, successivo, coda da 12 brani, background e
      dieci secondi a schermo realmente spento verificati via media session.
- [x] Slider e tempi di player/mini-player aggiornati ogni mezzo secondo: sul
      device il tempo passa da 2:09 a 2:16 e si azzera a 0:01 cambiando brano.
- [x] Qualità audio, shuffle senza riavvio del brano e timer da 15 minuti con
      countdown/annullamento confermati manualmente.
- [x] Notifica Media3 con artwork, metadati e tre controlli verificata nello
      storico. La patch usata allora non è più distribuita; resta da ripristinare
      l'apertura diretta tramite API pubblica o autorizzazione RNTP.
- [x] Dati locali e catalogo tornano dopo `am force-stop` e cold start.
- [x] APK dell'11 agosto installato in-place; rotazione orizzontale funzionante,
      schermata Scopri integra e nessun crash o errore React Native nei log.

Restano manuali il timer sotto Doze prolungato, la coda durante lo shuffle,
TalkBack e gli scenari di rete/accessibilità della checklist completa.

### Evidenza device/build del 5 agosto 2026

- [x] Typecheck, Expo Doctor 20/20, build release con R8/resource shrinking e
      Android Lint senza issue.
- [x] APK da **52.130.403 byte**, ABI `arm64-v8a` + `armeabi-v7a`, certificato
      `CN=Onda`, RSA 4096 e schema APK v2.
- [x] Debug su Motorola Edge 50 Neo, Android 16: catalogo, seek, background,
      notifica, schermo spento, tasti media, preferiti/cronologia e pagine
      artista/album funzionanti.
- [x] Release standalone: cold start misurato a 303 ms, catalogo federato,
      primo stream in `PLAYING`, metadati e coda da 40 brani.
- [x] Contrasto principale misurato: testo 16.41:1, secondario 6.21:1,
      accento 10.38:1; release senza cleartext HTTP.

Queste prove device non sono state ripetute il 7 agosto. TalkBack, consumi e
trasferimento D2D reale restano aperti; percorso release e restore legacy sono
stati verificati successivamente.

### Verificato l'11 agosto 2026 su AVD Android 11/API 30

- [x] Immagine Google APIs x86_64 e AVD `onda_api30` creati per esercitare il
      ramo legacy `fullBackupContent`, distinto dalle regole Android 12+.
- [x] Release temporanea x86_64 firmata col certificato Onda; APK verificato con
      `allowBackup=false`, `fullBackupContent` e `dataExtractionRules` presenti.
- [x] Con Backup Manager attivo e transport locale, un marker sintetico nei dati
      dell'app non viene acquisito: `backupnow` risponde `Backup is not allowed`.
- [x] Dopo disinstallazione e reinstallazione il marker resta assente; il restore
      manuale del set locale segnala `restoreStarting: 0 packages` e non crea
      dati. AVD spento ordinatamente e conservato per regressioni future.

---

## Voci chiuse della roadmap

### P0 — Prima di una release binaria ufficiale

- [x] **Rendere la build di distribuzione fail-closed.** Il comando unico
      controlla worktree, ambiente, API, keystore e proprieta', mentre Gradle
      blocca direttamente una release priva di credenziali. Il fallback debug
      richiede `ONDA_ALLOW_DEBUG_RELEASE=1` ed e' escluso dalla pipeline di
      distribuzione. Package e impronta pubblica del certificato Onda sono ora
      fissati in `release/identity.json`; `npm run verify:signing` controlla
      anche una chiave ripristinata senza creare un APK.
      **Done:** un comando di distribuzione fallisce se manca il keystore, una sua
      proprietà o la configurazione API; il fallback debug resta disponibile solo
      con un flag locale esplicito e non può produrre un artefatto pubblicabile.

- [x] **Aggiungere uno splash Onda.** Il plugin ufficiale usa il marchio Onda
      sullo stesso sfondo scuro della UI, con risorse native normal/night e una
      correzione API-safe riproducibile nel prebuild. Verificato sulla release
      firmata Android 16 in tema chiaro/scuro, sul display del telefono e in una
      configurazione tablet virtuale; il dispositivo e' stato poi ripristinato.
      **Done:** splash scuro coordinato al brand, senza salto cromatico, verificato
      in release su tema chiaro/scuro e più form factor.

- [x] **Verificare repository e backup.** Account, copyright e remote sono
      allineati a `KairosIta`. Clone/bootstrap/prebuild puliti da GitHub sono
      provati al commit `c093ec7`; la chiave locale coincide con l'impronta
      pubblica attesa. La copia offline cifrata di keystore, properties e
      identità pubblica è stata decifrata, confrontata e verificata con
      `keytool`, poi il supporto è stato smontato e spento logicamente.
      **Done:** clone pulito riproducibile, restore provato e keystore recuperabile
      da backup offline.

### P1 — Affidabilità del prodotto

#### Riproduzione e rete

- [x] **Classificare gli errori stream senza consumare la coda.** Il budget di
      salti è ora per fallimenti _consecutivi_ e si ricarica su `IsPlayingChanged`
      (`playbackPolicy.ts`, cinque test); prima era per processo, quindi dopo tre
      salti sparsi la coda restava bloccata. Dal 10 settembre 2026 un errore
      di rete riprova da solo tre volte (2, 5 e 10 secondi,
      `NETWORK_RETRY_DELAYS_MS`) prima di lasciare l'avviso con Riprova; i
      tentativi si azzerano quando il player torna a suonare. **Verificato su
      device**: in modalità aereo tre skip di fila arrivano a un brano non
      precaricato, il logcat riporta `[player] network: Source error` e il
      player resta in buffering; tornata la rete entro il secondo tentativo
      il brano parte da solo, senza toccare Riprova. Nota per chi ripete la
      prova: un solo skip non basta, ExoPlayer precarica il brano seguente.
      **Done:** retry/backoff per rete, skip solo per stream definitivamente morto
      e test device togliendo la rete a metà brano.

- [x] **Richiedere il permesso notifiche al momento giusto.** Fatto il 10
      settembre 2026. La richiesta parte al primo play (`useQueue.playList`,
      `playerCommands.togglePlayback`), una volta per avvio; le regole stanno
      in `services/notificationPolicy` (testate), lo stato in
      `store/notificationPermission`, riletto a ogni ritorno in primo piano.
      Il player mostra «Notifiche disattivate: niente controlli nella
      schermata di blocco» con «Consenti» finché il sistema chiede ancora e
      «Impostazioni» quando è bloccato. **Verificato su Motorola Edge 50 Neo,
      Android 16**: permesso revocato via `pm revoke`, nessuna finestra
      all'avvio, finestra al play con la musica già partita; negato → avviso
      con Consenti; Consenti riapre la finestra; negato di nuovo → Android
      blocca e il tasto diventa Impostazioni, che apre la pagina dell'app;
      concesso da lì e tornati indietro l'avviso sparisce e la notifica media
      compare.

- [x] **Completare il collaudo della paginazione dopo un guasto parziale.**
      **Chiusa il 10 ottobre 2026.** Implementata il 9: il cursore e' per
      sorgente (`SourceCursor` in `services/sources/federation.ts`). Prima
      l'offset era uno solo e una sorgente caduta lo fermava per tutte: con
      Jamendo giu' a lungo ogni scroll richiedeva ad Audius la stessa pagina e
      l'elenco restava ai primi venti brani. Ora chi risponde avanza, chi cade
      richiede la sua stessa pagina alla volta dopo e, quando torna, riparte da
      dove era. Test deterministici con sorgenti finte: Jamendo giu' per sempre
      (Audius arriva in fondo), Jamendo giu' e poi di nuovo su (75 brani su 75,
      nessun doppione, ordine del catalogo), artista con una richiesta caduta.
      La migrazione 2 → 3 toglie dalla cache su disco gli elenchi salvati con
      l'offset unico. **Verificato su device il 10 ottobre 2026** (Motorola
      Edge 50 Neo, Android 16, build della PR #30 con un Client ID Jamendo
      volutamente sbagliato): l'avviso «Jamendo non risponde» compare e resta
      visibile, e lo scroll di «Di tendenza» va oltre i primi venti brani con
      le pagine di Audius. Il rientro di Jamendo dopo il guasto resta coperto
      dal test deterministico.
      **Done:** cursore per sorgente o retry reale dello stesso offset, nessun buco
      o duplicato, stato corrente del banner e test deterministico caduta/rientro.

#### Dati locali

- [x] **Versionare, validare e migrare MMKV.** Fatto il 10 settembre 2026.
      `services/storageSchema` (puro, quattro test) tiene la versione in
      `schema.version`: dati senza versione valgono 1, telefono vuoto parte
      alla corrente; prima di migrare ogni chiave nota va in `backup.*` e
      una migrazione che lancia ripristina tutto senza avanzare; una
      versione più nuova non si tocca; un valore illeggibile finisce in
      `quarantine.*` invece di sparire. Prima migrazione reale (1 → 2): il
      repeat numerico su disco diventa `off/one/all`. Test: da 1 a 2 con
      backup, idempotenza, dato troncato, versione più nuova, quarantena.
      **Verificato su device**: primo avvio della build con dati vecchi
      scrive `[storage] schema 1 → 2` nel logcat e libreria e cronologia
      restano intatte (2 preferiti, 86 recenti); al secondo avvio nessuna
      migrazione.

- [x] **Aggiungere export/import della libreria.** Fatto il 30 agosto 2026.
      `src/store/libraryExport.ts` costruisce e rilegge un JSON `onda.library`
      versionato (`EXPORT_VERSION = 1`, rifiuta versioni future); il merge e'
      additivo — unione di preferiti, playlist e cronologia, i metadati locali
      vincono sui brani gia' noti — e `previewImport` conta i delta reali, non
      il contenuto del file. Il trasporto sta in `src/services/libraryBackup.ts`
      (expo-file-system per scrivere e scegliere, expo-sharing per consegnare).
      Collaudato in release sul dispositivo: import di un file da
      `/sdcard/Download` con anteprima corretta, condivisione dell'export senza
      `FileUriExposedException` e reimport idempotente che dichiara «Il file non
      aggiunge niente: e' gia' tutto in libreria» con il pulsante disattivato.
      Le due permission di storage che `expo-file-system` dichiara nel proprio
      manifest restano fuori dal merged manifest grazie a `blockedPermissions`.
      Il round trip e' stato chiuso il 30 agosto 2026 su un export reale: il
      file riletto da `parseExport` conserva conteggi e integrita' referenziale,
      riesportarlo da' lo stesso stato e reimportarlo non aggiunge nulla.
      Sempre il 30 agosto e' stato aggiunto `saveLibrary`, che scrive nella
      cartella scelta con `Directory.pickDirectoryAsync` senza dipendenze nuove:
      prima l'unica uscita era la share sheet, e su un telefono senza gestore
      file ogni destinazione era un'app che portava la libreria fuori.
      La voce sopra, le migrazioni versionate dello schema, è chiusa il 10
      settembre 2026.

- [x] **Registrare una riproduzione reale, non una transizione.** La cronologia
      viene aggiornata appena cambia media item. Dal 9 settembre 2026 la
      posizione viene salvata e ripristinata (vedi «Ripresa dell'ascolto») e la
      striscia di Scopri si chiama «Ascoltati di recente», che è quello che
      mostra davvero. Dal 10 settembre 2026 la cronologia si aggiorna al
      tick di progresso quando si supera la soglia di `services/historyPolicy`
      (trenta secondi, o metà se il brano dura meno di un minuto), una volta
      per brano; il catalogo volatile viene avvisato subito al cambio di
      brano e di nuovo alla soglia, dal media item. **Verificato su device**:
      brano saltato dopo 8 s assente dai recenti, il seguente ascoltato 48 s
      in testa.
      **Done:** registrazione dopo una soglia di ascolto.

#### Navigazione e correttezza UI

- [x] **Validare tutte le route.** Fatto il 10 settembre 2026. `utils/routes`
      (testato) accetta solo `favorites`/`history` come raccolta e un id
      singolo non vuoto per artista e album; il resto mostra «Raccolta
      sconosciuta», «Artista/Album non indicato». Un URL che non corrisponde
      a nessuna route apre `app/+not-found.tsx` («Pagina non trovata», con
      «Torna a Scopri» via `router.navigate`, che non azzera lo stato dei
      tab) al posto della «Unmatched Route» di Expo. **Verificato su device**
      con `am start -d onda://collection/bogus`, `onda://artist/audius/%20`,
      `onda://album/jamendo/` e `onda://nothing/here`.

- [x] **Separare errori e contenuto vuoto per artista/album.** Fatto il 10
      settembre 2026. A lista vuota parla solo lo stato vuoto: con un errore
      di profilo o di lista mostra «Non sono riuscito a caricare
      l'artista/l'album» e un solo Riprova che rilancia ciò che è caduto;
      con dei brani a schermo gli errori si dicono in testa con `ErrorNotice`,
      ciascuno con il suo Riprova (anche `albumInfo`, prima muto).
      **Verificato su device** con id inesistenti su Audius e Jamendo.

- [x] **Paginare gli album Jamendo.** Risolto il 30 agosto 2026. `albumTracks`
      chiede pagine da 200 — il massimo che l'API accetta — finché non ne torna
      una corta, con un tetto di 10 pagine perché una risposta anomala non
      diventi un ciclo di richieste. La schermata album non passa più
      `limit: 100`: era quel parametro a troncare in silenzio. L'ordine si
      calcola su tutte le pagine insieme (`orderAlbum`) e non pagina per pagina,
      altrimenti la traccia 3 arrivata nella seconda richiesta finirebbe dopo la 200. Deduplica per id, perché con offset fisso una traccia rimossa fra due
      richieste fa ripresentare la successiva. Quattro test coprono 250 tracce su
      tre pagine, la sovrapposizione, le tracce senza stream e le posizioni
      mancanti. **Verificato sull'API vera** lo stesso giorno con l'album
      Jamendo 87675 («LISTEN UP ANTHOLOGY», 93 tracce): `dumpsys media_session`
      riporta `size=93` e la schermata Coda dichiara «92 brani dopo questo»
      nell'ordine del disco. Con il vecchio `limit: 100` un album da 93 passava
      per caso; oltre le 100 tracce veniva troncato senza dirlo.

- [x] **Formattare correttamente durate oltre un'ora.** Risolto il 30 agosto 2026. Il campo ore compare solo quando serve: `3:07` resta `3:07`, mentre
      `7525` diventa `2:05:25` e le due tracce del trending Audius passano da
      `61:51` e `70:01` a `1:01:51` e `1:10:01`. Oltre l'ora i minuti passano a
      due cifre, altrimenti `1:5:09` sarebbe ambiguo. Due test coprono il
      confine dei 3600 secondi, il troncamento dei decimali e `NaN`/infiniti.
      **Verificato a schermo** lo stesso giorno su Android 16: cercando «Enough
      Records Radio Show» la lista mostra `2:00:00` e `1:59:59` accanto a `28:04`
      e `6:19`, e il player del brano da due ore stampa `0:22` / `2:00:00` senza
      che nessuna riga vada a capo.

#### Accessibilità e layout

- [x] **Correggere la safe area della Coda.** Risolto il 30 agosto 2026. La
      coda è una modale sopra lo Stack e il `SafeAreaView` radice copre solo il
      bordo alto, quindi il fondo se lo paga da sé come già fa il player.
      L'inset va nel `contentContainerStyle` della lista e non sullo schermo:
      messo sullo schermo la lista smetterebbe di scorrere sotto la navigation
      bar e l'ultima riga resterebbe comunque irraggiungibile con la X di
      rimozione. **Verificato a schermo** lo stesso giorno su Android 16 con
      navigazione a tre pulsanti: in fondo a una coda da 93 brani l'ultima riga
      e la sua X restano interamente sopra la barra di sistema.

- [x] **Rendere il player responsivo.** Fatto il 10 settembre 2026.
      `services/playerLayout` (testato) ricava la misura della copertina da
      quel che resta dello schermo tolti insets, parte fissa e parte di
      testo scalata con `fontScale`; sotto i 160 dp la copertina resta al
      minimo e il pannello diventa scorrevole. Sul Motorola (427×949 dp)
      la copertina passa da 379 a 355 dp. **Verificato su device**: a
      360×640 dp (`wm size` + `wm density 160`) copertina da 160 dp e
      controlli e licenza raggiungibili scorrendo; a font scale 2.0 tutto
      entra senza scorrere. Restano 1.3 e 1.5, che stanno in mezzo.

- [x] **Alzare il contrasto dei metadati piccoli.** Fatto il 10 settembre
      2026: le sigle AUD/JAM usano `textMuted` pieno a 11 dp invece del 60% a
      10 dp. `#8B94A7` su `#0E1116` misura circa 6.2:1 (prima 3.0:1) e resta
      sopra 4.5:1 anche su `surface`. Verificato a schermo che le sigle si
      leggono nelle righe di Cerca.

### P2 — Qualità e manutenzione

#### Prestazioni e rete

- [x] Tetto di 500 voci sul catalogo volatile `session`, con sfratto del più
      vecchio e reinserimento in coda a ogni accesso in scrittura: prima cresceva
      per tutta la vita del processo. Sfrattare è sicuro perché ciò che l'utente
      salva sta anche in `state.tracks`, dove `resolve` ricade.

#### Test e toolchain

- [x] CI Ubuntu/Windows con `npm ci`, test, typecheck, ESLint, Prettier, Expo
      Doctor e prebuild; workflow manuale separato per la build personale
      completa. Lo smoke live resta locale perché usa un Client ID personale.

- [x] Comando release riproducibile collaudato end-to-end: imposta l'ambiente,
      rifiuta un worktree sporco, esegue prebuild/build/firma/verifica e archivia
      APK, mapping R8 e manifest con hash, certificato, ABI e commit.

- [x] Patch RNTP e `patch-package` rimossi dal repository pubblico. L'apertura
      diretta dal tap resta sospesa finché esiste un'API pubblica o
      un'autorizzazione del fornitore.

- [x] Advisory npm transitivi risolti con aggiornamenti Expo compatibili e
      override Metro 0.84.5 verificato da Expo Doctor e build, senza
      `audit fix --force`; `npm audit` riporta zero vulnerabilità.

- [x] Svuotare la cache di Metro prima del bundle nella build personale e in
      quella di release. La cache delle trasformazioni (`metro-cache` in
      `os.tmpdir()`) conserva i valori `EXPO_PUBLIC_*` già scritti nel codice:
      chi corregge il Client ID Jamendo in `.env` e ricompila può ritrovarsi
      nell'APK quello vecchio, senza nessun avviso. Confermato il 10 ottobre
      2026 su una build reale (registro dei collaudi).
      **Done:** gli script svuotano la cache, o passano `--reset-cache`, prima
      del bundle, e una build dopo un cambio di `.env` porta il valore nuovo.
      **Chiusa il 10 ottobre 2026**, senza svuotare la cache:
      `metro.config.js` estende la configurazione di Expo e mette in
      `cacheVersion` un'impronta dei valori `EXPO_PUBLIC_*`
      (`scripts/metro-cache-version.cjs`, quattro test). La cache si rinnova
      solo quando quei valori cambiano e la cartella condivisa con gli altri
      progetti resta intatta. Riprodotto prima con due `expo export` di fila,
      il secondo con il valore del primo, e verificato dopo sulla pipeline
      vera (baseline del 10 ottobre).

#### Esperienza e identità

- [x] Correggere apostrofi ASCII e copy italiano (`e'`, `piu'`, `Modalita'`),
      uniformando tono e plurali. Fatto il 10 settembre 2026 per tutto il
      testo visibile ed etichette di accessibilità (uno scanner delle
      stringhe non trova più accenti ASCII); i commenti nel codice restano
      ASCII di proposito.

- [x] Sostituire il toast da 550 ms con snackbar accessibile da 2–4 secondi.
      Fatto il 10 settembre 2026: il menu contestuale chiude subito e
      riferisce l'esito a `TrackList`, che mostra la `Snackbar` da quattro
      secondi sopra il mini-player con un'azione utile («Coda» per gli
      accodamenti, «Annulla» per i preferiti, «Apri» per le playlist).
      **Verificato su device**: «Accodata · Coda» apre la Coda con il brano
      in fondo.

- [x] Aggiungere undo o conferma per “Svuota i successivi”. Snackbar da
      quattro secondi con Annulla (`components/Snackbar.tsx`), annunciata a
      TalkBack; **verificata su device il 9 settembre 2026** (Annulla rimette
      i 19 brani). Il toast del menu contestuale è sostituito, vedi sopra.

### Checklist device

- [x] Permesso notifiche: concedi, nega, nega definitivamente e riabilita da
      Impostazioni. Verificato il 10 settembre 2026, vedi P1.
- [x] Upgrade `adb install -r` fra release con stessa firma e dati conservati.
- [x] Sprint «continuità» del 9 settembre 2026. Ripresa con `am force-stop`,
      togliendo l'app dai recenti e dopo un riavvio del telefono: verificato
      il 10 settembre 2026, vedi la baseline. Il traffico nullo prima del play
      è misurato, non dedotto.

---

## Completato e da non regredire

- [x] Dipendenze allineate a Expo SDK 57 e versioni riproducibili con lockfile.
- [x] Migrazione dal vecchio `react-native-track-player` a `@rntp/player` 5.8.
- [x] Icona Onda legacy/adaptive/monochrome al posto dell'icona predefinita.
- [x] Firma e shrinking release conservati in un config plugin rigenerabile.
- [x] Modello unificato `Track`, UID `source:id` e registro delle sorgenti.
- [x] Caduta totale della federazione distinta dalla fine del catalogo.
- [x] Errori Android di rete ridotti a messaggi leggibili e deduplicati.
- [x] Entità HTML Jamendo decodificate in un solo punto.
- [x] Tracce Audius gated/non riproducibili filtrate prima della UI.
- [x] Artwork lista/player separati nel modello.
- [x] Error boundary radice con retry del render e stack solo in debug.
- [x] Licenza MIT per codice/documentazione e separazione esplicita dei
      contenuti e marchi di terze parti.
