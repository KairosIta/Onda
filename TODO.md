# Roadmap di Onda

Stato aggiornato il **10 ottobre 2026** confrontando codice, configurazione e
documentazione con le prove già raccolte su device e con i controlli automatici,
di release e da clone pulito.

Qui restano le voci aperte. Le prove datate (la baseline) e le voci chiuse,
ciascuna con la sua evidenza, stanno nel
[registro dei collaudi](docs/VERIFICATION_LOG.md): sono la memoria di cosa è
stato verificato e come, e la base per non regredire.

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
  ancora una prova proporzionata al rischio su una build reale;
- **Collaudato in parte** significa che una build reale ha confermato il
  comportamento principale, e la voce dice cosa resta da provare.

Una voce si chiude soltanto quando è soddisfatto il relativo **Done**; chiusa,
passa nel registro dei collaudi con la sua prova.

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
- [x] Home a sezioni: ascolti recenti, «In ascesa questa settimana» (trending
      settimanale Audius più `popularity_week` Jamendo), «Voci nuove» (trending
      underground Audius più ultime uscite Jamendo), griglia dei generi con
      una pagina per genere e il trending federato sotto. **Collaudato il 9
      settembre 2026** su Motorola Edge 50 Neo, Android 16, con brani di
      entrambe le sorgenti nelle vetrine (registro dei collaudi). Le vetrine
      sono `TrackStrip`, una sola
      componente; le sorgenti dichiarano `spotlight` come funzione opzionale
      e la federazione salta chi non ce l'ha. I chip dei generi sono stati
      sostituiti dalla griglia: la pagina genere usa la stessa chiave di
      cache dei vecchi chip.
- [ ] Ricerca di artisti e album oltre ai brani, con le ultime otto ricerche
      da rifare con un tocco. **Collaudato in parte il 9 settembre 2026**:
      «love» mostra artisti di entrambe le sorgenti, album Jamendo e brani, il
      tocco su un artista apre la sua pagina e la ricerca recente compare a
      casella vuota con Cancella; restano da provare il nuovo tocco su una
      ricerca recente e una ricerca con artisti ma senza brani.
      Implementazione: `/users/search` su Audius, `/artists` e `/albums` con
      `namesearch` su Jamendo; Audius non cerca album e la vetrina resta
      solo Jamendo senza avvisi. Le ricerche si ricordano solo quando hanno
      trovato qualcosa (`utils/recentQueries`, tre test).
- [ ] Apertura senza attese: trending, pagine artista e album consultate di
      recente tornano da disco prima del primo render e si rinfrescano in
      background. **Implementato il 9 settembre 2026, da collaudare**: la cache
      di React Query si disidrata su MMKV (`src/services/queryClient.ts`),
      potata alle trenta query più fresche, due pagine per elenco e tre giorni
      (`queryPersistenceSchema.ts`, quattro test); la ricerca resta fuori. Al
      ritorno in primo piano le query scadute si rinfrescano da sole. Dal 9
      ottobre 2026 la migrazione dello storage 2 → 3 scarta una volta gli
      elenchi salvati con l'offset unico, che non sapevano da dove riprendere.

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
- [ ] Apertura del player dal tap sulla notifica. La normalizzazione dei deep
      link `trackplayer://` e `onda://` verso `/player` resta pronta in
      `app/+native-intent.ts`, ma senza la patch RNTP, tolta dal repository
      pubblico, `@rntp/player` 5.8 apre l'app con l'intent di avvio e nessun
      URL (`setSessionActivity` in `TrackPlayerPlaybackService.kt`): il tap
      riporta Onda in primo piano dov'era, non sul player. Torna con un'API
      pubblica RNTP o una modifica autorizzata dal fornitore (vedi la nota in
      cima).
