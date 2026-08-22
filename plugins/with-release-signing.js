/**
 * Firma della build di release.
 *
 * La cartella android/ e' un artefatto di prebuild: e' in .gitignore e viene
 * rigenerata. Mettere la configurazione di firma direttamente in
 * app/build.gradle significherebbe perderla al primo `expo prebuild`, e
 * accorgersene solo mesi dopo pubblicando un APK firmato con la chiave di
 * debug. Quindi la iniettiamo da qui, e le credenziali vere restano in
 * credentials/, fuori dalla portata della rigenerazione.
 *
 * Una release di distribuzione e' fail-closed: senza credenziali valide non
 * viene prodotto alcun artefatto. Il fallback sulla debug key esiste solo per
 * prove locali e richiede ONDA_ALLOW_DEBUG_RELEASE=1.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

/**
 * Proprieta' di build della release. Stanno qui e non in gradle.properties
 * per lo stesso motivo della firma: android/ viene rigenerata.
 *
 * - reactNativeArchitectures: senza x86/x86_64 l'APK perde 41 MB di
 *   librerie native che servono solo agli emulatori. Nessun telefono le usa.
 * - enableMinifyInReleaseBuilds: R8 sui ~45 MB di dex.
 * - enableShrinkResourcesInReleaseBuilds: risorse mai referenziate.
 */
const GRADLE_PROPS = {
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
};

const MARKER = 'ondaKeystoreProps';

const DECLARATION = `
    // --- Onda: firma di release (iniettata da plugins/with-release-signing.js) ---
    def ondaCredsDir = new File(rootDir, "../credentials")
    def ondaKeystoreProps = new File(ondaCredsDir, "keystore.properties")
    def ondaForceDebugRelease = System.getenv("ONDA_FORCE_DEBUG_RELEASE") == "1"
    def ondaAllowDebugRelease = System.getenv("ONDA_ALLOW_DEBUG_RELEASE") == "1" || ondaForceDebugRelease
    def ondaSigned = ondaKeystoreProps.isFile() && !ondaForceDebugRelease
    def ondaProps = new Properties()
    def ondaStoreFile = null

    if (ondaSigned) {
        ondaKeystoreProps.withInputStream { ondaProps.load(it) }
        def ondaRequiredKeys = ["storeFile", "storePassword", "keyAlias", "keyPassword"]
        def ondaMissingKeys = ondaRequiredKeys.findAll { ondaKey ->
            !ondaProps.getProperty(ondaKey)?.trim()
        }
        if (!ondaMissingKeys.isEmpty()) {
            throw new GradleException("Onda: proprieta' di firma mancanti: " + ondaMissingKeys.join(", "))
        }

        def ondaCredsRoot = ondaCredsDir.canonicalFile
        ondaStoreFile = new File(ondaCredsRoot, ondaProps.getProperty("storeFile")).canonicalFile
        if (!ondaStoreFile.toPath().startsWith(ondaCredsRoot.toPath())) {
            throw new GradleException("Onda: storeFile deve restare dentro credentials/.")
        }
        if (!ondaStoreFile.isFile()) {
            throw new GradleException("Onda: il keystore configurato non esiste.")
        }
    } else if (ondaForceDebugRelease) {
        logger.warn("Onda: build personale forzata sulla debug key; eventuali credenziali ufficiali sono ignorate.")
    } else if (ondaAllowDebugRelease) {
        logger.warn("Onda: fallback locale esplicito sulla debug key; l'artefatto NON e' distribuibile.")
    }

    gradle.taskGraph.whenReady { ondaGraph ->
        def ondaReleaseArtifactRequested = ondaGraph.allTasks.any { ondaTask ->
            def ondaTaskName = ondaTask.name.toLowerCase(Locale.ROOT)
            ondaTask.project == project &&
                ondaTaskName.contains("release") &&
                ["assemble", "bundle", "package", "install"].any { ondaPrefix ->
                    ondaTaskName.startsWith(ondaPrefix)
                }
        }
        if (ondaReleaseArtifactRequested && !ondaSigned && !ondaAllowDebugRelease) {
            throw new GradleException(
                "Onda: release bloccata. Configura credentials/keystore.properties oppure, solo per test locali, imposta ONDA_ALLOW_DEBUG_RELEASE=1."
            )
        }
    }
`;

const RELEASE_CONFIG = `
        if (ondaSigned) {
            release {
                storeFile ondaStoreFile
                storePassword ondaProps.getProperty('storePassword')
                keyAlias ondaProps.getProperty('keyAlias')
                keyPassword ondaProps.getProperty('keyPassword')
            }
        }
`;

function patch(contents) {
  if (contents.includes(MARKER)) return contents;

  let out = contents;

  // 1. Le variabili vanno dichiarate prima del blocco che le usa.
  const anchor = '    signingConfigs {';
  if (!out.includes(anchor)) {
    throw new Error(
      'with-release-signing: non trovo il blocco signingConfigs in app/build.gradle.',
    );
  }
  out = out.replace(anchor, `${DECLARATION}${anchor}`);

  // 2. Il signingConfig di release, accanto a quello di debug.
  const debugConfigEnd = `            keyPassword 'android'\n        }\n`;
  if (!out.includes(debugConfigEnd)) {
    throw new Error('with-release-signing: non trovo la fine del signingConfig di debug.');
  }
  out = out.replace(debugConfigEnd, `${debugConfigEnd}${RELEASE_CONFIG}`);

  // 3. Il buildType release smette di firmare con la chiave di debug.
  //    Il commento sopra la riga la rende univoca: la stessa istruzione
  //    compare anche nel buildType debug, dove va lasciata com'e'.
  const releaseUse =
    '            // Caution! In production, you need to generate your own keystore file.\n' +
    '            // see https://reactnative.dev/docs/signed-apk-android.\n' +
    '            signingConfig signingConfigs.debug';
  if (!out.includes(releaseUse)) {
    throw new Error('with-release-signing: non trovo il signingConfig del buildType release.');
  }
  out = out.replace(
    releaseUse,
    '            signingConfig ondaSigned ? signingConfigs.release : (ondaAllowDebugRelease ? signingConfigs.debug : null)',
  );

  return out;
}

module.exports = function withReleaseSigning(config) {
  let out = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-release-signing: atteso build.gradle in Groovy.');
    }
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });

  return withGradleProperties(out, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPS)) {
      const existing = cfg.modResults.find((i) => i.type === 'property' && i.key === key);
      if (existing) existing.value = value;
      else cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
};

module.exports.patch = patch;
