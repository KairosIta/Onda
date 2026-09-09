# Roadmap di Onda

Stato aggiornato il **9 settembre 2026** confrontando codice, configurazione e
documentazione con le prove già raccolte su device e con i controlli automatici,
di release e da clone pulito.

Nota per il repository pubblico: l'apertura diretta del player dal tap sulla
notifica va ripristinata soltanto tramite un'API pubblica RNTP o una modifica
esplicitamente autorizzata dal fornitore; Onda non distribuisce più una patch
del sorgente RNTP.

Questa non è una lista di idee generica: descrive ciò che Onda offre oggi e
il lavoro necessario per mantenere pubblico il sorgente e, separatamente,
arrivare a un'eventuale release binaria affidabile.

## Come leggere questa roadmap

- **P0** — blocca una distribuzione pubblica o la sua riproducibilità;
- **P1** — protegge riproduzione, dati, accessibilità e fiducia dell'utente;
- **P2** — migliora qualità, prestazioni e manutenzione;
- **P3** — introduce nuove capacità di prodotto.

Stati usati:

- `[x]` completato e verificato con la prova indicata;
- `[ ]` da fare;
- **Implementato, da collaudare** significa che il codice esiste, ma manca
  ancora una prova proporzionata al rischio su una build reale.

Una voce si chiude soltanto quando è soddisfatto il relativo **Done**.

---

## Cosa offre Onda oggi

### Scoperta e navigazione

- [x] Catalogo federato Audius + Jamendo, alternato invece che concatenato.
- [x] Trending, 13 filtri per genere e scroll infinito.
- [x] Ricerca federata con debounce e paginazione.
- [x] Risultati parziali se cade una sola sorgente; errore recuperabile con
      **Riprova** se cadono entrambe.
- [x] Pagine artista su Audius e Jamendo, con biografia/dettagli quando
      disponibili.
- [x] Pagine album Jamendo con ordine delle tracce; Audius non espone album
      navigabili in modo abbastanza affidabile per mostrarli.
- [ ] Home a sezioni: ascolti recenti, «In ascesa questa settimana» (trending
      settimanale Audius più `popularity_week` Jamendo), «Voci nuove» (trending
      underground Audius più ultime uscite Jamendo), griglia dei generi con
      una pagina per genere e il trending federato sotto. **Implementato il 9
      settembre 2026, da collaudare**: le vetrine sono `TrackStrip`, una sola
      componente; le sorgenti dichiarano `spotlight` come funzione opzionale
      e la federazione salta chi non ce l'ha. I chip dei generi sono stati
      sostituiti dalla griglia: la pagina genere usa la stessa chiave di
      cache dei vecchi chip.
- [ ] Ricerca di artisti e album oltre ai brani, con le ultime otto ricerche
      da rifare con un tocco. **Implementato il 9 settembre 2026, da
      collaudare**: `/users/search` su Audius, `/artists` e `/albums` con
      `namesearch` su Jamendo; Audius non cerca album e la vetrina resta
      solo Jamendo senza avvisi. Le ricerche si ricordano solo quando hanno
      trovato qualcosa (`utils/recentQueries`, tre test).
- [ ] Apertura senza attese: trending, pagine artista e album consultate di
      recente tornano da disco prima del primo render e si rinfrescano in
      background. **Implementato il 9 settembre 2026, da collaudare**: la cache
      di React Query si disidrata su MMKV (`src/services/queryClient.ts`),
      potata alle trenta query più fresche, due pagine per elenco e tre giorni
      (`queryPersistenceSchema.ts`, quattro test); la ricerca resta fuori. Al
      ritorno in primo piano le query scadute si rinfrescano da sole.

### Riproduzione

- [x] Player nativo Android con play/pausa, seek, precedente e successivo.
- [x] Riproduzione in background, media session, notifica, lock screen e
      comandi media.
- [x] Coda unica fra le sorgenti: riproduci elenco, riproduci dopo, accoda,
      passa a una traccia, rimuovi e svuota i successivi.
