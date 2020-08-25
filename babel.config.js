module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
        [
          'module-resolver',
          {
            root: ['./src'],
            alias: {
              components: './src/components',
              constants: './src/constants',
              assets: './src/assets',
              hooks: './src/hooks',
              types: './src/types',
              navigation: './src/navigation',
              screens: './src/screens',
              utils: './src/utils',
            },
          },
        ],
        [
          'babel-plugin-inline-import',
          {
            extensions: ['.svg'],
          },
        ],
      ],
  };
};
