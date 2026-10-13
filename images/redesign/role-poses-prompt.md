# 角色姿勢圖集

檔案：`role-poses.png`，1536×1024，3欄×2列，每格512×512，32-bit RGBA。已檢查透明通道存在；格間抽樣 alpha=0。部分角色周圍保留淡淡半透明色彩暈光。

上排：索隆揮手、抱胸鼓勵、比讚。
下排：Asa 揮手、V 手勢、雙手比心。

來源：內建 image_gen，`exec-2dc30140-a405-472a-83c8-983c16f83767.png`。
參考：先以 view_image 檢視 `theme-zoro.png` 與 `theme-asa.png`，再以 referenced_image_paths 提供給圖像工具。

## 最終 prompt

Use case: stylized-concept. Asset type: transparent character sprite atlas for friendly daily check-in encouragement on a family website. Input image 1 is reference for the green-haired Zoro collectible character identity, costume, sheathed swords and rendering style. Input image 2 is reference for the Asa-inspired dark-haired idol collectible character identity, costume and rendering style. Create ONE image with exactly THREE equally spaced columns and TWO equally spaced rows, six equal cells. Genuinely TRANSPARENT background, no scenery, no text or grid lines. Entire character fully visible and centered independently within each cell with generous clear gutters of at least 12% cell width and 8% cell height so equal-grid CSS cropping never cuts hands, head or feet. Top row: same chibi Zoro in three poses, left waving hello warmly, center arms folded with encouraging confident smile, right happy thumbs-up. All swords remain sheathed in all poses. Bottom row: same cute stylized fully-clothed Asa collectible doll in three poses, left waving, center making V/peace sign, right making heart shape with both hands. Preserve reference characters and consistent proportions across each row, exquisite soft vinyl 3D figurine materials and gentle studio lighting, no photorealistic people. Keep approximate height and scale identical across all six sprites, easy to read at small sizes. No shadows outside individual cell, no platforms, no frame, no letters or watermark. This is a production sprite sheet; equal cell positioning is essential.


## 索隆傷疤眼複驗

已重新讀取目前的 role-poses.png，將上排三張臉部放大 2 倍逐一比對 theme-zoro.png。三張本人左眼（畫面右側）均為完全閉合的深色眼線，未見瞳孔、眼白或眼縫；中央與右側交叉眼線處的深色區域為垂直傷疤與閉眼線交會，不是眼珠。現有檔案已滿足閉眼條件，故本次未重新生成、未改動 PNG/WebP，保留下排 Asa 與透明圖集位置。
