import { TextlintKernel } from "@textlint/kernel";
import textPlugin from "@textlint/textlint-plugin-text";
import preset from "../../textlint-rule-preset-farhangestan/src/index";
(window as any).dorostnevis = { TextlintKernel, textPlugin, preset };
