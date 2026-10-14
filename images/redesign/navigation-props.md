# 立體道具導覽示範（2026-10-14）

使用者經 grill-me 確認：角色世界立體道具、精緻展示座、每位角色五款專屬道具；先完成索隆／Asa／皮卡丘，待確認後延伸其餘 27 款。

使用內建 image_gen 生成透明 5×3 圖集 navigation-props-v1.png（1619×971 RGBA），來源 exec-486e7120-7c82-45ba-ad25-2b53f1285cc8.png。preview/pack-navigation.cjs 依實際圖集間隙裁切、裁透明邊、等比縮放及補透明邊距；輸出 navigation/{角色}-{home,rules,score,wish,dex}.webp，208×208、quality 92，保留 alpha。未使用 Python 編修圖片。

- 索隆：三刀、卷軸、獎盃、寶箱、皮革圖冊；綠漆／黃銅／象牙／紅繩。
- Asa：麥克風、練習手冊、水晶獎座、禮盒、收藏卡冊；紫黑／銀／粉紫光。
- 皮卡丘：閃電、筆記板、閃電獎盃、膠囊禮盒、圖鑑；暖黃／奶油／棕／紅。

導航高 84px，原版 78px；透明道具無方框，選中以局部光暈、底線及輕微浮起呈現，沒有大白色選中塊。減少動態停用浮起。標籤、位置、通知節點不變。

## 完整 prompt

Create a premium 3D collectible navigation PROP SPRITE ATLAS for a family adventure website. EXACT GRID FIVE COLUMNS by THREE ROWS, all 15 square cells identical, landscape ratio 5:3. Truly TRANSPARENT background, no background color, no grid lines, no pedestals, no UI, no lettering, no logos, no watermarks. Each cell contains ONE isolated compact prop centered, fully visible with generous 15% clear margins, comparable optical weight. No object may cross its cell. Polished high-end sculpted miniature quality, bevels, realistic soft highlights, tactile materials, three-quarter front camera, minimal soft contact shadows within each cell. Strong simple silhouette legible at 40px, avoid excessive tiny ornament.
ROW 1 inspired by Zoro's swordsman world: forest green lacquer, dark leather, ivory and aged brass.
Cell1 three sheathed katana swords arranged as a compact fan with ornate gold guards and green wrapped handles.
Cell2 an ivory rules scroll with dark green rolled ends, a raised brass checkmark and small red cord seal.
Cell3 a gold victory trophy with green enamel center and small crossed sword relief.
Cell4 a slightly open dark green wooden treasure chest with gold fittings and warm gold treasure glow.
Cell5 a closed thick forest-green leather adventure codex with brass corners, ivory page edges, a decorative gold compass embossed on cover and a red bookmark.
ROW 2 inspired by Asa's purple-black performance world: amethyst, black satin, brushed silver and pink-violet highlights.
Cell1 a black and chrome handheld microphone tilted diagonally, a purple crystal ring around its handle.
Cell2 a violet rehearsal checklist notebook, chrome spiral binding, large raised silver checkmark.
Cell3 an amethyst star-shaped music award on a compact brushed chrome foot.
Cell4 a small black-purple gift box with a pearlescent lilac ribbon and subtle glowing star inside its slightly open lid.
Cell5 an elegant purple collectible photocard album with silver corner fittings and two small blank holographic cards partially visible from its top.
ROW 3 inspired by Pikachu's cheerful electric world: warm yellow enamel, cream, chocolate brown tips and restrained red accents.
Cell1 a thick sculpted yellow lightning bolt with chocolate-brown lower tip, glossy rounded edges.
Cell2 a cream and yellow checklist tablet with big amber raised checkmark and a tiny lightning-shaped corner.
Cell3 a golden lightning-shaped champion trophy on a small cream base with red accent.
Cell4 a yellow rounded gift capsule box with red ribbon and tiny lightning latch, slightly open warm glow.
Cell5 a compact yellow creature-collection field guide with cream page edges and a raised amber lightning emblem, one rounded red detail.
CRITICAL exact 5 columns x 3 rows, fifteen separate objects, no text of any kind. Transparent empty space between props, no shared scenery. Cohesive craftsmanship across rows, distinct palettes.