- [x] Ripresa dell'ascolto all'avvio: coda e posizione nel brano sopravvivono
      alla chiusura dell'app e il mini-player riparte da dove era, in pausa,
      senza aprire lo stream né mostrare la notifica finché non si preme play.
      **Collaudato il 9 e il 10 settembre 2026** con `am force-stop` e dopo un
      riavvio del telefono: zero byte di rete prima del play e ripresa a due
      millisecondi dalla posizione salvata (registro dei collaudi). La coda si
      fotografa
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
      **Collaudato in parte il 9 settembre 2026**: in modalità aereo a metà
      brano compaiono l'avviso e Riprova, che riparte dalla stessa posizione;
      restano lo spinner e la porzione bufferizzata con rete lenta. La tabella
      sta in
      `src/services/playbackStatus.ts` (tre test) e i comandi di trasporto
      passano da `playerCommands.ts`, che sa cosa vuol dire play in ogni stato.
- [ ] Coda riordinabile trascinando la maniglia a destra di ogni riga, con le
      stesse mosse come azioni TalkBack (Sposta su, Sposta giù, Togli), e
      «Svuota da qui in giù» con **Annulla** per quattro secondi.
      **Collaudato in parte il 9 settembre 2026**: la riga trascinata si sposta
      di tre posti, le altre fanno posto, il brano continua e Annulla rimette
      i 19 brani svuotati; restano le azioni TalkBack e i casi della checklist
      device. Righe ad altezza
      fissa e geometria in `utils/reorder.ts` (due test, gira come worklet);
      lo scroll della lista si spegne mentre una riga è in mano;
      `moveMediaItem` di RNTP fa lo spostamento e l'annullamento rimette i
      brani dopo quello che suona in quel momento. Manca lo scorrimento
      automatico ai bordi: una coda più lunga dello schermo si riordina in
      più passaggi.
- [ ] Riga «Prossimo» nel player, sotto i controlli: il brano che viene dopo,
      oppure «ordine casuale», «questo brano, di nuovo» o «fine della coda».
      **Collaudato in parte il 9 settembre 2026**: la riga mostra il brano
      seguente e apre la Coda; restano shuffle, ripetizione e coda in attesa.
      La regola sta in `utils/upNext.ts` (due test).
- [ ] Android Auto: preferiti, playlist e ascolti recenti come cartelle
      sfogliabili dal display dell'auto. **Implementato il 9 settembre 2026, da
      collaudare**: l'albero lo costruisce `services/browseTree.ts` dalla
      libreria persistita (due test) e `browseTreeSync` lo rimanda a RNTP a
      ogni mutazione; `plugins/with-android-auto.js` aggiunge al manifest il
      descrittore `automotive_app_desc`, il servizio media lo dichiara già
      RNTP. Senza `extras` nelle voci, per tenere leggero il passaggio nativo:
      cronologia e cuoricino risolvono l'uid dalla libreria. Nessuna prova
      con un'unità o con il Desktop Head Unit.
- [ ] Ricerca vocale: «metti jazz su Onda» dall'Assistant o dal display
      dell'auto cerca nelle sorgenti e fa partire i risultati. Servono
      l'intent filter `MEDIA_PLAY_FROM_SEARCH` sull'attività, un modulo Expo
      locale che legga la query dall'intent di avvio e da `onNewIntent`, e un
      gestore JS che federi la ricerca e riempia la coda; la via della
      sessione media resta chiusa finché RNTP non inoltra a JS le richieste
      di ricerca di Media3. Fino ad allora `with-android-auto.js` tace il
      controllo Lint corrispondente, con il motivo scritto accanto.

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
- [x] Schema MMKV versionato, con migrazioni, backup e quarantena dei dati
      illeggibili (chiuso il 10 settembre 2026, registro dei collaudi); oggi
      alla versione 3.

### Progetto e distribuzione

- [x] Android, tema scuro, icona legacy/adaptive/monochrome e UI edge-to-edge.
- [x] Expo SDK 57, React Native 0.86, TypeScript 6 e `@rntp/player` 5.8.
- [x] Codice e documentazione sotto licenza MIT; contenuti, marchi e
      credenziali esclusi in `THIRD_PARTY_CONTENT.md`.
