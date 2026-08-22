/**
 * Esclude esplicitamente tutti i dati di Onda dai backup Android.
 *
 * `allowBackup=false` basta per il cloud sui dispositivi standard, ma su
 * Android 12+ alcuni produttori possono continuare il trasferimento diretto
 * tra telefoni. Le due risorse XML coprono quindi sia Android 11 e precedenti
 * sia cloud e device-to-device su Android 12+.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withFinalizedMod } = require('expo/config-plugins');

const DOMAINS = [
  'root',
  'file',
  'database',
  'sharedpref',
  'external',
  'device_root',
  'device_file',
  'device_database',
  'device_sharedpref',
];

const exclusions = (indent) =>
  DOMAINS.map((domain) => `${indent}<exclude domain="${domain}" path="." />`).join('\n');

const FULL_BACKUP_CONTENT = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
${exclusions('    ')}
</full-backup-content>
`;

const DATA_EXTRACTION_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
${exclusions('        ')}
    </cloud-backup>
    <device-transfer>
${exclusions('        ')}
    </device-transfer>
</data-extraction-rules>
`;

module.exports = function withAndroidPrivacy(config) {
  let out = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = '@xml/onda_backup_rules';
    application.$['android:dataExtractionRules'] = '@xml/onda_data_extraction_rules';
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
      await Promise.all([
        fs.writeFile(path.join(xmlRoot, 'onda_backup_rules.xml'), FULL_BACKUP_CONTENT, 'utf8'),
        fs.writeFile(
          path.join(xmlRoot, 'onda_data_extraction_rules.xml'),
          DATA_EXTRACTION_RULES,
          'utf8',
        ),
      ]);
      return cfg;
    },
  ]);

  return out;
};

module.exports.DOMAINS = DOMAINS;
module.exports.FULL_BACKUP_CONTENT = FULL_BACKUP_CONTENT;
module.exports.DATA_EXTRACTION_RULES = DATA_EXTRACTION_RULES;