- [x] Repeat off/traccia/coda persistito.
- [x] Shuffle nativo sulla coda corrente. **Collaudato il 30 agosto 2026** su
      Android 16: il toggle attiva davvero l'ordine casuale — dopo _Peak_ il
      player è passato all'indice 8, non all'1 — la traccia corrente resta al suo
      posto e la preferenza sopravvive a `force-stop`.
      La schermata **In coda** mentiva: mostrava l'ordine della timeline
      dichiarando «31 brani dopo questo» e attenuando 8 brani come già ascoltati
      quando ne era stato riprodotto uno solo, cioè inventando una cronologia mai
      avvenuta. Chiuso lo stesso giorno con la seconda alternativa del criterio:
      mostrare l'ordine vero non è possibile, perché RNTP tiene la permutazione
      in un `playOrder` privato e non espone alcun accessore su nessun backend —
      `isShuffleEnabled` dice soltanto se è attivo. Quindi la schermata lo
      dichiara: sottotitolo «N brani in coda · ordine casuale», riga in accento
      «L'elenco è l'ordine originale: il prossimo brano non è quello sotto»,
      nessuna attenuazione delle righe sopra quella attiva, e l'azione passa da
      «Svuota i successivi» a «Svuota da qui in giù», che è quello che fa davvero
      quando l'ordine di ascolto è ignoto. La decisione sta in `describeQueue`
      (`src/utils/queueSummary.ts`), modulo puro con cinque test.
      **Verificato a schermo** sullo stesso brano attivo (_БЛЮЗ_, indice 2 di
      93): con lo shuffle le due righe sopra restano a piena luminosità e compare
      l'avvertenza; senza, tornano attenuate e il sottotitolo dice «90 brani dopo
      questo».
      Nota: il pulsante **Casuale** delle raccolte è un meccanismo diverso —
      mescola l'array prima di caricarlo, quindi la coda canonica è già l'ordine
      di ascolto e lì non c'era niente da correggere. I commenti in
      `src/store/playback.ts` e `src/utils/shuffle.ts` che dichiaravano «RNTP non
      ha uno shuffle nativo» erano rimasti indietro e sono stati riscritti.
- [x] Timer di spegnimento nativo da 15 a 90 minuti. **Collaudato il 30 agosto
      2026** su Android 16 in Doze profondo (`deviceidle force-idle`, batteria
      simulata scollegata, schermo spento): armato alle 11:36:19 su 15 minuti, un
      campionamento ogni 30 secondi ha visto `PLAYING` con `doze=IDLE` per
      ventinove volte di fila e `PAUSED` alle 11:51:19, cioè a 15:00 esatti. La
      pausa è nativa e Doze non la sposta. Al risveglio il player era coerente:
      luna tornata inattiva e nessuna etichetta «Pausa tra N min» residua.
      L'unica cosa non osservabile è la coerenza della UI _durante_ Doze, perché
      `endsAt` lo azzera un `setTimeout` JS che il sistema differisce: a schermo
      spento però non c'è UI da leggere, e al risveglio i timer vengono smaltiti
      prima che la schermata torni visibile.
- [x] Apertura del player dal tap sulla notifica tramite normalizzazione dei
      deep link `trackplayer://` e `onda://`.
- [ ] Ripresa dell'ascolto all'avvio: coda e posizione nel brano sopravvivono
      alla chiusura dell'app e il mini-player riparte da dove era, in pausa,
      senza aprire lo stream né mostrare la notifica finché non si preme play.
      **Implementato il 9 settembre 2026, da collaudare**: la coda si fotografa
      su MMKV a ogni transizione e cambio coda, anche dal gestore headless, in
      una finestra di 200 brani intorno a quello attivo; la posizione arriva dal
      timer nativo `progressSync` di RNTP ogni cinque secondi e alla pausa, più
      un salvataggio all'uscita dall'app. All'avvio la coda resta «in attesa»
      (`src/store/session.ts`) e il player nativo la riceve al primo play, skip,
      accodamento o apertura della Coda. Nove test coprono finestra,
      validazione, scadenza a trenta giorni e la regola dei titoli di coda.
- [ ] Stato di riproduzione unico e visibile: spinner nel tasto play durante il
      caricamento, porzione bufferizzata sulla barra del mini-player e dietro lo
      slider del player, avviso con **Riprova** quando il brano non risponde.
      **Implementato il 9 settembre 2026, da collaudare**: la tabella sta in
      `src/services/playbackStatus.ts` (tre test) e i comandi di trasporto
      passano da `playerCommands.ts`, che sa cosa vuol dire play in ogni stato.
- [ ] Coda riordinabile trascinando la maniglia a destra di ogni riga, con le
      stesse mosse come azioni TalkBack (Sposta su, Sposta giù, Togli), e
      «Svuota da qui in giù» con **Annulla** per quattro secondi.
      **Implementato il 9 settembre 2026, da collaudare**: righe ad altezza
      fissa e geometria in `utils/reorder.ts` (due test, gira come worklet);
      lo scroll della lista si spegne mentre una riga è in mano;
      `moveMediaItem` di RNTP fa lo spostamento e l'annullamento rimette i
      brani dopo quello che suona in quel momento. Manca lo scorrimento
      automatico ai bordi: una coda più lunga dello schermo si riordina in
      più passaggi.
