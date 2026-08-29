// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const config = getDefaultConfig(__dirname);

// expo-sqlite kører som WebAssembly i browseren (`npm run web`); på Android
// er linjen uden virkning.
config.resolver.assetExts.push('wasm');

// Node-moduler findes ikke i React Native. Se src/shims/node-empty.js.
const NODE_STUB = path.resolve(__dirname, 'src/shims/node-empty.js');
const STUBBED = new Set(['fs', 'path', 'os', 'crypto', 'stream', 'zlib', 'http', 'https', 'net', 'tls', 'child_process']);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const bare = moduleName.startsWith('node:') ? moduleName.slice(5) : null;
  if (bare && STUBBED.has(bare)) {
    return { type: 'sourceFile', filePath: NODE_STUB };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
