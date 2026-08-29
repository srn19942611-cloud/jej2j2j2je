module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo tilføjer selv worklet-plugin'et til Reanimated,
  // når pakken er installeret.
  return {
    presets: ['babel-preset-expo'],
  };
};