- [x] Build release minificata e firmabile tramite config plugin.
- [x] Modello source-only: nessun APK/AAB pubblico e nessuna pubblicazione su
      store.
- [x] Splash e privacy policy in-app sono implementati e verificati.
- [x] Workflow CI Ubuntu/Windows e build personale manuale configurati ed
      eseguiti su GitHub: la build personale completa è passata su Ubuntu e
      Windows il 22 agosto 2026, la CI gira a ogni push su `main` e a ogni PR.
- [ ] Font di brand Manrope incorporato nel pacchetto nativo, copertine con
      dissolvenza e cache, feedback tattile di sistema, bottoni che si
      ritraggono, sagome di caricamento e chiusura del player col
      trascinamento. **Collaudato in parte il 9 settembre 2026**: Manrope
      ovunque, tab bar compresa, cifre tabulari nelle durate e chiusura del
      player col trascinamento sono verificati su una build reale; copertine,
      aptica, pressioni e sagome restano nella checklist device.

### Limiti dichiarati

- solo Android e build nativa personale; Expo Go non è supportato;
- Jamendo richiede un Client ID personale;
- nessun account utente, sincronizzazione cloud o backend Onda;
- nessun ascolto offline;
- attribuzione e provenienza sono visibili, ma la distribuzione federata resta
  bloccata dalle conferme dei fornitori descritte nella nota di conformità.

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
      Collaudo del 9 settembre 2026 su Motorola Edge 50 Neo: RNTP su Android
      non emette mai lo stato `error` (dopo un errore ExoPlayer torna `idle`),
      quindi l'avviso non compariva; ora lo alza `store/playbackFault` sull'evento
      di errore. Il salto automatico dopo uno stream 404 spostava l'indice senza
      ripreparare il player e la riproduzione moriva in silenzio: aggiunto
      `retry()` fra skip e play.
      **Done:** comandi serializzati o disabilitati quando necessario e zero
      rejection non gestite nei log, provati su device.

- [ ] **Rendere recuperabile il setup del player.** **Implementato il 10
      settembre 2026, da collaudare**: al posto del banner una schermata
      intera con Riprova (che richiama davvero `setupPlayer`, perché dopo un
      errore si lascia richiamare) e il messaggio selezionabile; finché il
      player non è pronto lo Stack non viene montato, quindi non c'è niente
      da disabilitare. Manca solo la prova con un guasto vero all'avvio.
      **Done:** azione Riprova, controlli disabilitati finché il player non è
      pronto e diagnostica tecnica copiabile.

### Dati locali

- [ ] **Risoluzione fresca degli stream Jamendo salvati.** Preferiti e
      playlist persistono l'URL audio ricevuto dall'API, che può diventare obsoleto.
      Priorità abbassata il 30 agosto 2026: il parametro `from` nell'URL Jamendo
      non è una credenziale a scadenza. Provate quattro varianti sullo stesso
      brano — token valido, token assente, token manomesso e token di un altro
      brano — e tutte hanno risposto `206 audio/mpeg`. Il rischio residuo è che
      cambi l'host o sparisca il brano, non che il link scada.
      **Done:** risoluzione al play da `source + id`, cache con scadenza e test su
      elementi salvati da tempo.

### Accessibilità e layout

- [ ] **Portare target tattili e focus ad almeno 48×48 dp.** Dal 10 settembre
      2026 ogni controllo a icona ha `touch.target` (48×48 dp) sul contenitore
      che riceve il tocco, al posto di `hitSlop`: player, mini-player, righe,
      coda, playlist, intestazioni, snackbar, stati vuoti. **Misurato su
      device** con `uiautomator dump`: tutti i controlli del player, la riga
      «Prossimo» e i bottoni «Opzioni» delle righe riportano 48 dp di altezza. Restano i link di
      testo dell'attribuzione (inline, con `hitSlop`) e la prova con
      Accessibility Scanner e Switch Access.
      **Done:** wrapper non sovrapposti, Accessibility Scanner e Switch Access.

