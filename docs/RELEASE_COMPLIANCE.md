# Nota di conformità della release

Revisione tecnica del **22 agosto 2026**. Questa nota registra le condizioni
verificate per Onda e non sostituisce un parere legale o un'autorizzazione dei
fornitori.

## Decisione corrente

Il repository può essere reso pubblico come progetto sorgente, mantenendo gli
avvisi di licenza e senza includere credenziali o artefatti compilati. Il
progetto non pubblica APK ufficiali. Ogni clone crea esclusivamente una build
personale con il Client ID Jamendo del proprio utilizzatore e la firma debug
generata localmente.

Questa scelta riduce il rischio di condividere una credenziale Jamendo, ma non
trasforma l'APK in software liberamente ridistribuibile: una build incorpora
dipendenze, API e contenuti soggetti a condizioni separate.

## Profilo esaminato

La decisione seguente vale soltanto per una build gratuita e non commerciale,
senza pubblicità, abbonamenti, acquisti, analytics, account Onda o ascolto
offline. Onda riproduce gli stream originali e non conserva copie dei brani.
Qualsiasi monetizzazione o modifica dell'architettura richiede una nuova
valutazione prima della distribuzione.

## Fonti ufficiali

- [Audius API Terms](https://audius.co/legal/api-terms)
- [Audius Open Music License](https://audius.org/open-music-license.pdf)
- [Audius Terms of Use](https://audius.co/documents/TermsOfUse.pdf)
- [Audius REST API](https://docs.audius.co/api/rest-api)
- [Jamendo API Terms of Use](https://devportal.jamendo.com/api_terms_of_use)
- [Jamendo API v3](https://developer.jamendo.com/v3.0)
- [Jamendo API authentication](https://developer.jamendo.com/v3.0/authentication)

Durante la revisione il documento Audius API Terms era collegato dal sito
ufficiale ma non consultabile dal client di audit. Prima di una release va
archiviata una copia leggibile e datata oppure ottenuta conferma scritta dei
termini applicabili.

## Evidenza e decisioni

| Area    | Evidenza nell'app                                                                                                                                                                | Decisione corrente                                                                                                                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audius  | Nome della sorgente, pagina canonica, regime di diritti ricevuto e collegamento esplicito alla Open Music License nel player. Le tracce gated o non riproducibili sono filtrate. | Il profilo non commerciale resta subordinato alla verifica dei vigenti API Terms. Una release commerciale è bloccata: l'API non fornisce sempre identità del licenziante e avviso di copyright necessari all'attribuzione commerciale prevista dalla OML. |
| Jamendo | Nome della sorgente, pagina canonica e URL della licenza Creative Commons specifica nel player. Nessuna cache o modalità offline.                                                | Ogni clone usa il Client ID del proprio utilizzatore. La distribuzione di un APK condiviso resta bloccata finché Jamendo non autorizza per iscritto il Client ID incorporato oppure non approva un'architettura alternativa.                              |
| RNTP    | Il pacchetto `@rntp/player` viene scaricato da npm e non è incluso integralmente nel repository.                                                                                 | La versione 5.8.0 è gratuita solo per uso personale privato o didattico/ricerca accademica qualificata. Ogni altro uso richiede la licenza commerciale del fornitore; nessun APK viene pubblicato dal progetto.                                           |
| Privacy | Policy v1.0 nel repository e accessibile dall'app; nessun advertising, analytics o backend Onda; backup Android disabilitato.                                                    | Coerente con il profilo esaminato; va aggiornata se cambiano servizi, raccolta dati o distribuzione.                                                                                                                                                      |

Di conseguenza **il sorgente può essere pubblico, ma la build federata Audius +
Jamendo non è autorizzata alla distribuzione pubblica allo stato attuale**. Non
allegare APK personali a release, issue o pull request. Un'eventuale variante
solo Audius è una decisione di prodotto separata e richiede prima la verifica
degli API Terms vigenti e della licenza del player.

## Conferme da ottenere

Conservare le risposte complete, la data e l'identità del referente insieme
alla documentazione privata di release. Non committare credenziali o dati
personali nel repository.

### Richiesta a Jamendo

> Subject: Authorization for Jamendo API Client ID in a free Android app
>
> We are developing Onda, a free, non-commercial, open-source Android music
> player. It streams Jamendo tracks directly, shows the canonical track page
> and the track-specific Creative Commons license, and provides no downloads or
> offline cache. An Android APK necessarily exposes its read-only Client ID.
> May we distribute this app with the Client ID embedded in the APK? If not,
> which approved authentication architecture or plan should we use, and which
> quota applies to public installations?

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

## Gate di release

Prima di distribuire un APK ufficiale devono essere presenti:

1. copia datata e leggibile dei termini Audius vigenti e verifica del profilo;
2. risposta Jamendo che autorizzi l'architettura scelta, con piano e quota;
3. eventuali modifiche di attribuzione richieste dai fornitori, verificate su
   una release reale;
4. aggiornamento coordinato di questa nota, `THIRD_PARTY_CONTENT.md`, privacy e
   schermata Informazioni.
5. licenza o autorizzazione RNTP compatibile con la distribuzione prevista.
