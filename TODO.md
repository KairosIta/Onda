# Roadmap di Onda

Stato aggiornato il **22 agosto 2026** confrontando codice, configurazione e
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

### Riproduzione

- [x] Player nativo Android con play/pausa, seek, precedente e successivo.
- [x] Riproduzione in background, media session, notifica, lock screen e
      comandi media.
- [x] Coda unica fra le sorgenti: riproduci elenco, riproduci dopo, accoda,
      passa a una traccia, rimuovi e svuota i successivi.
- [x] Repeat off/traccia/coda persistito.
- [ ] Shuffle nativo sulla coda corrente. **Implementato, da collaudare:**
      `setShuffleEnabled` conserva la preferenza e viene riapplicato al setup.
- [ ] Timer di spegnimento nativo da 15 a 90 minuti. **Implementato, da
      collaudare:** verificare pausa reale sotto Doze e coerenza del countdown UI.
- [x] Apertura del player dal tap sulla notifica tramite normalizzazione dei
      deep link `trackplayer://` e `onda://`.

### Libreria locale

- [x] Preferiti, cronologia e playlist persistiti con MMKV.
- [x] Creazione, rinomina ed eliminazione playlist.
- [x] Aggiunta/rimozione brani e riordino accessibile tramite frecce.
- [x] Riproduzione e shuffle di preferiti, cronologia, playlist, artisti e
      album.
- [ ] Export/import e migrazioni versionate non sono ancora disponibili.

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

- [ ] **Unificare gli stati del player e gestire tutte le promise RNTP.** I
      comandi da UI non sono sempre attesi/catturati e play/pausa non distingue
      chiaramente caricamento, buffering, pausa ed errore.
      **Done:** stato `idle/loading/buffering/playing/paused/error`, comandi
      serializzati o disabilitati quando necessario, retry visibile e zero
      rejection non gestite nei log.

- [ ] **Rendere recuperabile il setup del player.** Un errore iniziale mostra
      un banner ma non offre una nuova inizializzazione.
      **Done:** azione Riprova, controlli disabilitati finché il player non è
      pronto e diagnostica tecnica copiabile.

- [ ] **Classificare gli errori stream senza consumare la coda.** Il servizio
      non salta gli errori classificati `network`, ma tutti gli altri possono
      avanzare fino a tre volte e la classificazione dipende dal codice RNTP.
      **Done:** retry/backoff per rete, skip solo per stream definitivamente morto,
      budget per sessione robusto e test device togliendo la rete a metà brano.

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

- [ ] **Aggiungere export/import della libreria.** Preferiti e playlist
      dipendono oggi dall'installazione e dalla firma dell'app.
      **Done:** JSON versionato, anteprima, merge sicuro e round-trip verificato in
      release.

- [ ] **Registrare una riproduzione reale, non una transizione.** La cronologia
      viene aggiornata appena cambia media item; il testo “Riprendi da dove eri”
      è inesatto perché la posizione non viene salvata.
      **Done:** registrazione dopo una soglia di ascolto e copy “Ascoltati di
      recente”, oppure persistenza e ripristino della posizione.

- [ ] **Risoluzione fresca degli stream Jamendo salvati.** Preferiti e
      playlist persistono l'URL audio ricevuto dall'API, che può diventare obsoleto.
      **Done:** risoluzione al play da `source + id`, cache con scadenza e test su
      elementi salvati da tempo.

### Navigazione e correttezza UI

- [ ] **Rispettare `enabled` e validare tutte le route.** `sourceById` accetta
      una sorgente registrata anche se disabilitata; un `kind` sconosciuto apre i
      Preferiti invece di mostrare Not Found.
      **Done:** registro unico delle sorgenti attive e rifiuto esplicito di
      source/kind/id non ammessi, con test deep link.

- [ ] **Separare errori e contenuto vuoto per artista/album.** Alcuni errori
      vengono mostrati insieme a “Nessun brano” o “Album vuoto”; mancano retry
      mirati e l'errore di `albumInfo` non è presentato.
      **Done:** stati loading/error/empty/data mutuamente esclusivi e Riprova per
      profilo e lista.

- [ ] **Paginare gli album Jamendo.** Il limite fisso di 100 può troncare una
      raccolta senza segnalarlo.
      **Done:** paginazione o conteggio completo, ordine stabile e test oltre 100
      elementi.

- [ ] **Formattare correttamente durate oltre un'ora.** `formatTime(7525)`
      restituisce `125:25` invece di `2:05:25`.
      **Done:** formato ore/minuti/secondi e unit test dei valori limite.

### Accessibilità e layout

- [ ] **Correggere la safe area della Coda.** Le ultime righe possono finire
      sotto la navigation bar Android.
      **Done:** ultimo elemento e azione di rimozione visibili con gesture e
      navigazione a tre pulsanti.

- [ ] **Rendere il player responsivo.** Artwork quadrata e layout fisso non
      scrollabile possono spingere controlli/licenza fuori schermo.
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
- [ ] Limitare con una LRU il catalogo volatile `session`, oggi crescente per
      tutta la vita del processo.
- [ ] Usare thumbnail nei mini-player e nella Coda invece dell'artwork grande
      destinato a lock screen e player.
- [ ] Aggiungere timeout e `AbortSignal` fino agli adapter; le ricerche
      superate continuano oggi a consumare rete e quota.
- [ ] Definire retry/backoff per 429 e 5xx. Jamendo ritenta tre volte ogni
      risposta vuota e React Query può moltiplicare ulteriormente le chiamate.
- [ ] Collegare React Query ad AppState/stato rete e aggiungere
      pull-to-refresh con una policy esplicita per trending e cache.
- [ ] Misurare in release cold/warm start, PSS/RSS, frame lenti, rete e
      batteria per 60 minuti.

### Test e toolchain

- [ ] Estendere i test unitari a mutazioni degli store, `formatTime`, shuffle e
      migrazioni complete; validazione, repeat e cursore federato sono coperti.
- [ ] Portare nel repository test deterministici della federazione con fetch
      mockato; mantenere lo smoke live separato perché dipende da servizi esterni.
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
      scaling e fallback accessibili.
- [ ] Correggere apostrofi ASCII e copy italiano (`e'`, `piu'`, `Modalita'`),
      uniformando tono e plurali.
- [ ] Aggiungere pressed/ripple, loading e feedback non solo cromatico a ogni
      azione.
- [ ] Sostituire il toast da 550 ms con snackbar accessibile da 2–4 secondi.
- [ ] Aggiungere undo o conferma per “Svuota i successivi”.
- [ ] Migliorare placeholder, errori artwork, skeleton e messaggi distinti per
      offline, quota, vuoto e contenuto non riproducibile.
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
      scaduti.
- [ ] **Riordino della coda**, salvataggio come playlist e cronologia per data.
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