- [ ] **Completare la semantica TalkBack.** Icone decorative, repeat,
      preferito/attivo, durata, heading, toast ed errori non hanno ancora una
      semantica completa.
      **Done:** label/state/hint/live region e percorso manuale a occhi chiusi.

---

## P2 — Qualità e manutenzione

### Prestazioni e rete

- [ ] Condividere un solo observer di progresso, non interrogare il bridge
      senza traccia e usare frequenze diverse per mini-player e player aperto.
      **Implementato il 9 settembre 2026, da collaudare**: `src/store/progress.ts`
      tiene un solo timer per tutta l'app, a 500 ms in riproduzione e 2 s in
      pausa, fermo senza brano, senza lettori o con l'app in background
      (`progressPolicy.ts`, un test); mini-player e player leggono da lì.
      Dal 9 ottobre 2026 anche il player legge il progresso in un figlio
      memoizzato (`SeekBar` in `app/player.tsx`), come `MiniProgress` nel
      mini-player: prima `useProgress` stava in cima alla schermata e ogni
      tick ridisegnava tutto il player. Da collaudare con «Highlight updates»
      di React DevTools a player aperto: in riproduzione deve lampeggiare
      solo la riga dello slider, non copertina e controlli.

- [ ] Usare thumbnail nei mini-player e nella Coda invece dell'artwork grande
      destinato a lock screen e player.

- [ ] Aggiungere timeout e `AbortSignal` fino agli adapter; le ricerche
      superate continuano oggi a consumare rete e quota. **Implementato il
      9 ottobre 2026, da collaudare**: il timeout c'era gia' (15 s in
      `sources/http.ts`); ora il segnale di React Query arriva da ogni
      schermata fino a `fetch` (`ListParams.signal`), quindi una ricerca
      superata o una schermata chiusa mentre carica annullano le richieste
      in volo, i tentativi Jamendo ancora da fare e le pagine di un album
      non ancora scaricate. Un annullamento non e' un guasto: ha un errore
      suo (`AbortError`) e non diventa «rete non raggiungibile». Test con
      `fetch` finto: richiesta appesa annullata, segnale gia' scattato che
      non apre la connessione, ricerca annullata fra due tentativi Jamendo,
      segnale che arriva a ogni sorgente. Su device: digitando in Cerca con
      pause oltre i 400 ms del debounce, nel logcat di rete le ricerche
      superate devono interrompersi.

- [ ] Definire retry/backoff per 429 e 5xx. Jamendo ritenta tre volte ogni
      risposta vuota e React Query può moltiplicare ulteriormente le chiamate.
      Dal 9 ottobre 2026 le vetrine di artisti e album della ricerca ne
      fanno due (`NAME_SEARCH_ATTEMPTS`): li' la lista vuota e' il caso
      normale e i tre tentativi costavano due chiamate e 600 ms a ogni
      ricerca, tenendo fermi anche gli artisti Audius. Gli elenchi di brani
      restano a tre, perche' una vuota per errore toglierebbe Jamendo
      dall'elenco.

- [ ] Collegare React Query ad AppState/stato rete e aggiungere
      pull-to-refresh con una policy esplicita per trending e cache. AppState è
      collegato dal 9 settembre 2026 (`focusManager` in `queryClient.ts`) e la
      cache è persistita; restano lo stato rete e il pull-to-refresh.

- [ ] Misurare in release cold/warm start, PSS/RSS, frame lenti, rete e
      batteria per 60 minuti.

### Test e toolchain

- [ ] Estendere i test unitari a mutazioni degli store, `formatTime`, shuffle e
      migrazioni complete. Coperti oggi (128 test): validazione, repeat,
      cursore per sorgente e paginazione federata con sorgenti finte,
      composizione della federazione (anche di artisti e album), annullamento
      delle richieste e tentativi Jamendo, entità HTML Jamendo, budget di
      salti, export/import, riepilogo della coda, sessione di ascolto, stato
      del player, politica di lettura del progresso, potatura della cache,
      migrazioni dello storage fino alla 3, ricerche recenti, geometria del
      riordino, prossimo brano, albero per Android Auto, regola dell'audit
      delle dipendenze ed elenco delle sorgenti con descrizione e attribuzione.

