# 成就專屬圖集 v2

2026-10-14；使用 Codex 內建 image_gen 生成四張 4×4 PNG 原圖，再由 preview/pack-badges.cjs 依留白裁切、等比縮放並拼成 8×8 WebP。前 62 格各對應一個成就，最後兩格保留。不是更改成就判定或獎勵。

用途：取代舊版部分重複／不相符的圖示。週末不休為週末欄位與陽傘日曆；滿月達人為滿月＋30 天日曆。秘密成就未解鎖仍以問號遮蔽。

對應順序以 js/design.js 的 badgeSlots 明確定義，不使用 BADGES 的陣列序號作後備。檢查腳本 preview/artwork.cjs 驗證全部 62 項均有不同格位、不同圖像像素與秘密遮蔽。

來源：
1. achievement-tasks-v2-1.png：exec-c0e1b72f-f717-4710-8b6b-28f1d75b8154.png
2. achievement-tasks-v2-2.png：exec-4395caed-fa45-4ee7-b750-106046d4a0ca.png
3. achievement-tasks-v2-3.png：exec-183a8629-0a0a-46f9-99f2-4c9098d6e83c.png
4. achievement-tasks-v2-4.png：exec-882c09b4-fe5f-4625-b180-3b4e1d913da9.png

四張原圖使用象牙白底；網頁圖示採 multiply 混色融入卡面。先前兩次透明 8×8 試稿因切格與鄰格殘影未採用，不部署。

## 最終 prompts

### 圖集 1

Create ONE square game achievement icon sheet, 4 COLUMNS x 4 ROWS, 16 distinct collectible icons. Exact evenly spaced 4x4 layout. PALE IVORY BACKGROUND #fffdf9 everywhere. Thick empty ivory gutters between all icons and around perimeter. Each equal square cell contains one small centered icon occupying only 55 percent of cell width and height. Icons must NEVER touch each other or cell edges; whitespace is mandatory. No shadows outside icon area, NO glow or particles. Beautiful polished 3D toy vinyl, vibrant jewel colors, gold trim, soft studio illumination. All 16 designs must be different and identifiable at small size. No text except numbers explicitly mentioned on objects. No captions or grid lines. This is sprite asset sheet 1 of a consistent collection. Each of four rows has exactly FOUR items, left-to-right:
ROW 1: green sprout growing out of a check-in token (first check-in); | THREE linked orange flames (three-day streak); | blue weekly calendar with large 7 and check (seven-day streak); | two interlocking purple calendar pages with 14 (two weeks);
ROW 2: large ROUND FULL MOON with crater relief and small calendar marked 30 (thirty-day streak; NOT crescent); | archery target with 50 and an arrow (fifty streak); | diamond-shaped turquoise medallion with 100 and fiery laurel (hundred streak); | half-year royal hourglass with 180, sand and miniature crown.
ROW 3: grand golden trophy with 365, sun orbit halo (year streak); | little orange sunrise with waking yellow bird (early check-in); | crescent moon hugging a sleepy navy cat (late check-in); | mint desk calendar whose TWO weekend columns are coral, beach umbrella attached and eight tiny check marks (weekend check-ins; NO moon);
ROW 4: blue shield deflecting a small crack of lightning (first shield used); | TWO stacked distinct emerald shields (holding two shields); | bronze jar full of check-in tokens with 50 (cumulative days); | silver stepped bar chart of check-in tokens with 100 (cumulative days).

### 圖集 2

Create ONE square game achievement icon sheet, 4 COLUMNS x 4 ROWS, 16 distinct collectible icons. Exact evenly spaced 4x4 layout. PALE IVORY BACKGROUND #fffdf9 everywhere. Thick empty ivory gutters between all icons and around perimeter. Each equal square cell contains one small centered icon occupying only 55 percent of cell width and height. Icons must NEVER touch each other or cell edges; whitespace is mandatory. No shadows outside icon area, NO glow or particles. Beautiful polished 3D toy vinyl, vibrant jewel colors, gold trim, soft studio illumination. All 16 designs must be different and identifiable at small size. No text except numbers explicitly mentioned on objects. No captions or grid lines. This is sprite asset sheet 2 of a consistent collection. Each of four rows has exactly FOUR items, left-to-right:
ROW 1: mountain summit with flag marked 200 (cumulative days); | globe wrapped in a constellation orbit marked 365 (cumulative days); | five ascending orange steps with up arrow (five improvements); | champion belt with five jewels (five title defenses);
ROW 2: three linked green check seals in an arch (three no-penalty exams); | perfect exam paper marked 100 with red marking pen; | rising graph arrow piercing a golden ceiling (new personal best); | red rocket with +10 on hull (ten-point improvement);
ROW 3: fan of blue school subject books all bearing 90 and stars (all subjects 90); | TWO linked golden medals with royal blue ribbons (two defenses); | climber on rope emerging from valley onto cliff flag 80 (comeback); | FIVE upright pennants marked 90 in a compact arc (five exams 90);
ROW 4: stack of ten exam folders in tidy archive binder (ten records); | bouquet of differently colored rising arrows (all subjects improve); | THREE gold bonus coins around small laurel (three all-subject bonuses); | ornate antique pendulum clock with tiny seasonal leaves (six months of records).

