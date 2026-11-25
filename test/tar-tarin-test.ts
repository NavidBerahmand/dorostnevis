import TextLintTester from "textlint-tester";
import rule from "../src/rules/tar-tarin";
import { inv, z } from "./helpers";

new TextLintTester().run("tar-tarin", rule, {
    valid: [
        z("بزرگ‹تر، بزرگ‹ترین، وسیع‹تر"),
        "بهتر، کهتر، مهتر، بیشتر، کمتر، بیشترین",
        "لباس تر را پهن کرد.",          // «تر» = wet
        "دختر و دفتر و کبوتر",
        "پسوندهای تر و ترین"            // the suffixes named as words
    ],
    invalid: [
        inv("بزرگ ترین شهر", z("بزرگ‹ترین شهر")),
        inv("این خانه بزرگ تر از آن است.", z("این خانه بزرگ‹تر از آن است.")),
        inv("دور ترین نقطه", "دورترین نقطه"),       // after a non-joining letter: no ZWNJ
        inv(z("بیش‹تر مردم"), "بیشتر مردم"),
        inv("کم ترین", "کمترین")
    ]
});
