# 寶可夢原圖保留與還原

2026-11-18 核准的華麗版。角色與歷史姿勢原檔不覆寫，舊背景也保留。`original-checksums.json` 記錄 49 個原始素材 SHA-256；正式原圖仍位於 `images/redesign/pokemon/`、`images/redesign/poses-v1/` 及既有場景檔。`original.json` 與 `luxe-v1.json` 保存兩版寶可夢設定。

在專案根目錄使用 Node.js：

```powershell
# 全部換回原版
node tools/pokemon-art/restore.cjs --all
# 只換回噴火龍
node tools/pokemon-art/restore.cjs lava
# 切回已核准的新版
node tools/pokemon-art/restore.cjs --all --new
```

這是版本維護工具，不是網站上的按鈕。僅修改本機寶可夢視覺設定，不會自動提交、發布或操作家庭資料。發布時需更新 `js/data.js` 的 HTML 快取版號，再提交發布。操作前自動備份到 `_release/pokemon-restore/`。加上 `--dry-run` 可輸出結果而不寫入。

角色 ID：皮卡丘 gold、伊布 aurora、妙蛙花 bulbasaur、水箭龜 squirtle、快龍 dragonite、耿鬼 gengar、路卡利歐 lucario、甲賀忍蛙 ex jigglypuff、超夢 ex galaxy、噴火龍 ex lava。

還原僅切換視覺欄位；角色 ID、XP、其他資料欄位、海賊王和女團設定不變。其他系列檔案不需要回退。
