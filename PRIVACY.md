# Informativa privacy di Onda

**Versione:** 1.1 — **in vigore dal 22 agosto 2026**

Questa informativa descrive il funzionamento delle copie personali dell'app
Android Onda compilate dal progetto
[KairosIta/Onda](https://github.com/KairosIta/Onda). Il progetto pubblica il
sorgente, non un APK ufficiale. Il codice originale Onda è sotto MIT; il player
nativo usa una licenza separata. L'app non ha account proprietario, backend,
pubblicità o sistemi di profilazione gestiti dal progetto.

## Dati conservati sul dispositivo

Onda salva nello spazio privato dell'app:

- preferiti, cronologia degli ultimi brani e playlist;
- metadati necessari a ritrovare i brani salvati;
- preferenze di riproduzione, come shuffle e ripetizione.

Questi dati servono unicamente a offrire le funzioni richieste nell'app. Onda
non include SDK di analytics, pubblicità o crash reporting e il progetto non
riceve automaticamente una copia di questi dati.

## Backup Android

Onda disabilita il backup Android dell'app e definisce esclusioni esplicite per
tutti i domini di archiviazione, sia nel backup cloud sia nel trasferimento
diretto tra dispositivi. Questa scelta evita che libreria e preferenze vengano
copiate automaticamente fuori dal dispositivo tramite le funzioni di backup
supportate da Android.

## Dati trasmessi ai servizi musicali

Onda deve connettersi a servizi esterni per mostrare e riprodurre i cataloghi:

- le ricerche e le richieste di catalogo sono inviate ad Audius e/o Jamendo;
- audio, artwork e altri metadati sono scaricati da Audius, Jamendo o dai loro
  host di contenuti;
- aprendo nell'app un collegamento esterno, la pagina viene gestita dal browser
  scelto sul dispositivo.

Come in ogni comunicazione Internet, questi fornitori possono ricevere dati
tecnici quali indirizzo IP, data e ora, contenuto della richiesta, identificativi
tecnici del client e informazioni di rete. Jamendo dichiara inoltre di poter
registrare i brani ascoltati. Il progetto Onda non usa tali dati per identificare
l'utente e non li riceve dai fornitori.

Il trattamento svolto dai fornitori è disciplinato dalle loro informative:

- [Informativa privacy Audius](https://audius.co/documents/PrivacyPolicy.pdf)
- [Informativa privacy Jamendo](https://licensing.jamendo.com/en/legal/privacypolicy)

Audius può trattare dati negli Stati Uniti e descrive nella propria informativa
le basi giuridiche, i tempi di conservazione, i trasferimenti internazionali e i
diritti disponibili. Jamendo S.A. opera dal Lussemburgo e descrive nella propria
informativa finalità, conservazione e diritti degli interessati.

## Permessi Android

Onda usa l'accesso a Internet per catalogo e streaming. Usa inoltre il servizio
multimediale in primo piano, il wake lock e, su Android 13 o successivi, può
chiedere il permesso notifiche per mantenere visibili i controlli del player.
Non richiede accesso a posizione, microfono, fotocamera, contatti o archivio
multimediale condiviso.

## Conservazione ed eliminazione

I dati locali restano finché l'utente non elimina i singoli elementi, cancella
l'archiviazione di Onda dalle impostazioni Android o disinstalla l'app. La
cronologia conserva al massimo 100 brani. Poiché Onda non gestisce un account o
un backend, il progetto non conserva una copia remota da cancellare.

Le richieste conservate dai servizi musicali seguono invece i rispettivi tempi
di conservazione e possono essere oggetto dei diritti e dei contatti indicati
nelle informative collegate sopra.

## Contenuti e licenze

Musica, artwork e metadati restano soggetti ai diritti degli artisti e alle
condizioni del servizio che li fornisce. La provenienza e il collegamento alla
pagina originale sono mostrati nel player; per i brani Jamendo viene mostrato
anche il collegamento alla specifica licenza Creative Commons fornita dall'API.
Per Audius viene mostrato il regime di diritti restituito dall'API e il
collegamento alla Open Music License applicabile ai contenuti via API.
Consulta anche [Contenuti e servizi di terze parti](THIRD_PARTY_CONTENT.md).

## Modifiche e contatti

Le modifiche a questa informativa vengono pubblicate nel repository insieme a
una nuova data di entrata in vigore. Per domande, richieste o segnalazioni è
possibile aprire una [issue pubblica del progetto](https://github.com/KairosIta/Onda/issues).
Non inserire dati personali o sensibili in una issue pubblica.
