// textlint-scripts' Babel register only compiles files inside this package;
// these rules import shared code from ../textlint-rule-preset-farhangestan.
const path = require("path");
const babelConfig = require("textlint-scripts/configs/babel.config");
require("@babel/register")({
    plugins: babelConfig.plugins,
    presets: babelConfig.presets,
    extensions: [".js", ".ts", ".json"],
    only: [path.resolve(__dirname, "..", "..")],
    ignore: [/node_modules/]
});