### 圖集 3

Create ONE square game achievement icon sheet, 4 COLUMNS x 4 ROWS, 16 distinct collectible icons. Exact evenly spaced 4x4 layout. PALE IVORY BACKGROUND #fffdf9 everywhere. Thick empty ivory gutters between all icons and around perimeter. Each equal square cell contains one small centered icon occupying only 55 percent of cell width and height. Icons must NEVER touch each other or cell edges; whitespace is mandatory. No shadows outside icon area, NO glow or particles. Beautiful polished 3D toy vinyl, vibrant jewel colors, gold trim, soft studio illumination. All 16 designs must be different and identifiable at small size. No text except numbers explicitly mentioned on objects. No captions or grid lines. This is sprite asset sheet 3 of a consistent collection. Each of four rows has exactly FOUR items, left-to-right:
ROW 1: pink piggy bank with gold coin marked 5000 (bonus total); | graduation cap resting on THREE different colored books each marked 100; | friendly superhero cape behind a restored green check badge (recovery after penalty); | growing sunflower with FIVE descending-to-ascending stepping stones (steady growth);
ROW 2: single present box OPEN with golden wish star floating out; | three colorful interlocking puzzle pieces showing up-arrow, crown, coin (three bonus types together); | blazing violet comet with +20 embossed on its core; | five-point platinum crown over fan of exam sheets marked 95 (all subjects elite).
ROW 3: mint sneaker making first step onto a green check tile (first task); | small orange toolbox with 10 (ten tasks); | purple adventure backpack with 50 (fifty tasks); | faceted sapphire check-shaped crystal with 100 (hundred tasks);
ROW 4: wizard staff with star and 500 (five hundred tasks); | radiant daytime SUN holding a fully checked checklist (perfect day); | seven rainbow check tokens circling a weekly planner (seven perfect days); | colorful fireworks over calendar marked 30 with checks (thirty perfect days).

### 圖集 4

Create ONE square game achievement icon sheet, 4 COLUMNS x 4 ROWS, 16 distinct collectible icons. Exact evenly spaced 4x4 layout. PALE IVORY BACKGROUND #fffdf9 everywhere. Thick empty ivory gutters between all icons and around perimeter. Each equal square cell contains one small centered icon occupying only 55 percent of cell width and height. Icons must NEVER touch each other or cell edges; whitespace is mandatory. No shadows outside icon area, NO glow or particles. Beautiful polished 3D toy vinyl, vibrant jewel colors, gold trim, soft studio illumination. All 16 designs must be different and identifiable at small size. No text except numbers explicitly mentioned on objects. No captions or grid lines. This is sprite asset sheet 4 of a consistent collection. Each of four rows has exactly FOUR items, left-to-right:
ROW 1: cute bookworm peeking from open storybook; | miniature broom and blue cleaning bucket with bubbles; | amber lightning bolt emerging from token marked 1000; | golden energy sunburst medallion marked 5000;
ROW 2: violet ringed planet with crystal marked 20000; | vertical level gauge with handle at 20 and upward arrow; | rainbow of SEVEN little expressive mood faces (mood week); | smiling heart wearing moon-shaped silver crown with 30 (mood month).
ROW 3: birthday cake with candles and a green check token; | alert OWL with crescent moon and fully checked checklist (night perfect; distinct from cat); | THREE interlocking purple victory rings with 90 (three wins); | miniature SCHOOL building with THREE seasonal flags (three semesters);
ROW 4: THREE distinct wrapped gifts tied with a golden collecting ribbon (three wishes); | FULL MOON fused with gold coin treasure in a yin-yang-like trophy (streak and money together); | decorative silver compass (reserved); | decorative golden key (reserved).

