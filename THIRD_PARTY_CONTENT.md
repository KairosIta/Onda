# Contenuti e servizi di terze parti

La [licenza MIT](LICENSE) di Onda si applica al codice sorgente e alla
documentazione originali identificati come parte di Onda. Non concede alcun
diritto sul software, sui contenuti o sui servizi di terze parti.

## Software di terze parti

Le dipendenze non sono rilicenziate sotto MIT. `npm ci` le scarica dai relativi
registri e ogni dipendenza conserva la propria licenza.

In particolare, il player di Onda (`modules/onda-player`) è codice originale
sotto MIT e usa AndroidX Media3 (`androidx.media3:media3-exoplayer` e
`androidx.media3:media3-session`) di The Android Open Source Project, sotto
[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). Gradle lo
scarica durante la build e lo incorpora nell'APK: chi distribuisce un APK deve
accompagnarlo con il testo della licenza Apache 2.0 e con gli avvisi delle
dipendenze incorporate.

Fino all'11 ottobre 2026 Onda usava `@rntp/player@5.8.0`, la cui licenza non
consentiva di ridistribuire un APK che lo incorporasse; da quel giorno non è
più una dipendenza. Il modulo Media3 è stato scritto senza consultarne
l'implementazione.

Il carattere tipografico Manrope, in `assets/fonts/`, è Copyright 2018 The
Manrope Project Authors ed è distribuito sotto la
[SIL Open Font License 1.1](assets/fonts/OFL.txt). Viene incorporato nell'APK
dal config plugin di expo-font. La licenza OFL resta quella del font: la MIT di
Onda non lo rilicenzia.

Le icone dell'interfaccia vengono dal font Ionicons, di Ionic, sotto licenza
MIT, incorporato da `@expo/vector-icons`: l'app importa solo quel set, così gli
altri font di icone del pacchetto non entrano nella build. expo-router porta
nell'APK anche il font Material Symbols, di Google, sotto Apache License 2.0.

L'elenco completo di quanto l'APK incorpora, con licenza, titolare e testo di
ogni componente, è generato da `npm run notices` in
`assets/legal/third-party-notices.json` dalle dipendenze reali della build:
il classpath di release di Gradle e la source map del bundle JavaScript. La
CI verifica che corrisponda alle dipendenze correnti.

## Musica, metadati e artwork

Brani, registrazioni, composizioni, metadati e artwork ottenuti da Audius o
Jamendo non sono inclusi nella licenza MIT di Onda. Restano soggetti ai diritti
dei rispettivi titolari, alla licenza associata a ciascun contenuto e alle
condizioni della piattaforma che lo fornisce.

- L'accesso ai contenuti Audius è disciplinato dagli
  [API Terms](https://audius.co/legal/api-terms), dalla
  [Open Music License](https://audius.org/open-music-license.pdf) e dalle
  eventuali licenze o restrizioni selezionate dagli artisti. Audius ne
  riepiloga il funzionamento nel proprio
  [aggiornamento dei termini](https://blog.audius.co/posts/audius-terms-of-service-update).
- I contenuti Jamendo devono essere utilizzati nel rispetto della specifica
  licenza Creative Commons indicata per ciascun brano e dei
  [Jamendo API Terms](https://devportal.jamendo.com/api_terms_of_use). L'uso
  commerciale dell'API o dei contenuti richiede le autorizzazioni applicabili.

Chi modifica o distribuisce Onda è responsabile di mostrare le attribuzioni,
i collegamenti e le informazioni di licenza richiesti dalle sorgenti, nonché
di verificare che la propria modalità d'uso sia consentita.

Onda mostra nel player il nome della piattaforma e il backlink canonico del
brano. Per Jamendo mostra inoltre l'URL della licenza Creative Commons restituito
dall'API. Audius non include sempre nel modello pubblico tutti gli elementi di
attribuzione previsti per gli usi commerciali: Onda mostra il regime di diritti
ricevuto, la pagina canonica e un collegamento esplicito alla Open Music License.
Una distribuzione commerciale resta esclusa finché gli elementi mancanti non
sono disponibili o Audius non conferma per iscritto una rappresentazione
equivalente.

## API e credenziali

La licenza MIT non concede accesso alle API e non sostituisce i loro termini
d'uso. Ogni installazione o distribuzione deve usare credenziali ottenute
legittimamente dal rispettivo fornitore. Client ID, chiavi API e credenziali di
firma non fanno parte del Software concesso in licenza e non devono essere
pubblicati nel repository.

Onda non incorpora credenziali nel pacchetto installabile. Ogni persona
inserisce nell'app il proprio Client ID Jamendo, ottenuto registrando
un'applicazione sul portale Jamendo, e facoltativamente una propria API key
Audius; per leggere il catalogo Audius non servono credenziali. Chi registra
un'applicazione accetta in proprio i termini API del fornitore. Le credenziali
restano cifrate sul dispositivo e vanno solo al servizio a cui appartengono.

Il progetto non pubblica un APK condiviso: una futura distribuzione binaria
resta bloccata finché Jamendo non conferma questa architettura (vedi la
[nota di conformità](docs/RELEASE_COMPLIANCE.md)). Anche piano, quota e uso
commerciale devono essere compatibili con la distribuzione scelta.

## Screenshot dimostrativi

Gli screenshot versionati in `docs/screenshots/` usano nomi, titoli e artwork
creati per la documentazione. Non sono estratti dai cataloghi Audius o Jamendo e
non implicano la presenza di quei contenuti nell'app.

Il profilo esaminato, le fonti ufficiali, le decisioni di distribuzione e i
contatti ancora necessari sono registrati nella
[nota di conformità della release](docs/RELEASE_COMPLIANCE.md).

## Marchi e identità visiva

Audius, Jamendo e i rispettivi nomi, loghi e marchi appartengono ai loro
titolari. Il progetto Onda non è affiliato, approvato o sponsorizzato da tali
piattaforme.

Salvo diversa indicazione, il nome Onda e gli asset originali contenuti in
`assets/brand/` non sono concessi sotto la licenza MIT. Copyright © 2026
KairosIta. Tutti i diritti riservati su tali elementi.
