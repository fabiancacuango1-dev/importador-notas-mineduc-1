const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const WebpackObfuscator = require("webpack-obfuscator");

const ROOT = path.resolve(__dirname, "..", "..");
const DIST = path.resolve(ROOT, "installer", "dist", "extension");

// Archivos JS del content_scripts (orden del manifest)
const CONTENT_SCRIPTS = [
  "licenseGuard.js",
  "license.js",
  "activate.js",
  "paymentModal.js",
  "premiumUI.js",
  "formatHandler.js",
  "bulkUploader.js",
  "civicaAutoFill.js",
  "content.js",
];

// Generar entries dinámicamente
const entry = {};
CONTENT_SCRIPTS.forEach((file) => {
  const name = path.basename(file, ".js");
  entry[name] = path.resolve(ROOT, file);
});

// Popup separado
entry["popup"] = path.resolve(ROOT, "popup.js");

module.exports = {
  mode: "production",
  entry,
  output: {
    path: DIST,
    filename: "[name].js",
    clean: true,
  },
  // No resolver módulos de node
  target: "web",
  resolve: {
    extensions: [".js"],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: [/node_modules/, /sheetjs\.min\.js$/],
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: "Chrome >= 100",
                  modules: false,
                },
              ],
            ],
          },
        },
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // mantener logs críticos de licencia
            drop_debugger: true,
            passes: 2,
            dead_code: true,
          },
          mangle: {
            toplevel: true,
            reserved: [
              // Nombres que deben sobrevivir para comunicación inter-módulos
              "FirebaseLicense",
              "LicenseGuard",
              "ActivateHelper",
              "PremiumUI",
              "FormatHandler",
              "BulkUploader",
              "CivicaAutoFill",
              "PaymentModal",
              "LicenseManager",
            ],
          },
          output: {
            comments: false,
            ascii_only: true,
          },
        },
        extractComments: false,
      }),
    ],
  },
  plugins: [
    // Ofuscación avanzada de código
    new WebpackObfuscator(
      {
        // Nivel alto de protección
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        deadCodeInjection: true,
        deadCodeInjectionThreshold: 0.4,
        debugProtection: true,
        debugProtectionInterval: 2000,
        disableConsoleOutput: false,
        identifierNamesGenerator: "hexadecimal",
        log: false,
        numbersToExpressions: true,
        renameGlobals: false, // NO renombrar globals compartidos entre scripts
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.75,
        stringArrayEncoding: ["base64", "rc4"],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 2,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 4,
        stringArrayWrappersType: "function",
        stringArrayThreshold: 0.75,
        transformObjectKeys: true,
        unicodeEscapeSequence: false,
      },
      // Excluir archivos que no deben ofuscarse
      ["sheetjs.min.js"]
    ),

    // Copiar assets estáticos al dist
    new CopyPlugin({
      patterns: [
        { from: path.resolve(ROOT, "sheetjs.min.js"), to: DIST },
        { from: path.resolve(ROOT, "style.css"), to: DIST },
        { from: path.resolve(ROOT, "popup.html"), to: DIST },
        // manifest.json se genera por el script prepare-manifest.js
      ],
    }),
  ],
  // Sin source maps en producción
  devtool: false,
};
