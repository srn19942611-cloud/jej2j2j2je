// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite kører som WebAssembly i browseren (`npm run web`); på Android
// er linjen uden virkning.
config.resolver.assetExts.push('wasm');

module.exports = config;
