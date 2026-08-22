# Contenuti e servizi di terze parti

La [licenza MIT](LICENSE) di Onda si applica al codice sorgente e alla
documentazione originali identificati come parte di Onda. Non concede alcun
diritto sul software, sui contenuti o sui servizi di terze parti.

## Software di terze parti

Le dipendenze non sono rilicenziate sotto MIT. `npm ci` le scarica dai relativi
registri e ogni dipendenza conserva la propria licenza.

In particolare, Onda usa `@rntp/player@5.8.0`. Il file `license.txt` distribuito
nel pacchetto da Double Symmetry concede uso gratuito soltanto a privati per
scopi personali e non professionali, oppure a istituzioni accademiche
qualificate per didattica o ricerca non commerciale. Aziende, organizzazioni
non profit, enti pubblici e qualsiasi altro uso richiedono una
[licenza commerciale RNTP](https://rntp.dev/pricing). La MIT di Onda non
modifica né amplia questi diritti.

Il repository non include né modifica il sorgente RNTP: dichiara soltanto la
dipendenza npm. Questo non autorizza a ridistribuire RNTP o un APK che lo
incorpora.

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

Il Client ID Jamendo usato da un'app mobile è necessariamente presente nel
pacchetto installabile. Ogni clone deve quindi usare un Client ID ottenuto dal
proprio utilizzatore. Il progetto non pubblica un APK condiviso: una futura
distribuzione binaria resta bloccata finché Jamendo non conferma l'architettura
oppure viene adottato un servizio intermediario autorizzato. Anche piano, quota
e uso commerciale devono essere compatibili con la distribuzione scelta.

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
