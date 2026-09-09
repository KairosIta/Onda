/**
 * Dichiara Onda come app multimediale per Android Auto.
 *
 * Il servizio di RNTP espone gia' l'intent filter MediaBrowserService;
 * quello che manca, e che Android Auto pretende per elencare l'app, e' il
 * descrittore `automotive_app_desc` referenziato dal manifest. La cartella
 * android/ e' rigenerata dal prebuild, quindi la risorsa si scrive da qui.
 *
 * Appena il manifest porta quel descrittore, Android Lint accende due
 * controlli in piu' (AndroidAutoDetector), entrambi come errore ed entrambi
 * letti sul solo manifest sorgente dell'app, non su quello unito:
 *
 * - MissingMediaBrowserServiceIntentFilter vuole un <service> con l'azione
 *   android.media.browse.MediaBrowserService. C'e', ma nel manifest della
 *   libreria RNTP, che il detector non guarda: falso positivo.
 * - MissingIntentFilterForMediaSearch vuole un intent filter per
 *   android.media.action.MEDIA_PLAY_FROM_SEARCH, cioe' la ricerca vocale
 *   ("metti jazz su Onda"). Manca davvero: RNTP non inoltra a JS le
 *   ricerche della sessione media e l'app non legge la query dall'intent di
 *   avvio. Dichiarare il filtro senza gestirlo aprirebbe Onda a vuoto, quindi
 *   resta un'esclusione dichiarata finche' la voce in TODO.md non si chiude.
 *
 * L'albero che l'auto mostra lo costruisce `src/services/browseTree.ts`.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withFinalizedMod } = require('expo/config-plugins');

const META_NAME = 'com.google.android.gms.car.application';
const RESOURCE = 'automotive_app_desc';
const TOOLS_NS = 'http://schemas.android.com/tools';
const LINT_IGNORES = [
  'MissingMediaBrowserServiceIntentFilter',
  'MissingIntentFilterForMediaSearch',
];

const AUTOMOTIVE_APP_DESC = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media" />
</automotiveApp>
`;

/** Aggiunge id a un `tools:ignore` esistente senza doppioni ne' perdite. */
function mergeToolsIgnore(existing, ids) {
  const merged = new Set(
    String(existing ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
  for (const id of ids) merged.add(id);
  return [...merged].join(',');
}

/** La parte pura del plugin: lavora sul manifest gia' letto, cosi' si collauda. */
function declareAutomotiveMediaApp(manifest) {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  AndroidConfig.Manifest.addMetaDataItemToMainApplication(
    application,
    META_NAME,
    `@xml/${RESOURCE}`,
    'resource',
  );
  manifest.manifest.$['xmlns:tools'] ??= TOOLS_NS;
  application.$['tools:ignore'] = mergeToolsIgnore(application.$['tools:ignore'], LINT_IGNORES);
  return manifest;
}

module.exports = function withAndroidAuto(config) {
  let out = withAndroidManifest(config, (cfg) => {
    declareAutomotiveMediaApp(cfg.modResults);
    return cfg;
  });

  out = withFinalizedMod(out, [
    'android',
    async (cfg) => {
      const xmlRoot = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      await fs.mkdir(xmlRoot, { recursive: true });
      await fs.writeFile(path.join(xmlRoot, `${RESOURCE}.xml`), AUTOMOTIVE_APP_DESC, 'utf8');
      return cfg;
    },
  ]);

  return out;
};

module.exports.LINT_IGNORES = LINT_IGNORES;
module.exports.mergeToolsIgnore = mergeToolsIgnore;
module.exports.declareAutomotiveMediaApp = declareAutomotiveMediaApp;
