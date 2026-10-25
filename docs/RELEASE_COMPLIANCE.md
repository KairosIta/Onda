# Nota di conformità della release

Revisione tecnica del **22 agosto 2026**, aggiornata il **10 ottobre 2026** per
i termini API di Audius e le credenziali inserite dall'utente, l'**11 ottobre
2026** per il player su Media3 e il **13 ottobre 2026** per la build e i
primi collaudi del nuovo modulo e il **15 ottobre 2026** per la cache degli
artwork. Questa nota registra le condizioni verificate
per Onda e non sostituisce un parere legale o un'autorizzazione dei fornitori.

## Decisione corrente

Il repository può essere reso pubblico come progetto sorgente, mantenendo gli
avvisi di licenza e senza includere credenziali o artefatti compilati. Il
progetto non pubblica APK ufficiali. Ogni clone crea esclusivamente una build
personale, firmata con una chiave debug generata localmente.

Dal 10 ottobre 2026 l'APK non incorpora credenziali: ogni persona inserisce
nell'app il proprio Client ID Jamendo e, se vuole, una propria API key Audius,
conservati cifrati sul dispositivo. Per leggere il catalogo Audius non servono
credenziali. La build personale e quella di release si fermano se trovano una
variabile `EXPO_PUBLIC_*` con un nome da credenziale.

Questa scelta elimina la credenziale Jamendo condivisa. L'APK incorpora
dipendenze con licenze proprie e accede ad API e contenuti remoti soggetti a
condizioni separate. La compatibilità della licenza del player non chiude
da sola i requisiti di distribuzione dell'app completa.

## Profilo esaminato

La decisione seguente vale soltanto per una build gratuita e non commerciale,
senza pubblicità, abbonamenti, acquisti, analytics, account Onda o ascolto
offline. Onda riproduce gli stream originali e non conserva copie dei brani.
Qualsiasi monetizzazione o modifica dell'architettura richiede una nuova
valutazione prima della distribuzione.

## Fonti ufficiali

