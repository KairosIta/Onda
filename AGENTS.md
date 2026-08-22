# Istruzioni per coding agent

## Obiettivo predefinito

Quando una persona chiede di installare Onda da questo repository, prepara una
build Android personale sul suo computer. Non pubblicare APK, release GitHub o
credenziali e non cambiare la visibilità del repository.

## Flusso obbligatorio

1. Leggi `README.md`, `docs/BUILD_PERSONAL.md` e
   `THIRD_PARTY_CONTENT.md` prima di modificare o compilare.
2. Rileva sistema operativo, shell e strumenti già presenti. Windows nativo è
   supportato; non imporre WSL. In WSL usa solo JDK e Android SDK installati e
   configurati dentro WSL.
3. Verifica Node.js >= 22.15, JDK 17, Android SDK Platform 36 e Build-Tools
   36.0.0. Chiedi consenso prima di installare software di sistema o scaricare
   componenti pesanti.
4. Esegui `npm ci`, poi `npm run setup:personal`. Non sovrascrivere un `.env`
   esistente.
5. Chiedi alla persona di inserire personalmente il proprio
   `EXPO_PUBLIC_JAMENDO_CLIENT_ID` in `.env`. Non stampare, copiare, committare
   o inviare il valore a servizi esterni.
6. Esegui `npm run doctor`; risolvi gli errori rilevati senza aggirare i
   controlli.
7. Con un solo dispositivo/emulatore autorizzato esegui
   `npm run install:personal`. Senza dispositivo esegui
   `npm run build:personal` e comunica il percorso dell'APK.
8. Riferisci i controlli eseguiti e ricorda che l'APK personale, firmato con
   una chiave debug locale, non deve essere ridistribuito.

## Vincoli del repository

- `.env`, `.onda/`, `credentials/`, `android/`, `ios/`, `dist/`, APK e AAB
  restano fuori da Git.
- Non sostituire `npm ci` con aggiornamenti indiscriminati delle dipendenze.
- Non usare `npm run release:android`: è la pipeline separata per una futura
  distribuzione ufficiale e richiede identità e firma del maintainer.
- Non rimuovere `ONDA_FORCE_DEBUG_RELEASE`: protegge anche il maintainer da una
  firma ufficiale accidentale durante una build personale.
- Usa gli script npm multipiattaforma; non introdurre comandi che funzionano
  soltanto in Bash se esiste un equivalente Node.js.
- Prima di proporre una modifica esegui almeno `npm test`, `npm run typecheck`,
  `npm run lint` e `npm run format:check`.
