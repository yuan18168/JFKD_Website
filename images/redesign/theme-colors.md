# 角色主題色彩設計

2026-10-14。整頁配色由 preview/theme-palettes.json 維護，以 preview/build-palettes.cjs 產生 css/character-palettes.css；只影響孩子端的主題顯示，不改 XP、任務或解鎖資料。

每款都有獨立的頁面底色、卡片色、文字色、雙色進度條、深色導覽、光暈與橫幅遮罩。海賊王採淡水平紋理、女團採斜向舞台光線、寶可夢採點狀收藏紋理。任務文字與底色、底部導覽及選中頁籤均檢查至少 4.5:1 對比。

| 主題 ID | 配色方向 | 頁面底色 | 卡片 | 主色 | 搭配色 | 深色導覽 |
|---|---|---|---|---|---|---|
| zoro | 森林綠 × 刀鞘金 | #dce9db | #f7fbf2 | #226640 | #526b24 | #183d2c |
| babymonster | 紫黑 × 霧銀 × 桃紫 | #e8dcf1 | #fcf7ff | #7137a1 | #963b7f | #291738 |
| gold | 電光黃 × 焦糖棕 | #fff0b6 | #fffbed | #805800 | #966112 | #463611 |
| luffy | 航海藍 × 草帽紅 | #e0edf3 | #fff8eb | #a43c2d | #276680 | #183e56 |
| ruka | 萊姆綠 × 炭黑 | #e5edca | #faffed | #486a1b | #236b4c | #25341b |
| aurora | 奶油棕 × 森林青 | #eee0c9 | #fff9ec | #85562e | #376d50 | #443326 |
| nami | 柑橘橙 × 海水綠 | #fbe6cd | #fffaf0 | #a55217 | #277567 | #534027 |
| ahyeon | 緋紅 × 搖滾黑 | #f1dbe0 | #fff6f6 | #ab2546 | #823462 | #3d1d2b |
| bulbasaur | 盛放葉綠 × 花苞青 | #dfeeda | #f6fff0 | #347442 | #25726a | #264b38 |
| usopp | 工坊芥黃 × 皮革棕 | #ede5c5 | #fffbed | #806119 | #6b5932 | #443b24 |
| rami | 鈷藍 × 月光銀 | #dfe7f6 | #f7faff | #315cad | #625498 | #233759 |
| squirtle | 深海藍 × 甲殼金 | #d8eef5 | #f3fcff | #126e92 | #326b9a | #1e485d |
| sanji | 海軍藍 × 香檳金 | #e1e6ed | #fcfaf4 | #315b83 | #80602c | #233b52 |
| rora | 古典玫瑰 × 酒紅 | #eedce3 | #fff7f6 | #95385e | #805137 | #482537 |
| dragonite | 雲朵金 × 遠航天藍 | #f7eacc | #fffcf0 | #946024 | #357495 | #4a402b |
| chopper | 冰雪藍 × 櫻花粉 | #dcebf3 | #f5fbff | #2b6c88 | #9e4776 | #254854 |
| chiquita | 熱帶橘 × 孔雀綠 | #ffead1 | #fffaf0 | #a95318 | #197168 | #315044 |
| gengar | 幽靈紫 × 霓虹莓紅 | #eadcf1 | #fcf5ff | #7c389e | #a33070 | #381d49 |
| robin | 書卷紫 × 古銅 | #e6dfee | #fcf8ff | #6f4b96 | #886039 | #362847 |
| pharita | 珍珠白 × 劇院金 | #eee5d1 | #fffdf5 | #856323 | #876044 | #493b28 |
| lucario | 波導藍 × 鋼鐵灰 | #d8e8f0 | #f3faff | #216c95 | #465c83 | #1b3d55 |
| franky | 機械青 × 超級紅 | #d9ecec | #f3fcfb | #147282 | #aa4437 | #21474d |
| asa-silver | 未來銀 × 電紫 × 冰藍 | #e1e3f0 | #f9faff | #6150a4 | #326c8c | #2d324b |
| jigglypuff | 忍者靛藍 × 月光青 | #dfe9f4 | #f5faff | #285990 | #2b717b | #20334e |
| shanks | 靈魂紫 × 舞台金 | #eee3ef | #fff8fe | #70508f | #8e6230 | #392842 |
| ruka-graffiti | 塗鴉藍 × 螢光萊姆 | #dee8f3 | #f7fbff | #345fab | #527522 | #273e58 |
| galaxy | 星雲紫 × 冰光青 | #e2ddf3 | #f8f6ff | #6342a0 | #26727e | #29203f |
| jinbe | 深海青 × 珊瑚朱紅 | #d7e9e6 | #f2fcf8 | #176d6d | #a24a32 | #1b4545 |
| chiquita-sunset | 夕陽杏 × 派對桃紅 | #f9e0d7 | #fff7f0 | #b34560 | #a05327 | #552e40 |
| lava | 火山橙 × 炭岩灰 | #f3dfce | #fff7ee | #ae4b1f | #8c382c | #492d26 |

主色若需提高文字對比，產生程式會小幅加深；以上是設計原始色。preview/palettes.cjs 在瀏覽器驗證 30 套最終配色與對比，_qa/palette-comparison.png 為六款手機畫面比較。

首頁橫幅另由 js/design.js 的 heroHeadTop 設定十九張使用中的插畫各自的頭頂座標，配合全姿勢顯示比例；只略裁到頭髮或頭飾。保留 .8 秒輕微縮放進場，減少動態偏好時停用。這些構圖規則只限定 .world-hero，造型收藏封面的構圖不變。布魯克與寶可夢透明角色維持 contain 完整顯示。

