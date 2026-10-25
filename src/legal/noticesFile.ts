import raw from '../../assets/legal/third-party-notices.json';
import type { NoticesFile } from './notices';

/**
 * Il file generato da `npm run notices`, che Metro incorpora nel bundle
 * come modulo: si legge senza rete e senza file system, e il typecheck lo
 * confronta con il tipo. Sta in un file suo perche' Node, nei test, importa
 * JSON solo con un attributo che Metro non conosce: i test leggono il file
 * dal disco e provano le regole di `notices.ts` sullo stesso contenuto.
 */
export const NOTICES: NoticesFile = raw as NoticesFile;
