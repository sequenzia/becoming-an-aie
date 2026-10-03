## Derived light values (computed)
bg: #fffcf5
text: #14161c
secondary: #666668
surface: #f1eee8
hairline: #c7c5c1
pinkTint: #fee6ee
blueTint: #e2eaf5
greenTint: #e1f4e5
amberTint: #fff3d8
pinkText: #c70093
blueText: #025bef
greenText: #017b48
amberText: #916100

## Dark theme check (brief values, recomputed)
| Pair | Foreground | Ground | Ratio | Normal (4.5) | Large (3) |
|---|---|---|---:|---|---|
| text on bg | `#fffcf5` | `#14161c` | 17.65 | pass | pass |
| secondary on bg | `#adaca9` | `#14161c` | 7.97 | pass | pass |
| text on surface | `#fffcf5` | `#303236` | 12.53 | pass | pass |
| secondary on surface | `#adaca9` | `#303236` | 5.66 | pass | pass |
| pink on bg | `#f948be` | `#14161c` | 5.77 | pass | pass |
| pink on surface | `#f948be` | `#303236` | 4.1 | fail | pass |
| pink on pink tint | `#f948be` | `#2b1b2c` | 5.17 | pass | pass |
| blue on bg | `#1064f8` | `#14161c` | 3.62 | fail | pass |
| blue on surface | `#1064f8` | `#303236` | 2.57 | fail | fail |
| blue on blue tint | `#1064f8` | `#13223f` | 3.16 | fail | pass |
| green on bg | `#01b66d` | `#14161c` | 6.81 | pass | pass |
| green on surface | `#01b66d` | `#303236` | 4.84 | pass | pass |
| green on green tint | `#01b66d` | `#122926` | 5.77 | pass | pass |
| amber on bg | `#fdad00` | `#14161c` | 9.6 | pass | pass |
| amber on surface | `#fdad00` | `#303236` | 6.82 | pass | pass |
| amber on amber tint | `#fdad00` | `#302819` | 7.73 | pass | pass |
| text on pink tint | `#fffcf5` | `#2b1b2c` | 15.82 | pass | pass |
| text on blue tint | `#fffcf5` | `#13223f` | 15.43 | pass | pass |
| text on green tint | `#fffcf5` | `#122926` | 14.95 | pass | pass |
| text on amber tint | `#fffcf5` | `#302819` | 14.2 | pass | pass |
| secondary on pink tint | `#adaca9` | `#2b1b2c` | 7.14 | pass | pass |
| secondary on blue tint | `#adaca9` | `#13223f` | 6.96 | pass | pass |
| secondary on green tint | `#adaca9` | `#122926` | 6.75 | pass | pass |
| secondary on amber tint | `#adaca9` | `#302819` | 6.41 | pass | pass |
| hairline vs bg (non-text) | `#4c4d50` | `#14161c` | 2.14 | fail |  |
| hairline vs surface (non-text) | `#4c4d50` | `#303236` | 1.52 | fail |  |
| secondary vs bg as a field border (non-text) | `#adaca9` | `#14161c` | 7.97 | pass |  |
| focus ring text color vs bg (non-text) | `#fffcf5` | `#14161c` | 17.65 | pass |  |
| focus ring text color vs surface (non-text) | `#fffcf5` | `#303236` | 12.53 | pass |  |
| blue vs bg (non-text) | `#1064f8` | `#14161c` | 3.62 | pass |  |
| blue vs surface (non-text) | `#1064f8` | `#303236` | 2.57 | fail |  |

## Text on a solid block (theme independent)
| Pair | Foreground | Ground | Ratio | Normal (4.5) | Large (3) |
|---|---|---|---:|---|---|
| #fffcf5 on blue block | `#fffcf5` | `#1064f8` | 4.88 | pass | pass |
| #14161c on pink block | `#14161c` | `#f948be` | 5.77 | pass | pass |
| #14161c on green block | `#14161c` | `#01b66d` | 6.81 | pass | pass |
| #14161c on amber block | `#14161c` | `#fdad00` | 9.6 | pass | pass |
| #14161c on blue block (not used) | `#14161c` | `#1064f8` | 3.62 | fail | pass |
| #fffcf5 on pink block (not used) | `#fffcf5` | `#f948be` | 3.06 | fail | pass |
| #fffcf5 on green block (not used) | `#fffcf5` | `#01b66d` | 2.59 | fail | fail |
| #fffcf5 on amber block (not used) | `#fffcf5` | `#fdad00` | 1.84 | fail | fail |

