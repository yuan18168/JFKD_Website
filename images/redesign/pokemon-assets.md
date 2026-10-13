# 寶可夢素材來源與組合方式

日期：2026-10-14。用途：家庭網站設計預覽。角色原圖保留原樣，由 HTML/CSS 與獨立 AI 場景組合；**角色不是 AI 重繪**，不宣稱官方合作或素材授權已取得。

角色圖皆下載自 Pokémon 官方圖鑑的公開圖片，475×475 透明 PNG。以官方來源代替搜尋結果中不明作者的二創圖。保留來源記錄不代表素材變成可自由授權。

| 角色／本機檔案（pokemon/ 下） | 官方圖鑑 | 圖片編號 |
| --- | --- | --- |
| 皮卡丘 pikachu.png | https://www.pokemon.com/us/pokedex/pikachu | 025 |
| 伊布 eevee.png | https://www.pokemon.com/us/pokedex/eevee | 133 |
| 胖丁 jigglypuff.png | https://www.pokemon.com/us/pokedex/jigglypuff | 039 |
| 噴火龍 charizard.png | https://www.pokemon.com/us/pokedex/charizard | 006 |
| 路卡利歐 lucario.png | https://www.pokemon.com/uk/pokedex/lucario | 448 |
| 超夢 mewtwo.png | https://www.pokemon.com/us/pokedex/mewtwo | 150 |
| 傑尼龜 squirtle.png | https://www.pokemon.com/us/pokedex/squirtle | 007 |
| 妙蛙種子 bulbasaur.png | https://www.pokemon.com/us/pokedex/bulbasaur | 001 |
| 耿鬼 gengar.png | https://www.pokemon.com/us/pokedex/gengar | 094 |
| 快龍 dragonite.png | https://www.pokemon.com/us/pokedex/dragonite | 149 |

每張原始圖片 URL 為 `https://www.pokemon.com/static-assets/content-assets/cms2/img/pokedex/full/{圖片編號}.png`。十張均已下載及驗證為有 alpha 的 PNG，沒有修改角色像素。

## AI 背景

使用內建 image_gen，無角色圖片作為輸入，不把被拒絕的角色生成請求轉送其他模型。

`pokemon-scenes.png/.webp`：2 欄×3 列。來源 exec-115d6141-2614-4649-8932-78911adc6691.png。

Prompt: Create a background sprite atlas for six collectible character website themes, NO characters, creatures, people, text or logos. EXACT uniform grid of TWO COLUMNS and THREE ROWS; each cell a wide 16:9 landscape, edge-to-edge no borders or gutters, overall 32:27. Premium illustrated 3D miniature dioramas. Each has calm light left half for website text and empty presentation clearing on right for a separate HTML character. Row1 left sunny lemon-gold wildflower meadow, distant tiny windmill, warm ivory sky; right enchanted emerald woodland, mushrooms and amber sunbeams. Row2 left pink/lilac moonlit music garden, luminous orbs and crystal notes; right glowing orange volcanic rocks with blue evening sky, inviting fantasy lava island. Row3 left cobalt/cyan mountain training shrine, misty waterfalls, round energy rings; right silver violet cosmic observatory, crystalline platforms, purple nebula and planet rings. No character or animal silhouettes; preserve exact regular 2x3 tiling.

`pokemon-scenes-extra.png/.webp`：2 欄×2 列。來源 exec-495cff28-05c2-4f6e-8ccd-727b9cba1d2c.png。

Prompt: Premium 3D illustrated background sprite atlas, EXACT TWO COLUMNS x TWO ROWS, four equal 16:9 landscape cells, overall 16:9. Edge-to-edge no borders, gutters, text, characters, creatures or people. Empty display clearing on right half; left atmospheric with lower detail for website text. Top left turquoise seaside cove, transparent bubbles, shells and ivory shoreline. Top right emerald botanical greenhouse, giant leaves, dew and pale lime sunbeams. Bottom left playful violet night carnival, crescent moon, amethyst lanterns and tiny stars, cozy not frightening. Bottom right golden peach sunset above cotton cloud islands, distant floating towers and blue green accents. Refined tactile diorama, luminous distinct palettes, no animal-shaped architecture or character silhouettes. Exact 2x2 grid.

JDesign.artworkHtml() 以 CSS sprite 背景配合官方角色 `<img>` 呈現，保留獨立圖層，沒有生成宣稱為官方的新圖。
