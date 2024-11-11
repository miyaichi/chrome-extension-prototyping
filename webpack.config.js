// webpack.config.js
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    popup: './src/popup/index.tsx',
    background: './src/background/background.ts',
    contentScript: './src/contentScript/contentScript.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'public', to: '.' },
        { from: 'manifest.json', to: '.' },
      ],
    }),
  ],
};
