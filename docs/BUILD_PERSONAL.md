# Build Android personale

Questa guida produce un APK standalone con il bundle JavaScript incluso: Metro
non deve restare acceso. L'APK è firmato con una chiave personale generata sul
computer locale ed è destinato esclusivamente ai dispositivi di chi compila.

## Requisiti

- Node.js 22.15 o successivo e npm;
- JDK 17;
- Android Studio con Android SDK Platform 36, Build-Tools 36.0.0 e
  Platform-Tools;
- per un telefono fisico: opzioni sviluppatore e debug USB abilitati;
- per Jamendo, un Client ID personale creato su
  [Jamendo Developer Portal](https://devportal.jamendo.com/). Non serve alla
  build: si inserisce nell'app al primo avvio (vedi [Primo avvio](#primo-avvio)).

La prima build può scaricare NDK e CMake e richiedere diversi gigabyte. Expo Go
non è compatibile con i moduli nativi usati da Onda.

## Linux

Configura `ANDROID_HOME` verso il tuo SDK; il percorso Android Studio più comune
è `$HOME/Android/Sdk`.

Su Debian 13 e derivate `apt` offre solo OpenJDK 21 e 25: installa Temurin 17
da [Adoptium](https://adoptium.net/temurin/releases/?version=17), come archivio
nella home o dal loro repository apt, e punta `JAVA_HOME` lì.

```bash
git clone https://github.com/KairosIta/Onda.git
cd Onda
npm ci
npm run doctor
npm run install:personal
```

## Windows nativo

Installa Android Studio, seleziona JDK 17 e aggiungi da SDK Manager Platform 36,
Build-Tools 36.0.0 e Platform-Tools. In PowerShell:

```powershell
git clone https://github.com/KairosIta/Onda.git
Set-Location Onda
npm ci
npm run doctor
npm run install:personal
```

Lo script trova automaticamente l'SDK nella posizione standard
`%LOCALAPPDATA%\Android\Sdk`; in installazioni personalizzate imposta
`ANDROID_HOME`. Gestisce da solo `npm.cmd`, `npx.cmd`, `gradlew.bat` e
`adb.exe`.

## WSL2

WSL2 funziona soltanto se Node, JDK 17 e Android SDK sono installati anche nella
distribuzione Linux e il dispositivo è visibile da `adb` in quell'ambiente. Non
riutilizzare alla cieca SDK o `node_modules` di Windows. Per chi vuole soltanto
compilare e installare Onda, PowerShell nativo ha meno punti di rottura.

## Comandi

| Comando                    | Effetto                                                                         |
| -------------------------- | ------------------------------------------------------------------------------- |
| `npm run setup:personal`   | Segnala credenziali rimaste in `.env`: non c'è altro da preparare.              |
| `npm run doctor`           | Controlla versioni, SDK, dipendenze e che nessuna credenziale entri nel bundle. |
| `npm run build:personal`   | Esegue qualità, prebuild, Android Lint e crea l'APK standalone.                 |
| `npm run install:personal` | Ricompila e installa su un unico dispositivo/emulatore autorizzato.             |
| `npm run check:installed`  | Dice se il telefono collegato ha gia' questo commit, senza compilare.           |

Gli output sono `dist/personal/Onda-personal.apk` e il manifest con hash
`dist/personal/Onda-personal.json`; entrambi sono ignorati da Git. La pipeline
verifica che il bundle standalone sia presente e rifiuta un certificato che
coincida con l'identità di release ufficiale, anche sul computer del maintainer.

L'APK personale porta il commit nel nome di versione, per esempio
`0.2.0+68d225e`, con `.dirty` in coda se il worktree non era pulito. Lo
leggi dalla schermata Informazioni dell'app, oppure da fuori con
`npm run check:installed`, che confronta il telefono con il repository e non
compila niente.

La prima build crea `.onda/personal-debug.keystore` e le successive riusano la
stessa chiave, così Android può installare gli aggiornamenti senza cancellare i
dati. La directory è ignorata da Git: non condividerla. Se vuoi conservare la
possibilità di aggiornare la stessa installazione, fanne un backup privato; se
la perdi, dovrai disinstallare la vecchia copia prima di usare una nuova firma.

## Primo avvio

Onda non incorpora credenziali. Al primo avvio una schermata di benvenuto
spiega le sorgenti:

- **Audius** funziona subito, senza dati da inserire. Una API key Audius è
  facoltativa: alza i limiti di richieste.
- **Jamendo** parte quando inserisci il tuo Client ID. Onda lo verifica con una
  sola richiesta prima di salvarlo; se Jamendo lo rifiuta non lo salva.

Con «Salta per ora» parti con il solo Audius: in Scopri resta un invito ad
aggiungere Jamendo finché non lo configuri o non lo chiudi. Credenziali e
interruttori delle sorgenti si cambiano da Libreria › Sorgenti. Le credenziali
restano cifrate sul telefono (Keystore Android), fuori da backup ed export, e
si cancellano disinstallando l'app.

## Problemi comuni

**`Credenziali nel bundle` fallisce.** `.env` contiene ancora una variabile come
`EXPO_PUBLIC_JAMENDO_CLIENT_ID`, che le versioni precedenti usavano per la
build. Inserisci il Client ID nell'app (Libreria › Sorgenti), poi togli la riga
o l'intero `.env`: le variabili `EXPO_PUBLIC_*` finirebbero in chiaro nell'APK.

**Jamendo rifiuta il Client ID.** Controlla sul
[portale Jamendo](https://devportal.jamendo.com/) di aver copiato il Client ID
dell'applicazione, non il secret. «Applicazione sospesa» va risolto con Jamendo;
«limite di richieste superato» passa da solo.

**Java non è 17.** Correggi `JAVA_HOME` o la priorità nel `PATH`. Versioni più
nuove non sono considerate equivalenti dalla pipeline verificata.

**`sdkmanager` segnala di essere deprecato.** Dalle command-line tools 23
Google lo sostituisce con «Android CLI», nella stessa cartella:
`android sdk install platform-tools "platforms;android-36" "build-tools;36.0.0"`.
`sdkmanager` funziona ancora; il nuovo strumento non chiede di accettare la
licenza a schermo, ma la registra in `licenses/` durante l'installazione.

**SDK non trovato.** Imposta `ANDROID_HOME` alla directory dello SDK e riapri
il terminale. Installa esattamente `platforms;android-36` e
`build-tools;36.0.0` da SDK Manager o `sdkmanager`.

**Nessun dispositivo.** Controlla `adb devices`, accetta la richiesta RSA sul
telefono oppure avvia un emulatore. Se compaiono più dispositivi, fermane uno o
usa soltanto `npm run build:personal` e installa manualmente l'APK scelto.

**TypeScript rifiuta una rotta che esiste.** I tipi delle rotte stanno in
`.expo/types/router.d.ts`, un file generato e ignorato da Git che un vecchio
`expo start` può lasciare indietro rispetto alle schermate nel repository.
`npm run typecheck` lo rigenera da solo; se lanci `tsc` a mano, prima esegui
`npx expo customize tsconfig.json`.

**Firma incompatibile durante l'installazione.** Una copia precedente può
essere firmata da un altro computer. Disinstallarla elimina anche i dati locali;
fallo soltanto dopo aver deciso che preferiti e playlist non servono più.

## Limiti legali

Il sorgente originale Onda è MIT, ma una build funzionante scarica anche
`@rntp/player`, che usa una licenza separata. La versione corrente è gratuita
solo per uso personale privato o per specifico uso didattico/ricerca accademica;
aziende, organizzazioni non profit, enti pubblici e ogni altro uso richiedono
una licenza commerciale. API e contenuti hanno condizioni ulteriori: leggi
[`THIRD_PARTY_CONTENT.md`](../THIRD_PARTY_CONTENT.md).
