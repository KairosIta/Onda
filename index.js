// Entry point personalizzato.
//
// Expo Router normalmente usa "expo-router/entry" come main in package.json.
// Ma RN Track Player deve registrare il gestore background FUORI
// dall'albero React, all'avvio del processo: se lo registri dentro un
// componente il servizio muore appena l'app va in background, senza errori.
//
import TrackPlayer from '@rntp/player';
import { playbackService } from './src/services/playbackService';

TrackPlayer.registerBackgroundEventHandler(() => playbackService);

// L'entry registra il componente React: deve arrivare dopo il task headless.
require('expo-router/entry');