## Light theme check
| Pair | Foreground | Ground | Ratio | Normal (4.5) | Large (3) |
|---|---|---|---:|---|---|
| text on bg | `#14161c` | `#fffcf5` | 17.65 | pass | pass |
| secondary on bg | `#666668` | `#fffcf5` | 5.59 | pass | pass |
| text on surface | `#14161c` | `#f1eee8` | 15.62 | pass | pass |
| secondary on surface | `#666668` | `#f1eee8` | 4.95 | pass | pass |
| pink deck hex on bg | `#f948be` | `#fffcf5` | 3.06 | fail | pass |
| pink deck hex on surface | `#f948be` | `#f1eee8` | 2.71 | fail | fail |
| pink text variant on bg | `#c70093` | `#fffcf5` | 5.32 | pass | pass |
| pink text variant on surface | `#c70093` | `#f1eee8` | 4.71 | pass | pass |
| pink text variant on pink tint | `#c70093` | `#fee6ee` | 4.62 | pass | pass |
| text on pink tint | `#14161c` | `#fee6ee` | 15.3 | pass | pass |
| secondary on pink tint | `#666668` | `#fee6ee` | 4.85 | pass | pass |
| blue deck hex on bg | `#1064f8` | `#fffcf5` | 4.88 | pass | pass |
| blue deck hex on surface | `#1064f8` | `#f1eee8` | 4.32 | fail | pass |
| blue text variant on bg | `#025bef` | `#fffcf5` | 5.47 | pass | pass |
| blue text variant on surface | `#025bef` | `#f1eee8` | 4.84 | pass | pass |
| blue text variant on blue tint | `#025bef` | `#e2eaf5` | 4.62 | pass | pass |
| text on blue tint | `#14161c` | `#e2eaf5` | 14.92 | pass | pass |
| secondary on blue tint | `#666668` | `#e2eaf5` | 4.73 | pass | pass |
| green deck hex on bg | `#01b66d` | `#fffcf5` | 2.59 | fail | fail |
| green deck hex on surface | `#01b66d` | `#f1eee8` | 2.29 | fail | fail |
| green text variant on bg | `#017b48` | `#fffcf5` | 5.22 | pass | pass |
| green text variant on surface | `#017b48` | `#f1eee8` | 4.62 | pass | pass |
| green text variant on green tint | `#017b48` | `#e1f4e5` | 4.65 | pass | pass |
| text on green tint | `#14161c` | `#e1f4e5` | 15.74 | pass | pass |
| secondary on green tint | `#666668` | `#e1f4e5` | 4.99 | pass | pass |
| amber deck hex on bg | `#fdad00` | `#fffcf5` | 1.84 | fail | fail |
| amber deck hex on surface | `#fdad00` | `#f1eee8` | 1.63 | fail | fail |
| amber text variant on bg | `#916100` | `#fffcf5` | 5.24 | pass | pass |
| amber text variant on surface | `#916100` | `#f1eee8` | 4.63 | pass | pass |
| amber text variant on amber tint | `#916100` | `#fff3d8` | 4.87 | pass | pass |
| text on amber tint | `#14161c` | `#fff3d8` | 16.42 | pass | pass |
| secondary on amber tint | `#666668` | `#fff3d8` | 5.2 | pass | pass |
| hairline vs bg (non-text) | `#c7c5c1` | `#fffcf5` | 1.68 | fail |  |
| hairline vs surface (non-text) | `#c7c5c1` | `#f1eee8` | 1.49 | fail |  |
| secondary vs bg as a field border (non-text) | `#666668` | `#fffcf5` | 5.59 | pass |  |
| secondary vs surface as a field border (non-text) | `#666668` | `#f1eee8` | 4.95 | pass |  |
| focus ring text color vs bg (non-text) | `#14161c` | `#fffcf5` | 17.65 | pass |  |
| focus ring text color vs surface (non-text) | `#14161c` | `#f1eee8` | 15.62 | pass |  |
| pink deck hex vs bg as a fill or strip (non-text) | `#f948be` | `#fffcf5` | 3.06 | pass |  |
| pink text variant vs bg as a stroke (non-text) | `#c70093` | `#fffcf5` | 5.32 | pass |  |
| pink text variant vs surface as a stroke (non-text) | `#c70093` | `#f1eee8` | 4.71 | pass |  |
| blue deck hex vs bg as a fill or strip (non-text) | `#1064f8` | `#fffcf5` | 4.88 | pass |  |
| blue text variant vs bg as a stroke (non-text) | `#025bef` | `#fffcf5` | 5.47 | pass |  |
| blue text variant vs surface as a stroke (non-text) | `#025bef` | `#f1eee8` | 4.84 | pass |  |
| green deck hex vs bg as a fill or strip (non-text) | `#01b66d` | `#fffcf5` | 2.59 | fail |  |
| green text variant vs bg as a stroke (non-text) | `#017b48` | `#fffcf5` | 5.22 | pass |  |
| green text variant vs surface as a stroke (non-text) | `#017b48` | `#f1eee8` | 4.62 | pass |  |
| amber deck hex vs bg as a fill or strip (non-text) | `#fdad00` | `#fffcf5` | 1.84 | fail |  |
| amber text variant vs bg as a stroke (non-text) | `#916100` | `#fffcf5` | 5.24 | pass |  |
| amber text variant vs surface as a stroke (non-text) | `#916100` | `#f1eee8` | 4.63 | pass |  |

