// La configurazione di Metro e' quella di Expo. L'unica aggiunta e' la
// versione della cache, che segue i valori EXPO_PUBLIC_*: senza, un Client
// ID cambiato in .env poteva restare quello vecchio nel bundle (vedi
// scripts/metro-cache-version.cjs).
const { getDefaultConfig } = require('expo/metro-config');
const { metroCacheVersion } = require('./scripts/metro-cache-version.cjs');

const config = getDefaultConfig(__dirname);
config.cacheVersion = metroCacheVersion(process.env, config.cacheVersion);

module.exports = config;
