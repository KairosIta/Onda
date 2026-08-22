/**
 * Correzioni e configurazione Lint per il progetto Android generato.
 *
 * `android/` e' un artefatto di Expo prebuild, quindi queste regole devono
 * vivere in un config plugin per sopravvivere a `expo prebuild --clean`.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { AndroidConfig, withAndroidManifest, withFinalizedMod } = require('expo/config-plugins');

const DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const LAUNCHER_ICONS = [
  'ic_launcher',
  'ic_launcher_foreground',
  'ic_launcher_monochrome',
  'ic_launcher_round',
];

const LINT_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<lint>
    <!-- Le versioni Fresco sono governate dall'Expo SDK, non dall'app. -->
    <issue id="NewerVersionAvailable">
        <ignore regexp="com[.]facebook[.]fresco:(animated-gif|webpsupport)" />
    </issue>

    <!-- Drawable di compatibilita' generato dal template React Native. -->
    <issue id="PrivateResource">
        <ignore path="src/main/res/drawable/rn_edit_text_material.xml" />
    </issue>

    <!-- Risorse generate o lette dinamicamente da Expo/React Native. -->
    <issue id="UnusedResources">
        <ignore regexp="react_native_dev_server_(port|ip)" />
        <ignore regexp="expo_system_ui_user_interface_style" />
        <ignore regexp="expo_splash_screen_resize_mode" />
        <ignore regexp="splashscreen_background" />
        <ignore path="src/main/res/drawable/ic_launcher_background.xml" />
    </issue>
</lint>
`;

async function fixGeneratedLauncherExtensions(platformProjectRoot) {
  const resRoot = path.join(platformProjectRoot, 'app', 'src', 'main', 'res');

  for (const density of DENSITIES) {
    const directory = path.join(resRoot, `mipmap-${density}`);
    for (const icon of LAUNCHER_ICONS) {
      const generatedPath = path.join(directory, `${icon}.webp`);
      const correctedPath = path.join(directory, `${icon}.png`);

      try {
        await fs.access(generatedPath);
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }

      await fs.rm(correctedPath, { force: true });
      await fs.rename(generatedPath, correctedPath);
    }
  }
}

function patchSplashStyles(contents) {
  const splashBehavior = '<item name="android:windowSplashScreenBehavior">icon_preferred</item>';
  const apiScopedSplashBehavior =
    '<item name="android:windowSplashScreenBehavior" tools:targetApi="33">icon_preferred</item>';

  return contents.replace(splashBehavior, apiScopedSplashBehavior);
}

async function fixGeneratedSplashStyles(platformProjectRoot) {
  const stylesPath = path.join(
    platformProjectRoot,
    'app',
    'src',
    'main',
    'res',
    'values',
    'styles.xml',
  );

  let contents;
  try {
    contents = await fs.readFile(stylesPath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  const patched = patchSplashStyles(contents);
  if (patched !== contents) await fs.writeFile(stylesPath, patched, 'utf8');
}

module.exports = function withAndroidQuality(config) {
  let out = withAndroidManifest(config, (cfg) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);

    // L'attributo e' volutamente usato solo da Android 13 in poi.
    application.$['tools:targetApi'] = '33';

    // `unspecified` non blocca la rotazione, ma Lint lo tratta comunque come
    // orientamento fisso: l'assenza dell'attributo esprime meglio l'intento.
    delete mainActivity.$['android:screenOrientation'];

    // Queste non sono richieste di permesso: `tools:node="remove"` elimina le
    // dichiarazioni portate dalle dipendenze. La regola ScopedStorage non
    // distingue il nodo di rimozione da un vero uses-permission.
    for (const permission of cfg.modResults.manifest['uses-permission'] ?? []) {
      const isLegacyStoragePermission = [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ].includes(permission.$['android:name']);

      if (isLegacyStoragePermission && permission.$['tools:node'] === 'remove') {
        permission.$['tools:ignore'] = 'ScopedStorage';
      }
    }

    return cfg;
  });

  out = withFinalizedMod(out, [
    'android',
    async (cfg) => {
      const appRoot = path.join(cfg.modRequest.platformProjectRoot, 'app');
      await fs.writeFile(path.join(appRoot, 'lint.xml'), LINT_CONFIG, 'utf8');
      await fixGeneratedLauncherExtensions(cfg.modRequest.platformProjectRoot);
      await fixGeneratedSplashStyles(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);

  return out;
};

module.exports.patchSplashStyles = patchSplashStyles;
