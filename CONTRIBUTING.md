# Contribuire a Onda

Issue e pull request mirate sono benvenute. Prima di iniziare una modifica
importante, apri una issue per concordare comportamento e compatibilità.

1. Leggi `AGENTS.md` e `THIRD_PARTY_CONTENT.md`.
2. Installa con `npm ci` e configura una credenziale Jamendo personale in
   `.env`; non inserirla mai in commit, log o screenshot.
3. Mantieni Linux e Windows compatibili: preferisci script Node.js a comandi
   specifici di Bash o PowerShell.
4. Esegui `npm test`, `npm run typecheck`, `npm run lint` e
   `npm run format:check`.
5. Per modifiche native esegui anche `npm run build:personal` e descrivi
   dispositivo/API Android e risultato del collaudo.

Non allegare APK personali alle issue o alle pull request. Non includere musica,
artwork, marchi o dati personali di terzi nei fixture e negli screenshot.

Contribuendo dichiari di avere il diritto di inviare il materiale e accetti che
il codice e la documentazione originali siano distribuiti sotto MIT. Dipendenze,
brand e contenuti di terzi conservano le rispettive licenze.