- [ ] Riga «Prossimo» nel player, sotto i controlli: il brano che viene dopo,
      oppure «ordine casuale», «questo brano, di nuovo» o «fine della coda».
      **Implementato il 9 settembre 2026, da collaudare**: la regola sta in
      `utils/upNext.ts` (due test) e la riga apre la Coda.
- [ ] Android Auto: preferiti, playlist e ascolti recenti come cartelle
      sfogliabili dal display dell'auto. **Implementato il 9 settembre 2026, da
      collaudare**: l'albero lo costruisce `services/browseTree.ts` dalla
      libreria persistita (due test) e `browseTreeSync` lo rimanda a RNTP a
      ogni mutazione; `plugins/with-android-auto.js` aggiunge al manifest il
      descrittore `automotive_app_desc`, il servizio media lo dichiara già
      RNTP. Senza `extras` nelle voci, per tenere leggero il passaggio nativo:
      cronologia e cuoricino risolvono l'uid dalla libreria. Nessuna prova
      con un'unità o con il Desktop Head Unit.

### Libreria locale

- [x] Preferiti, cronologia e playlist persistiti con MMKV.
- [x] Creazione, rinomina ed eliminazione playlist.
- [x] Aggiunta/rimozione brani e riordino accessibile tramite frecce.
- [x] Riproduzione e shuffle di preferiti, cronologia, playlist, artisti e
      album.
- [x] Export/import della libreria in JSON versionato, con anteprima dei
      delta e merge additivo. Il salvataggio usa il selettore di cartelle di
      sistema e non fa uscire il file dal telefono; la condivisione resta
      disponibile come seconda strada, dichiarata.
- [ ] Le migrazioni versionate dello schema MMKV non sono ancora disponibili.

### Progetto e distribuzione

- [x] Android, tema scuro, icona legacy/adaptive/monochrome e UI edge-to-edge.
- [x] Expo SDK 57, React Native 0.86, TypeScript 6 e `@rntp/player` 5.8.
- [x] Codice e documentazione sotto licenza MIT; contenuti, marchi e
      credenziali esclusi in `THIRD_PARTY_CONTENT.md`.
- [x] Build release minificata e firmabile tramite config plugin.
- [x] Modello source-only: nessun APK/AAB pubblico e nessuna pubblicazione su
      store.
- [x] Splash e privacy policy in-app sono implementati e verificati.
- [x] Workflow CI Ubuntu/Windows e build personale manuale configurati; la prima
      esecuzione remota avverrà dopo il push del repository.
- [ ] Font di brand Manrope incorporato nel pacchetto nativo, copertine con
      dissolvenza e cache, feedback tattile di sistema, bottoni che si
      ritraggono, sagome di caricamento e chiusura del player col
      trascinamento. **Implementato il 9 settembre 2026, da collaudare**: il
      codice passa test, typecheck, lint e prebuild, ma nessuna build reale è
      stata ancora provata; le verifiche sono nella checklist device.

### Limiti dichiarati

- solo Android e build nativa personale; Expo Go non è supportato;
- Jamendo richiede un Client ID personale;
- nessun account utente, sincronizzazione cloud o backend Onda;
- nessun ascolto offline;
- cronologia locale registrata al cambio traccia, non dopo ascolto effettivo;
- attribuzione e provenienza sono visibili, ma la distribuzione federata resta
  bloccata dalle conferme dei fornitori descritte nella nota di conformità.

---

## Baseline verificata

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
- [ ] Eseguire su GitHub Actions la build manuale completa `windows-latest`
      dopo il primo push pubblico.

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

## P0 — Prima di una release binaria ufficiale

- [ ] **Chiudere il gate legale e di attribuzione.** La MIT copre il codice,
      non i cataloghi. La nota di conformità versionata registra fonti,
      attribuzioni implementate, profilo non commerciale e richieste pronte per
      i fornitori. La build federata resta bloccata: Jamendo deve autorizzare il
      Client ID in un APK pubblico o un'architettura alternativa; per Audius va
      archiviata una copia leggibile degli API Terms e confermata la
      rappresentazione dei valori di attribuzione mancanti.
      **Done:** nota di conformità versionata, privacy policy, nome della sorgente,
      backlink originale e licenza/restrizione di ogni brano visibili; piano e
      quota Jamendo confermati; decisione documentata su Client ID/proxy per una
      distribuzione pubblica.

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