- [Audius API Terms](https://audius.co/legal/api-terms)
  ([PDF](https://audius.co/documents/ApiTerms.pdf))
- [Audius Open Music License](https://audius.org/open-music-license.pdf)
- [Audius Terms of Use](https://audius.co/documents/TermsOfUse.pdf)
- [Audius REST API](https://docs.audius.co/api/rest-api)
- [Jamendo API Terms of Use](https://devportal.jamendo.com/api_terms_of_use)
- [Jamendo API v3](https://developer.jamendo.com/v3.0)
- [Jamendo API authentication](https://developer.jamendo.com/v3.0/authentication)

Il 22 agosto 2026 il documento Audius API Terms era collegato dal sito
ufficiale ma non consultabile dal client di audit. Il 10 ottobre 2026 il PDF
era leggibile: «Last Updated: 2 July, 2025», SHA-256
`6552f00425e92d77a1a8b1dd2dde4cbdb7d75ab5a926233651c9d1e1da88cf1c`. Prima di
una release va archiviata quella copia datata con la documentazione privata di
release, oppure ottenuta conferma scritta dei termini applicabili.

I termini ammettono la cache solo per quanto necessario alla sessione e
richiedono che contenuti e dati memorizzati diventino inaccessibili alla sua
fine. Dal 10 ottobre 2026 Onda tiene i dati di catalogo Audius solo in
memoria: la cache su disco li esclude e la migrazione dello storage 3 → 4
toglie quelli salvati prima. Dal 15 ottobre anche gli artwork Audius sono
limitati alla memoria; prima di montare le schermate viene eliminata una volta
la vecchia cache mista delle immagini. La nuova policy e la migrazione hanno
test automatici; l'aggiornamento da una build con immagini gia' in cache resta
da provare su device. Resta da chiarire con Audius se la libreria che
l'utente salva di proposito (preferiti, cronologia, playlist, ultima coda)
rientra nella clausola.

## Evidenza e decisioni

| Area    | Evidenza nell'app                                                                                                                                                                                                                            | Decisione corrente                                                                                                                                                                                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audius  | Nome della sorgente, pagina canonica, regime di diritti ricevuto e collegamento esplicito alla Open Music License nel player. Le tracce gated o non riproducibili sono filtrate. I dati di catalogo restano solo in memoria per la sessione. | Il profilo non commerciale resta subordinato alla verifica dei vigenti API Terms. Una release commerciale è bloccata: l'API non fornisce sempre identità del licenziante e avviso di copyright necessari all'attribuzione commerciale prevista dalla OML.                                               |
| Jamendo | Nome della sorgente, pagina canonica e URL della licenza Creative Commons specifica nel player. Nessuna cache dei brani o modalità offline. Client ID inserito dall'utente in app e verificato con una richiesta prima del salvataggio.      | Ogni persona usa il Client ID della propria applicazione Jamendo, inserito in app. La distribuzione di un APK condiviso resta bloccata finché Jamendo non conferma per iscritto questo modello: applicazioni registrate dai singoli utenti, clausola sulle applicazioni duplicate, quota per Client ID. |
| Player  | Modulo nostro `modules/onda-player` (MIT) su AndroidX Media3, che Gradle scarica e incorpora nell'APK. `@rntp/player` non è più una dipendenza dall'11 ottobre 2026.                                                                         | Media3 è sotto Apache 2.0, che consente la distribuzione: un APK ufficiale deve portare il testo della licenza e gli avvisi delle dipendenze incorporate (gate di release).                                                                                                                             |
| Privacy | Policy v1.5 nel repository e accessibile dall'app; nessun advertising, analytics o backend Onda; backup Android disabilitato; credenziali cifrate con il Keystore, fuori da backup ed export.                                                | Coerente con il profilo esaminato; va aggiornata se cambiano servizi, raccolta dati o distribuzione.                                                                                                                                                                                                    |

Il 13 ottobre 2026 la build personale Media3 e i primi collaudi su Android 16
sono passati; il dettaglio è nel [registro dei collaudi](VERIFICATION_LOG.md).
Questo conferma il comportamento tecnico provato, non costituisce una risposta
dei fornitori né completa il pacchetto di licenze dell'APK.

La decisione del progetto resta quindi: **sorgente pubblico, pubblicazione
dell'APK federato sospesa fino alla chiusura dei gate sotto**. È una decisione
di release di Onda basata sulle conferme ancora mancanti, non un divieto
generale di distribuire qualsiasi app che usa queste API. Non allegare APK
personali a release, issue o pull request. Un'eventuale variante solo Audius
richiede una valutazione separata.

## Conferme da ottenere

Conservare le risposte complete, la data e l'identità del referente insieme
alla documentazione privata di release. Non committare credenziali o dati
personali nel repository.

### Richiesta a Jamendo

> Subject: User-provided Client IDs in a free, open-source Android app
>
> We are developing Onda, a free, non-commercial, open-source Android music
> player. It streams Jamendo tracks directly, shows the canonical track page
> and the track-specific Creative Commons license, and provides no downloads or
> offline mode. The app embeds no Client ID: each user registers their own
> application on the Jamendo developer portal and enters its Client ID in the
> app, where it is stored encrypted on the device.
>
> 1. Is this model acceptable for an app distributed publicly as an APK?
> 2. Would many user registrations referring to Onda count as duplicated
>    applications? How should users fill in the name and description (for
>    example "Onda – personal installation" with a link to the repository)?
> 3. Which plan and request quota apply to each Client ID in this model?
> 4. Should the maintainer also register Onda, even though the app uses no
>    maintainer Client ID?
> 5. Onda keeps catalog metadata on the device for up to three days, so the
>    app opens without waiting for the network. Is this within what is
>    reasonably necessary for the operation of the application?

### Richiesta ad Audius

> Subject: Attribution requirements for a non-commercial Audius music player
>
> We are developing Onda, a free, non-commercial, open-source Android music
> player using Audius read-only APIs. For each track it shows Audius as source,
> the canonical track URL, the rights label returned by the API, and a link to
> the Open Music License. Some API responses do not include a copyright notice
> or licensor identity. Does this presentation satisfy the current API Terms
> and OML for public non-commercial distribution? Please also confirm what
> additional data or approval would be required for any future commercial use.
>
> The API Terms allow only session-based caching. Onda keeps Audius catalog
> data in memory only, but stores the tracks a user saves on purpose
> (favorites, history, playlists and the last queue, as metadata and stream
> URLs) on the device so they survive a restart. Is this local library
> permitted, or must it be limited to the session as well?

## Gate di release

Prima di distribuire un APK ufficiale devono essere presenti:

1. copia datata e leggibile dei termini Audius vigenti e verifica del profilo,
   compresa la cache di sessione;
2. risposta Jamendo che autorizzi l'architettura scelta (Client ID inserito
   dall'utente), con piano e quota;
3. eventuali modifiche di attribuzione richieste dai fornitori, verificate su
   una release reale;
4. aggiornamento coordinato di questa nota, `THIRD_PARTY_CONTENT.md`, privacy e
   schermata Informazioni;
5. licenza Apache 2.0 e avvisi delle dipendenze incorporate (AndroidX Media3 e
   le altre) consultabili dall'APK. Dal 24 ottobre 2026 la schermata
   Informazioni nomina Media3 e collega il testo della licenza Apache 2.0;
   per un APK ufficiale resta l'elenco completo degli avvisi incorporato
   nell'app, leggibile anche senza rete. Dal 25 ottobre 2026 l'APK incorpora
   solo i font usati (Ionicons MIT, Material Symbols Apache 2.0, Manrope
   OFL 1.1) e `npm run notices` genera l'elenco completo in
   `assets/legal/third-party-notices.json`: 175 artefatti Maven del classpath
   di release, 80 pacchetti npm fra bundle e moduli nativi e i tre font, con
   i testi di licenza e le NOTICE Apache; la CI verifica che corrisponda alle
   dipendenze. Resta la schermata dell'app che lo mostra;
6. nessuna credenziale nell'APK e nessuna credenziale in log, export o backup,
   verificati su una build di release.
