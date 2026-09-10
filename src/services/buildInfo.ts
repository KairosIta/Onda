import Constants from 'expo-constants';
import { type BuildInfo, type BuildManifest, parseBuildInfo } from './buildInfoSchema';

/**
 * L'unica riga di questo modulo che non si puo' provare in Node: chiedere
 * a expo-constants il manifest di questa build. Tutto il resto — la
 * lettura difensiva dei campi e la frase per la schermata Informazioni —
 * vive in `buildInfoSchema`, dove i test lo raggiungono.
 */
export function readBuildInfo(): BuildInfo {
  return parseBuildInfo(Constants.expoConfig as BuildManifest | null);
}

export { type BuildInfo, describeBuild } from './buildInfoSchema';