- [ ] **Definire privacy e backup Android.** La libreria è locale, ma una
      release Android può includere MMKV nel backup di sistema. Backup disabilitato
      nel manifest, esclusioni complete cloud/D2D, policy v1.0 e schermata in-app
      sono implementati. La release su Android 16 risponde `Backup is not allowed`;
      backup e restore negativi sono provati anche su AVD Android 11. Resta un
      trasferimento D2D reale su Android 12+, che richiede due dispositivi e può
      variare fra produttori.
      **Done:** scegliere backup disabilitato, esclusioni MMKV o backup cifrato;
      configurare il manifest, pubblicare una privacy policy coerente e provare il
      restore su Android 11 e Android 12+.

---

## P1 — Affidabilità del prodotto

### Riproduzione e rete

- [ ] **Unificare gli stati del player e gestire tutte le promise RNTP.** Dal
      9 settembre 2026 lo stato è uno solo (idle, buffering, playing, paused,
      ended, error), ricavato in `src/services/playbackStatus.ts` e usato da
      entrambi i tasti play: il caricamento mostra uno spinner, l'errore un
      avviso con Riprova (`retry()` seguito da play) e la coda finita riparte
      dal brano corrente. Restano i comandi serializzati o disabilitati quando
      serve e la verifica delle rejection nei log.
      **Done:** comandi serializzati o disabilitati quando necessario e zero
      rejection non gestite nei log, provati su device.

- [ ] **Rendere recuperabile il setup del player.** Un errore iniziale mostra
      un banner ma non offre una nuova inizializzazione.
      **Done:** azione Riprova, controlli disabilitati finché il player non è
      pronto e diagnostica tecnica copiabile.

- [ ] **Classificare gli errori stream senza consumare la coda.** Il budget di
      salti è ora per fallimenti _consecutivi_ e si ricarica su `IsPlayingChanged`
      (`playbackPolicy.ts`, cinque test); prima era per processo, quindi dopo tre
      salti sparsi la coda restava bloccata. Restano il retry/backoff per gli
      errori di rete e il collaudo su device.
      **Done:** retry/backoff per rete, skip solo per stream definitivamente morto
      e test device togliendo la rete a metà brano.

- [ ] **Completare il collaudo della paginazione dopo un guasto parziale.** Il
      worktree locale riprova lo stesso offset, deduplica le tracce e mostra
      soltanto gli errori dell'ultimo tentativo; il cursore ha un test unitario.
      **Done:** cursore per sorgente o retry reale dello stesso offset, nessun buco
      o duplicato, stato corrente del banner e test deterministico caduta/rientro.

- [ ] **Richiedere il permesso notifiche al momento giusto.** Android 13+ lo
      chiede oggi all'avvio e l'esito viene ignorato.
      **Done:** richiesta contestuale al primo play, spiegazione dello stato
      negato, collegamento alle impostazioni e test concedi/nega/nega per sempre.

### Dati locali

- [ ] **Versionare, validare e migrare MMKV.** Il worktree locale valida tracce,
      riferimenti, playlist e preferenze prima di popolare gli store e migra i
      vecchi repeat numerici; mancano ancora versione esplicita e recupero sicuro.
      **Done:** schema, migrazioni idempotenti, quarantena del dato invalido,
      backup pre-migrazione e test con versioni vecchie/dati troncati.

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
      Resta da fare, ma e' la voce sopra: migrazioni versionate dello schema.

