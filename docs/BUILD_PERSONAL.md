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
- un Client ID personale creato su
  [Jamendo Developer Portal](https://devportal.jamendo.com/).

La prima build può scaricare NDK e CMake e richiedere diversi gigabyte. Expo Go
non è compatibile con i moduli nativi usati da Onda.

## Linux

Configura `ANDROID_HOME` verso il tuo SDK; il percorso Android Studio più comune
è `$HOME/Android/Sdk`.

```bash
git clone https://github.com/KairosIta/Onda.git
cd Onda
npm ci
npm run setup:personal
```

Modifica `.env`, quindi:

```bash
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
npm run setup:personal
notepad .env
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

| Comando                    | Effetto                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run setup:personal`   | Crea `.env` dal modello solo se manca.                              |
| `npm run doctor`           | Controlla versioni, SDK, dipendenze e configurazione Jamendo.       |
| `npm run build:personal`   | Esegue qualità, prebuild, Android Lint e crea l'APK standalone.     |
| `npm run install:personal` | Ricompila e installa su un unico dispositivo/emulatore autorizzato. |

Gli output sono `dist/personal/Onda-personal.apk` e il manifest con hash
`dist/personal/Onda-personal.json`; entrambi sono ignorati da Git. La pipeline
verifica che il bundle standalone sia presente e rifiuta un certificato che
coincida con l'identità di release ufficiale, anche sul computer del maintainer.

La prima build crea `.onda/personal-debug.keystore` e le successive riusano la
stessa chiave, così Android può installare gli aggiornamenti senza cancellare i
dati. La directory è ignorata da Git: non condividerla. Se vuoi conservare la
possibilità di aggiornare la stessa installazione, fanne un backup privato; se
la perdi, dovrai disinstallare la vecchia copia prima di usare una nuova firma.

## Problemi comuni

**`Jamendo Client ID` fallisce.** Apri `.env` e sostituisci completamente il
valore `inserisci_il_tuo_client_id`. Le variabili `EXPO_PUBLIC_*` entrano
nell'APK: usa solo il tuo identificativo personale e non considerarlo segreto.

**Java non è 17.** Correggi `JAVA_HOME` o la priorità nel `PATH`. Versioni più
nuove non sono considerate equivalenti dalla pipeline verificata.

**SDK non trovato.** Imposta `ANDROID_HOME` alla directory dello SDK e riapri
il terminale. Installa esattamente `platforms;android-36` e
`build-tools;36.0.0` da SDK Manager o `sdkmanager`.

**Nessun dispositivo.** Controlla `adb devices`, accetta la richiesta RSA sul
telefono oppure avvia un emulatore. Se compaiono più dispositivi, fermane uno o
usa soltanto `npm run build:personal` e installa manualmente l'APK scelto.

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
