// module.exports = {
//   presets: ['module:@react-native/babel-preset'],
// };

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      "module:react-native-dotenv",
      {
        moduleName: "@env",
        path: ".env",
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true,
        verbose: false
      }
    ],
    "@babel/plugin-transform-export-namespace-from",
    "babel-plugin-transform-import-meta",
    [
      "babel-plugin-transform-define",
      {
        "import.meta.env": "process.env"
      }
    ]
  ]
};