- [ ] **Registrare una riproduzione reale, non una transizione.** La cronologia
      viene aggiornata appena cambia media item. Dal 9 settembre 2026 la
      posizione viene salvata e ripristinata (vedi «Ripresa dell'ascolto») e la
      striscia di Scopri si chiama «Ascoltati di recente», che è quello che
      mostra davvero. Resta la soglia di ascolto prima di registrare.
      **Done:** registrazione dopo una soglia di ascolto.

- [ ] **Risoluzione fresca degli stream Jamendo salvati.** Preferiti e
      playlist persistono l'URL audio ricevuto dall'API, che può diventare obsoleto.
      Priorità abbassata il 30 agosto 2026: il parametro `from` nell'URL Jamendo
      non è una credenziale a scadenza. Provate quattro varianti sullo stesso
      brano — token valido, token assente, token manomesso e token di un altro
      brano — e tutte hanno risposto `206 audio/mpeg`. Il rischio residuo è che
      cambi l'host o sparisca il brano, non che il link scada.
      **Done:** risoluzione al play da `source + id`, cache con scadenza e test su
      elementi salvati da tempo.

### Navigazione e correttezza UI

- [ ] **Validare tutte le route.** `sourceById` rispetta `enabled` dal 30 agosto
      2026 e rifiuta una sorgente disabilitata; resta aperto il `kind`
      sconosciuto, che apre i Preferiti invece di mostrare Not Found.
      **Done:** rifiuto esplicito di source/kind/id non ammessi, con test deep
      link.

- [ ] **Separare errori e contenuto vuoto per artista/album.** Alcuni errori
      vengono mostrati insieme a “Nessun brano” o “Album vuoto”; mancano retry
      mirati e l'errore di `albumInfo` non è presentato.
      **Done:** stati loading/error/empty/data mutuamente esclusivi e Riprova per
      profilo e lista.

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

### Accessibilità e layout

- [x] **Correggere la safe area della Coda.** Risolto il 30 agosto 2026. La
      coda è una modale sopra lo Stack e il `SafeAreaView` radice copre solo il
      bordo alto, quindi il fondo se lo paga da sé come già fa il player.
      L'inset va nel `contentContainerStyle` della lista e non sullo schermo:
      messo sullo schermo la lista smetterebbe di scorrere sotto la navigation
      bar e l'ultima riga resterebbe comunque irraggiungibile con la X di
      rimozione. **Verificato a schermo** lo stesso giorno su Android 16 con
      navigazione a tre pulsanti: in fondo a una coda da 93 brani l'ultima riga
      e la sua X restano interamente sopra la barra di sistema.

- [ ] **Rendere il player responsivo.** Artwork quadrata e layout fisso non
      scrollabile possono spingere controlli/licenza fuori schermo. Confermato il
      30 agosto 2026: il titolo su due righe «Cold Play - Yellow (Oliverio Luján
      Edit)» sposta in basso di circa 105 px l'intera riga dei controlli.
      **Done:** max artwork, layout adattivo o scroll controllato, test 360×640 dp
      e font scale 1.0/1.3/1.5/2.0.

- [ ] **Portare target tattili e focus ad almeno 48×48 dp.** Molti controlli
      usano solo `hitSlop`, che non garantisce un focus TalkBack adeguato.
      **Done:** wrapper non sovrapposti, Accessibility Scanner e Switch Access.

- [ ] **Completare la semantica TalkBack.** Icone decorative, repeat,
      preferito/attivo, durata, heading, toast ed errori non hanno ancora una
      semantica completa.
      **Done:** label/state/hint/live region e percorso manuale a occhi chiusi.

- [ ] **Alzare il contrasto dei metadati piccoli.** Le sigle AUD/JAM a 60% di
      `textMuted` misurano circa 2.99:1.
      **Done:** almeno 4.5:1 per testo piccolo e 3:1 per componenti/focus.

---

## P2 — Qualità e manutenzione

### Prestazioni e rete

- [ ] Condividere un solo observer di progresso, non interrogare il bridge
      senza traccia e usare frequenze diverse per mini-player e player aperto.
      **Implementato il 9 settembre 2026, da collaudare**: `src/store/progress.ts`
      tiene un solo timer per tutta l'app, a 500 ms in riproduzione e 2 s in
      pausa, fermo senza brano, senza lettori o con l'app in background
      (`progressPolicy.ts`, un test); mini-player e player leggono da lì.
- [x] Tetto di 500 voci sul catalogo volatile `session`, con sfratto del più
      vecchio e reinserimento in coda a ogni accesso in scrittura: prima cresceva
      per tutta la vita del processo. Sfrattare è sicuro perché ciò che l'utente
      salva sta anche in `state.tracks`, dove `resolve` ricade.
- [ ] Usare thumbnail nei mini-player e nella Coda invece dell'artwork grande
      destinato a lock screen e player.
- [ ] Aggiungere timeout e `AbortSignal` fino agli adapter; le ricerche
      superate continuano oggi a consumare rete e quota.
- [ ] Definire retry/backoff per 429 e 5xx. Jamendo ritenta tre volte ogni
      risposta vuota e React Query può moltiplicare ulteriormente le chiamate.
- [ ] Collegare React Query ad AppState/stato rete e aggiungere
      pull-to-refresh con una policy esplicita per trending e cache. AppState è
      collegato dal 9 settembre 2026 (`focusManager` in `queryClient.ts`) e la
      cache è persistita; restano lo stato rete e il pull-to-refresh.
- [ ] Misurare in release cold/warm start, PSS/RSS, frame lenti, rete e
      batteria per 60 minuti.

### Test e toolchain

- [ ] Estendere i test unitari a mutazioni degli store, `formatTime`, shuffle e
      migrazioni complete. Coperti oggi (87 test): validazione, repeat, cursore
      federato, composizione della federazione (anche di artisti e album),
      entità HTML Jamendo, budget di salti, export/import, riepilogo della
      coda, sessione di ascolto, stato del player, politica di lettura del
      progresso, potatura della cache, ricerche recenti, geometria del
      riordino, prossimo brano e albero per Android Auto.
- [ ] Portare nel repository test deterministici della federazione con fetch
      mockato; la composizione e la propagazione degli errori sono già coperte da
      `federation.ts`, manca il livello fetch. Lo smoke live resta separato perché
      dipende da servizi esterni.
- [x] CI Ubuntu/Windows con `npm ci`, test, typecheck, ESLint, Prettier, Expo
      Doctor e prebuild; workflow manuale separato per la build personale
      completa. Lo smoke live resta locale perché usa un Client ID personale.
- [ ] Rimuovere l'esclusione Android Lint per Worklets/Reanimated quando la
      combinazione Expo/AGP correggerà il crash interno KaModule/VirtualFile;
      fino ad allora `npm run android:lint` controlla l'app e le altre dipendenze
      senza nascondere l'eccezione.
- [ ] Archiviare APK/AAB, SHA-256, mapping R8, sourcemap Hermes, dipendenze e
      commit sorgente come un unico artefatto di release.
- [x] Comando release riproducibile collaudato end-to-end: imposta l'ambiente,
      rifiuta un worktree sporco, esegue prebuild/build/firma/verifica e archivia
      APK, mapping R8 e manifest con hash, certificato, ABI e commit.
- [x] Patch RNTP e `patch-package` rimossi dal repository pubblico. L'apertura
      diretta dal tap resta sospesa finché esiste un'API pubblica o
      un'autorizzazione del fornitore.
- [x] Advisory npm transitivi risolti con aggiornamenti Expo compatibili e
      override Metro 0.84.5 verificato da Expo Doctor e build, senza
      `audit fix --force`; `npm audit` riporta zero vulnerabilità.
- [ ] Verificare il manifest release e bloccare eventuali permessi transitivi
      non necessari.

### Esperienza e identità

- [ ] Scegliere consapevolmente font di sistema o tipografia di brand, con
      scaling e fallback accessibili. **Implementato il 9 settembre 2026, da
      collaudare**: Manrope (SIL OFL 1.1, `assets/fonts/`) in quattro pesi
      500/600/700/800, incorporata come famiglia XML Android dal config plugin
      di expo-font e usata soltanto tramite i token `type.*` di
      `src/theme.ts`, tab bar compresa. Il font segue la scala di sistema e,
      se il file mancasse, Android ricadrebbe da solo sul font predefinito.
      Durate e tempi usano cifre tabulari (`type.tabular`). Il prebuild
      genera `res/font/xml_manrope.xml` con i quattro pesi e la registrazione
      in `MainApplication.kt`. Resta la prova su dispositivo a font scale
      1.0/1.3/1.5/2.0.
- [ ] Correggere apostrofi ASCII e copy italiano (`e'`, `piu'`, `Modalita'`),
      uniformando tono e plurali.
- [ ] Aggiungere pressed/ripple, loading e feedback non solo cromatico a ogni
      azione. **Implementato il 9 settembre 2026, da collaudare**:
      `PressableScale` ritrae bottoni, chip, schede e icone con una molla
      condivisa (`motion.press`, due scale: piena e da icona) e rispetta
      «Rimuovi animazioni»; le righe di lista tengono l'evidenziazione di
      sfondo, che su Android è la convenzione giusta. Il feedback tattile passa
      da `src/services/haptics.ts`, che usa le costanti di sistema e quindi
      l'impostazione «Vibrazione al tocco», con una regola per azione: `tap`
      su avvio brano e bottoni, `toggle` su preferito/shuffle/ripetizione/
      riordino, `longPress` sul menu contestuale, `success` su accodamenti,
      creazioni e salvataggi riusciti, `reject` su rimozioni ed eliminazioni,
      `gestureEnd` sulla chiusura del player; niente vibrazione ad aprire o
      chiudere schermate e finestre. Il player si chiude trascinandolo verso
      il basso (route `transparentModal`, scrim che si schiarisce, molla senza
      rimbalzo), la copertina si ritrae in pausa e il mini-player entra ed
      esce in dissolvenza con una barra di avanzamento continua. Restano il
      collaudo su dispositivo e con TalkBack, e due rilievi della revisione
      rimandati perché senza correzione sicura senza prova: la tab bar si
      riposiziona di colpo mentre il mini-player sfuma in uscita, e durante
      il trascinamento la fascia della status bar non è coperta dallo scrim.
- [ ] Sostituire il toast da 550 ms con snackbar accessibile da 2–4 secondi.
- [ ] Aggiungere undo o conferma per “Svuota i successivi”. **Implementato il
      9 settembre 2026, da collaudare**: snackbar da quattro secondi con
      Annulla (`components/Snackbar.tsx`), annunciata a TalkBack. Il toast da
      550 ms del menu contestuale resta da sostituire.
- [ ] Migliorare placeholder, errori artwork, skeleton e messaggi distinti per
      offline, quota, vuoto e contenuto non riproducibile. **Implementato il 9
      settembre 2026, da collaudare** per placeholder, errori artwork e
      skeleton: ogni copertina passa da `src/components/Artwork.tsx`
      (expo-image) con dissolvenza breve, cache memory-disk, `recyclingKey`
      nelle liste, dissolvenza spenta nelle righe riciclate e una nota
      musicale su fondo neutro quando l'artwork manca o l'URL è rotto.
      `TrackListSkeleton` e `CollectionSkeleton` sostituiscono le rotelle in
      Scopri, Cerca, artista e album, ricalcano la geometria delle righe e
      delle intestazioni vere e sono annunciate a TalkBack come un solo
      «Caricamento in corso». Restano i messaggi distinti per offline, quota,
      vuoto e contenuto non riproducibile.
- [ ] Completare Impostazioni/Informazioni: versione, sorgenti, privacy, licenze
      e collegamenti ufficiali sono presenti; restano diagnostica ed export.
- [ ] Documentare qualità e consumo dati oppure offrire una modalità risparmio
      dati compatibile con le sorgenti.

---

## Checklist device ancora aperta

- [ ] Shuffle attivato/disattivato durante una coda: traccia e posizione
      correnti restano stabili e la schermata Coda si aggiorna.
- [ ] Timer da 90 minuti sotto Doze e timer mentre il player è in pausa.
- [ ] Percorso completo con TalkBack: tab, righe, menu, slider, modali,
      playlist, toast ed errori.
- [ ] Font scale 1.0/1.3/1.5/2.0 e display size piccolo/grande.
- [ ] Schermo 360×640 dp, gesture navigation e three-button navigation.
- [ ] Permesso notifiche: concedi, nega, nega definitivamente e riabilita da
      Impostazioni.
- [ ] Rete rimossa a metà brano, rete lenta, captive portal, cambio Wi-Fi/5G e
      singola sorgente che cade durante la terza pagina.
- [ ] Chiamata in arrivo, audio focus di un'altra app, cuffie scollegate,
      Bluetooth e Android Auto.
- [ ] Un'ora di riproduzione: batteria, temperatura, memoria, coda da 100 e
      scroll di almeno 1000 risultati.
- [ ] Release minificata: ricerca, player, notifica, background, deep link,
      preferiti, playlist e persistenza dopo `am force-stop`.
- [x] Upgrade `adb install -r` fra release con stessa firma e dati conservati.
- [ ] Splash standalone su più dispositivi reali e themed icon su più maschere;
      telefono Android 16 e form factor tablet virtuale sono già verificati.
- [ ] Sprint «sensazione» del 9 settembre 2026, mai provato su una build
      reale. Font: Manrope visibile ovunque, tab bar compresa (se compare
      Roboto la famiglia XML non è nel pacchetto: rifare il prebuild); cifre
      tabulari nelle durate; font scale 1.3 e 2.0.
- [ ] Player: il trascinamento verso il basso chiude oltre 120 dp o con uno
      strappo, sotto la soglia torna su senza superare il bordo; lo slider
      non muove il foglio; sotto il foglio si vede la schermata precedente
      scurita; chevron e tasto back chiudono senza fasce scure; apertura
      dalla notifica ad app chiusa; copertina a 0,92 in pausa; attribuzione
      visibile su 360×640 dp.
- [ ] Sprint «continuità» del 9 settembre 2026, mai provato su una build
      reale. Ripresa: riprodurre, mettere in pausa a metà brano, chiudere con
      `am force-stop`, riaprire: mini-player presente con lo stesso brano, nessuna
      notifica e nessun traffico di rete finché non si preme play; al play
      riparte dalla posizione salvata (tolleranza cinque secondi) e la Coda
      mostra l'elenco intero. Stessa prova togliendo l'app dai recenti mentre
      suona e dopo un riavvio del telefono.
- [ ] Coda in attesa: trascinare lo slider e poi premere play; skip avanti dal
      mini-player; «Riproduci dopo» e «Accoda» dal menu di un brano; apertura
      della Coda dal player. In ogni caso il mini-player non deve sparire e il
      player non deve chiudersi da solo.
- [ ] Buffering ed errore: con rete lenta lo spinner compare nel tasto play e
      la porzione bufferizzata si vede sulla barra del mini-player e dietro lo
      slider, allineata alla traccia nativa (rientro 16 dp, altezza 4 dp); in
      modalità aereo a metà brano compare l'avviso con Riprova e, tornata la
      rete, Riprova riparte dallo stesso punto.
- [ ] Cache: aprire Scopri, un artista e un album, chiudere, togliere la rete
      e riaprire: gli elenchi compaiono senza sagome; con la rete tornano a
      rinfrescarsi e nessun brano risulta duplicato o mancante nelle prime due
      pagine.
- [ ] Sprint «scoperta e coda» del 9 settembre 2026, mai provato su una build
      reale. Scopri: le due vetrine mostrano brani di entrambe le sorgenti e
      partono al tocco con la vetrina come coda; la griglia dei generi apre la
      pagina giusta e «Riproduci»/«Casuale» funzionano; scorrendo la home non
      scattano pressioni sulle schede.
- [ ] Cerca: «love» mostra artisti tondi e album quadrati sopra i brani, il
      tocco apre la pagina giusta; una ricerca senza risultati di brani ma con
      artisti non mostra «Nessun risultato»; le ricerche recenti compaiono a
      casella vuota, si rifanno con un tocco e si cancellano.
- [ ] Coda: trascinare dalla maniglia sposta la riga e le altre fanno posto,
      lo scroll non parte durante il trascinamento, un tocco sulla maniglia
      senza movimento non cambia nulla, il brano in riproduzione continua
      dopo uno spostamento, TalkBack espone Sposta su/giù/Togli; «Svuota da
      qui in giù» mostra la snackbar e Annulla rimette i brani dopo quello
      corrente.
- [ ] Player: la riga «Prossimo» cambia con skip, shuffle e ripetizione e apre
      la Coda; con la coda in attesa mostra il brano dopo quello salvato.
- [ ] Android Auto: con il Desktop Head Unit o un'unità reale Onda compare fra
      le app media, le cartelle Preferiti/Playlist/Ascoltati di recente si
      aprono, un brano parte con i fratelli come coda e la cronologia del
      telefono lo registra.
- [ ] Mini-player: entra ed esce in dissolvenza sopra la tab bar; la barra
      avanza in modo continuo e salta a zero su seek indietro o cambio brano;
      nessuna seconda dissolvenza aprendo playlist, artista o album con un
      brano in corso.
- [ ] Aptica: `tap` su righe e bottoni, `toggle` su cuore, shuffle,
      ripetizione e riordino, `success` su accodamenti, creazioni e
      salvataggi, `reject` su rimozioni, svuota ed elimina; nessuna
      vibrazione ad aprire o chiudere schermate e finestre; con «Vibrazione
      al tocco» spenta niente vibra; sotto Android 11 e 14 le costanti
      mancanti ricadono sul click di contesto.
- [ ] Sagome: Scopri (sotto i chip, con titolo e chip fermi), Cerca (input a
      fuoco e tastiera aperta), artista e album senza salto all'arrivo dei
      dati; ferme con «Rimuovi animazioni»; TalkBack annuncia «Caricamento in
      corso».
- [ ] Copertine: nessuna copertina di un'altra traccia nelle righe riciclate
      a scroll veloce; nota musicale su artwork mancante o URL rotto; avatar
      tondo dell'artista ritagliato correttamente.
- [ ] Pressioni: chip e schede recenti non guizzano all'inizio di uno scroll
      orizzontale (`pressDelay` 70 ms); bottoni disabilitati non si ritraggono
      né vibrano; i link di Informazioni mostrano l'opacità da premuto anche
      con «Rimuovi animazioni».

---

## P3 — Evoluzione del prodotto

- [ ] **Offline**, solo per sorgenti e licenze che lo consentono. I termini
      Jamendo vietano applicazioni progettate per offrire accesso offline: quella
      sorgente resta esclusa salvo accordo dedicato.
- [ ] **Radio e continua ad ascoltare** tramite related Audius, con fallback
      chiaro e senza coda infinita opaca.
- [ ] **Playlist pubbliche Audius** con pagine autore e raccolta.
- [ ] **Terza sorgente** dopo aver generalizzato `SourceId`, licenze, refresh
      stream, cursori e fallback.
- [ ] **Ripresa della coda all'avvio** con posizione, repeat/shuffle e URL
      scaduti. Coda, posizione e preferenze sono implementate dal 9 settembre
      2026 (vedi «Ripresa dell'ascolto»); restano la risoluzione fresca degli
      URL scaduti e il collaudo.
- [ ] **Riordino della coda**, salvataggio come playlist e cronologia per data.
      Il riordino a trascinamento è implementato dal 9 settembre 2026 (vedi
      «Coda riordinabile»); restano salvataggio come playlist e cronologia per
      data.
- [ ] **ReplayGain, gapless e crossfade** soltanto dopo misure e verifica del
      supporto del motore audio.

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