- [ ] Portare nel repository test deterministici della federazione con fetch
      mockato; la composizione e la propagazione degli errori sono già coperte da
      `federation.ts`, manca il livello fetch. Lo smoke live resta separato perché
      dipende da servizi esterni. Dal 9 ottobre 2026 `fetchJSON` e i tentativi
      di Jamendo hanno test con `fetch` finto; manca ancora il parsing completo
      delle risposte Audius e Jamendo.

- [ ] Rivedere entro il 15 gennaio 2027 le eccezioni dichiarate in
      `scripts/audit-policy.ts` (`braces` e `node-forge`, senza versione
      corretta al 9 ottobre 2026): dopo quella data `npm run check:audit` torna
      rosso. Se nel frattempo è uscita una correzione, la strada è un override;
      altrimenti motivo e data si riscrivono.

- [ ] Rimuovere l'esclusione Android Lint per Worklets/Reanimated quando la
      combinazione Expo/AGP correggerà il crash interno KaModule/VirtualFile;
      fino ad allora `npm run android:lint` controlla l'app e le altre dipendenze
      senza nascondere l'eccezione.

- [ ] Archiviare APK/AAB, SHA-256, mapping R8, sourcemap Hermes, dipendenze e
      commit sorgente come un unico artefatto di release.

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
      in `MainApplication.kt`. Su device Manrope è verificata il 9 settembre
      2026 e il player a font scale 1.0 e 2.0 il 10 settembre; restano 1.3,
      1.5 e le altre schermate.

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
- [ ] Font scale 1.0/1.3/1.5/2.0 e display size piccolo/grande. Il player a
      1.0 e 2.0 è verificato il 10 settembre 2026; restano 1.3, 1.5, le altre
      schermate e il display size.
- [ ] Schermo 360×640 dp, gesture navigation e three-button navigation. Il
      player a 360×640 dp è verificato il 10 settembre 2026 (scorre); il
      telefono usa la navigazione a tre pulsanti, resta quella a gesti.
- [ ] Rete rimossa a metà brano, rete lenta, captive portal, cambio Wi-Fi/5G e
      singola sorgente che cade durante la terza pagina.
- [ ] Chiamata in arrivo, audio focus di un'altra app, cuffie scollegate,
      Bluetooth e Android Auto.
- [ ] Un'ora di riproduzione: batteria, temperatura, memoria, coda da 100 e
      scroll di almeno 1000 risultati.
- [ ] Release minificata: ricerca, player, notifica, background, deep link,
      preferiti, playlist e persistenza dopo `am force-stop`.
- [ ] Splash standalone su più dispositivi reali e themed icon su più maschere;
      telefono Android 16 e form factor tablet virtuale sono già verificati.
- [ ] Sprint «sensazione» del 9 settembre 2026. Manrope ovunque, tab bar
      compresa, e cifre tabulari nelle durate sono verificati il 9 settembre
      2026 (se un giorno compare Roboto la famiglia XML non è nel pacchetto:
      rifare il prebuild); restano font scale 1.3 e 2.0 fuori dal player.
- [ ] Player: la chiusura oltre la soglia e il ritorno sotto la soglia sono
      verificati il 9 settembre 2026, l'attribuzione raggiungibile a 360×640
      dp il 10 settembre. Restano: chiusura con uno strappo, lo slider che non
      muove il foglio, la schermata precedente scurita sotto il foglio,
      chevron e tasto back senza fasce scure, copertina a 0,92 in pausa.
      L'apertura dalla notifica ad app chiusa dipende da RNTP (vedi
      «Apertura del player dal tap sulla notifica»).
- [ ] Coda in attesa: trascinare lo slider e poi premere play; «Riproduci
      dopo» e «Accoda» dal menu di un brano; apertura della Coda dal player.
      In ogni caso il mini-player non deve sparire e il player non deve
      chiudersi da solo. Lo skip avanti dal mini-player è verificato il 9
      settembre 2026.
