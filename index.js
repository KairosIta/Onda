// Entry point personalizzato.
//
// Expo Router normalmente usa "expo-router/entry" come main in package.json.
// Ma il gestore background del player va registrato FUORI dall'albero
// React, all'avvio del processo: se lo registri dentro un componente il
// servizio muore appena l'app va in background, senza errori.
//
import { player } from './src/player';
import { playbackService } from './src/services/playbackService';

player.registerBackgroundHandler(playbackService);

// L'entry registra il componente React: deve arrivare dopo il task headless.
require('expo-router/entry');