## Mini-map and diagram on a light ground, as embedded
| Pair | Foreground | Ground | Ratio | Normal (4.5) | Large (3) |
|---|---|---|---:|---|---|
| mini outline #adaca9 vs light bg (non-text) | `#adaca9` | `#fffcf5` | 2.22 | fail |  |
| diagram container stroke #4c4d50 vs light bg (non-text) | `#4c4d50` | `#fffcf5` | 8.25 | pass |  |
| diagram box fill #303236 vs light bg (non-text) | `#303236` | `#fffcf5` | 12.53 | pass |  |
| diagram title #fffcf5 on light bg | `#fffcf5` | `#fffcf5` | 1 | fail | fail |
| diagram subtitle #adaca9 on light bg | `#adaca9` | `#fffcf5` | 2.22 | fail | fail |
| Model title #1064f8 on #13223f tint | `#1064f8` | `#13223f` | 3.16 | fail | pass |
| Harness label #f948be on #2b1b2c tint | `#f948be` | `#2b1b2c` | 5.17 | pass | pass |
| dark diagram card #14161c vs light bg (non-text) | `#14161c` | `#fffcf5` | 17.65 | pass |  |

## Alternate light secondary and surface candidates
secondary at 0.55: #7e7e7e ratio on bg 3.96 on surface 3.51
secondary at 0.6: #727273 ratio on bg 4.69 on surface 4.15
secondary at 0.65: #666668 ratio on bg 5.59 on surface 4.95
secondary at 0.7: #5b5b5d ratio on bg 6.61 on surface 5.85
surface at 0.04: #f6f3ec text ratio 16.32 secondary ratio 5.17
surface at 0.06: #f1eee8 text ratio 15.62 secondary ratio 4.95
surface at 0.08: #eceae4 text ratio 15.03 secondary ratio 4.76
surface at 0.12: #e3e0db text ratio 13.74 secondary ratio 4.35

## Area text variants in OKLCH
pink: deck L 0.69 C 0.24 h -16; text L 0.55 C 0.24 h -16
blue: deck L 0.56 C 0.23 h -99; text L 0.53 C 0.23 h -99
green: deck L 0.68 C 0.16 h 156; text L 0.51 C 0.12 h 156
amber: deck L 0.8 C 0.17 h 76; text L 0.53 C 0.11 h 75

## Optional dark-mode text variants (not in the token set, for the record)
blue lightened for 4.6 on bg, surface, tint: #629aff; on bg 6.53, surface 4.64, tint 5.71
pink lightened for 4.6 on bg, surface, tint: #ff5cc5; on bg 6.54, surface 4.64, tint 5.86

## Focus ring: outer ring (text color) vs inner gap (bg color), and inner gap vs each block
dark outer vs gap 17.65; light outer vs gap 17.65
pink block: dark gap 5.77, light gap 3.06
blue block: dark gap 3.62, light gap 4.88
green block: dark gap 6.81, light gap 2.59
amber block: dark gap 9.6, light gap 1.84

## Mini-map lit fills vs the dark tile (non-text, 3:1)
pink on #14161c: 5.77
blue on #14161c: 3.62
green on #14161c: 6.81
amber on #14161c: 9.6

## Primary button inverted
dark: #14161c on #fffcf5 17.65; hover fill secondary with bg text: dark 7.97, light 5.59