- [ ] Buffering ed errore: con rete lenta lo spinner compare nel tasto play e
      la porzione bufferizzata si vede sulla barra del mini-player e dietro lo
      slider, allineata alla traccia nativa (rientro 16 dp, altezza 4 dp). La
      modalità aereo a metà brano, con l'avviso e Riprova che riparte dallo
      stesso punto, è verificata il 9 settembre 2026.
- [ ] Cache: aprire Scopri, un artista e un album, chiudere, togliere la rete
      e riaprire: gli elenchi compaiono senza sagome; con la rete tornano a
      rinfrescarsi e nessun brano risulta duplicato o mancante nelle prime due
      pagine.
- [ ] Sprint «scoperta e coda» del 9 settembre 2026. Scopri a sezioni,
      vetrine con entrambe le sorgenti che partono al tocco, griglia dei
      generi e «Riproduci»/«Casuale» sono verificati il 9 settembre 2026;
      resta che scorrendo la home non scattino pressioni sulle schede.
- [ ] Cerca: «love» con artisti tondi e album quadrati sopra i brani, il tocco
      che apre la pagina giusta e la ricerca recente a casella vuota con
      Cancella sono verificati il 9 settembre 2026. Restano: una ricerca senza
      risultati di brani ma con artisti non mostra «Nessun risultato», e una
      ricerca recente si rifà con un tocco.
- [ ] Coda: lo spostamento dalla maniglia, le righe che fanno posto, il brano
      che continua e Annulla dopo «Svuota i successivi» sono verificati il 9
      settembre 2026. Restano: lo scroll non parte durante il trascinamento,
      un tocco sulla maniglia senza movimento non cambia nulla, TalkBack
      espone Sposta su/giù/Togli, e «Svuota da qui in giù» con lo shuffle
      attivo mostra la snackbar e Annulla rimette i brani dopo quello
      corrente.
- [ ] Player: la riga «Prossimo», verificata il 9 settembre 2026 col brano
      seguente e l'apertura della Coda, cambia con skip, shuffle e
      ripetizione; con la coda in attesa mostra il brano dopo quello salvato.
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
      stream, cursori e fallback. Dal 10 ottobre 2026 `SourceId`, licenze e
      cursori sono generalizzati: un solo elenco (`SOURCE_IDS`), la
      descrizione con sigla e attribuzione in `services/sources/meta.ts`, il
      cursore per sorgente; aggiungerne una fa segnalare a TypeScript le
      tabelle da completare (procedura in `docs/DEVELOPMENT.md`, «Prossimi
      passi»). Restano il refresh degli stream salvati e i testi legali.
- [ ] **Ripresa della coda all'avvio** con posizione, repeat/shuffle e URL
      scaduti. Coda, posizione e preferenze sono implementate dal 9 settembre
      2026 e collaudate il 10 settembre (vedi «Ripresa dell'ascolto»); resta la
      risoluzione fresca degli URL scaduti.
- [ ] **Riordino della coda**, salvataggio come playlist e cronologia per data.
      Il riordino a trascinamento è implementato dal 9 settembre 2026 (vedi
      «Coda riordinabile»); restano salvataggio come playlist e cronologia per
      data.
- [ ] **Timer a fine brano**, oltre a quelli a minuti. Il commento in
      `store/sleepTimer.ts` lo dava per fatto in `player.tsx`, dove non c'è
      mai stato. Prima va capito se RNTP offre un equivalente nativo di
      `sleepAfterTime`, l'unico che resta preciso sotto Doze.
- [ ] **ReplayGain, gapless e crossfade** soltanto dopo misure e verifica del
      supporto del motore audio.

---

## Registro dei collaudi

Le voci chiuse di P0, P1, P2 e della checklist device, la baseline datata e
l'elenco di ciò che non deve regredire stanno nel
[registro dei collaudi](docs/VERIFICATION_LOG.md).
