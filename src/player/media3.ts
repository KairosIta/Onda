import { AppState } from 'react-native';
import OndaPlayer from '../../modules/onda-player';
import { createMedia3Backend } from './media3Backend';

/**
 * Il backend del player: il modulo nostro su Media3. Deve restare l'unico
 * file dell'app che importa `modules/onda-player`; nei test in Node al suo
 * posto c'e' il player finto (`scripts/test-doubles.mjs`).
 */
export const backend = createMedia3Backend(OndaPlayer, AppState);
