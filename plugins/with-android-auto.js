/**
 * Dichiara Onda come app multimediale per Android Auto.
 *
 * Il servizio di RNTP espone gia' l'intent filter MediaBrowserService;
 * quello che manca, e che Android Auto pretende per elencare l'app, e' il
 * descrittore `automotive_app_desc` referenziato dal manifest. La cartella
 * android/ e' rigenerata dal prebuild, quindi la risorsa si scrive da qui.
 *
 * L'albero che l'auto mostra lo costruisce `src/services/browseTree.ts`.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withFinalizedMod } = require('expo/config-plugins');

const META_NAME = 'com.google.android.gms.car.application';
const RESOURCE = 'automotive_app_desc';

const AUTOMOTIVE_APP_DESC = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="media" />
</automotiveApp>
`;

module.exports = function withAndroidAuto(config) {
  let out = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      application,
      META_NAME,
      `@xml/${RESOURCE}`,
      'resource',
    );
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
