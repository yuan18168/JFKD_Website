# JFKD 家庭網站交接手冊

2026-10-14。**新版隔離預覽待驗收，正式網站尚未更新。**

## 版本與備份

- GitHub：https://github.com/yuan18168/JFKD_Website
- 唯一開發目錄：家庭網頁設計/JFKD_Website。
- 正式基準 main：7fd16864f5386de6b46dba0276fd27d551c684d0，已重新查詢遠端確認。
- 新版分支：redesign-20261013。本機備份 tag：backup/pre-redesign-20261013 指向正式基準。
- **遠端備份未完成**：推送預檢因缺少 Git 登入憑證失敗。登入後必須推送 tag 與新版分支並比對遠端提交；不得將本機備份說成 GitHub 備份。
- 相鄰目錄的 JFKD_完整版本備份_20261014.bundle 保存正式基準與新版歷史，可用 git bundle verify 檢查。
- 經使用者批准，舊 jfkd-deploy-m/n/o/p/q、jfkd-family-rules、原型 HTML、旧 ZIP、8 月來源快照及未採用的 9 月改版 checkout 已清除；歷史報告、其他家庭資料保留。

## 範圍與架構

經 grill-me 訪談並確認共識後實作。孩子以 iPhone／iPad 使用，家長以 Windows PC 編輯。ㄎㄎ喜歡 BABYMONSTER 的 Asa；哈哈喜歡索隆與寶可夢卡牌。

原架構為純 HTML／CSS／JavaScript，16 頁，Firebase Authentication 與 Firestore。沒有加入框架或建置依賴。

- 孩子入口 app.html／js/app.js：任務、規矩、成績、許願池、圖鑑、造型。
- 家長入口 index.html；student.html 與 students.html 管理學生與成績。
- 其他管理頁涵蓋規矩、任務、獎懲、結算、許願池、科目、顯示、特效、試算與主題。
- 新版共用視覺：css/redesign.css（在原 CSS 後載入）、css/character-palettes.css、js/design.js。
- AI 原圖、WebP 網頁素材及生成 prompt：images/redesign/。
- 隔離預覽：preview/build.py、preview/mock.js、preview/start.ps1。
- 檢查腳本：preview/verify.cjs、preview/interactions.cjs、preview/themes.cjs。

js/calc.js、js/auth.js、js/pin.js、js/firebase-config.js、firestore.rules 與正式基準完全相同。依使用者最新核准，js/data.js 擴充角色主題目錄與橫幅，js/gamify.js 僅調整主題 XP 門檻。保留任務／XP 取得／獎金／成就判定與原有事件處理。沒有資料遷移、正式資料寫入或白名單變更。原碼 XP 包含 totalBonus 與 xpFromTasks，本次照原碼保留，不以舊說明推測規則。

## 設計交付與限制

- 首頁把今日任務提前，桌面雙欄、手機單欄與安全區底部導覽。
- 最新核准：30 款角色主題加免費預設；每 1,000 XP 解鎖一款，門檻為整數 1000、2000、3000…30000。海賊王與寶可夢各十位角色；BABYMONSTER 七位成員加 Asa、Ruka、Chiquita 特別造型，合計十款。三系列交錯排列，附系列篩選。
- 直接以目前總 XP 自動解鎖所有已達門檻的主題，不扣 XP、不需領取、不新增解鎖資料欄位。例：7450 XP 開放前七款。預覽資料與正式資料分離，正式上線後以每位孩子實際 XP 判定。
- 舊 theme ID 保留相容：gold 現對應皮卡丘、aurora 對應伊布、lava 對應噴火龍、galaxy 對應超夢；zoro、babymonster 仍為索隆、Asa。舊 ID 的風景及門檻已由角色目錄取代。
- 目前套用的主題仍沿用原本家長指定例外；換成另一主題後，舊主題須符合新門檻才能自行選回。
- 主題收藏封面、鎖定進度與使用中狀態；保留家長自訂標題。
- 62 個既有成就用 AI 立體收藏圖、卡冊、稀有度展示；秘密成就未解鎖仍遮蔽。
- 64 格物件圖集由 JDesign.badge() 映射；部分同類成就共用圖案。
- 索隆與 Asa 各三種姿勢，依本機日期每週輪替；季節點綴依月份切換。不新增獎勵規則。
- 保留既有慶祝特效，加上輕量進場動畫；減少動態偏好停用 CSS 動畫。
- 家長端深色導覽、淺色內容、清晰表單。保留全站字級設定，補鍵盤焦點與卡片 Enter／Space 操作。

全部 30 款已有角色圖。寶可夢十款使用 Pokémon 官方透明原圖＋獨立 AI 場景，以 HTML/CSS 合成展示；沒有把官方角色送入另一服務重畫，也不宣稱角色是 AI 新生成。來源、URL、背景 prompt 見 images/redesign/pokemon-assets.md。其他二十款為 AI Q 版插畫。索隆傷疤左眼閉合；BABYMONSTER 依預覽回饋改成明顯不同眼型、臉型、髮型、表情與色彩。

## 開啟預覽

PC：http://localhost:8765/app.html
家長：http://localhost:8765/index.html
同 Wi-Fi 手機／平板可嘗試：http://192.168.68.53:8765/app.html

區網 IP 可能改變。尚未真機驗證網路／防火牆可達，未修改防火牆。

伺服器停止後，在儲存庫執行：
```powershell
python preview/build.py
powershell -ExecutionPolicy Bypass -File preview/start.ps1
```
start.ps1 可使用本機 Codex 內附 Python；其他電腦需要 Python 3。Ctrl+C 停止。

可攜版 JFKD_新版預覽_20261014.zip 解壓後執行 start-preview.ps1。以 HTTP 伺服器開啟，不要直接雙擊 HTML。

示範資料存在 localStorage，頁首「重設」可恢復，各裝置不會同步。建置移除 Firebase SDK／設定／登入／PIN 腳本，改用本機假資料，不複製正式憑證。預覽登入與 PIN 是模擬，不能當正式安全驗證。Chart.js 等原有公共 CDN 仍需網路。

## 驗證

Chromium 檢查通過：
- 16 頁無 JavaScript 例外，桌面無文件橫向溢出。
- 手機主要分頁無橫向溢出。
- 任務完成與取消、選心情、已解鎖主題套用、鎖定卡片不可套用、成就詳情。
- 30 款主題、320／390／768／1024／1440 px、1.3 倍字級共 150 組首頁布局無文件溢出；30 個主角圖片均能解碼載入。
- 30 個門檻逐一檢查：差 1 XP 不解鎖、到達門檻解鎖；三系列篩選各 10 張，全列表 31 張。
- 現有示範餘額自動解鎖檢查：ㄎㄎ 4310 XP 開放四款，哈哈 3060 XP 開放三款；這不是正式家庭資料的讀取結果。
- 兩組檢查未發出正式 Firebase 請求。

已人工檢視手機首頁、圖鑑、造型與 PC 總覽截圖。產物在 _qa/，不加入 Git。檢查腳本目前引用本機 Codex Playwright 路徑，換機需調整。

尚待 iPhone／iPad Safari 真機驗收觸控、橫直向、鍵盤、安全區、字級與美術喜好。Chromium 模擬不是 Safari 真機測試。正式 Google 登入、Firestore、自動結算未在預覽執行。

## 上線與還原

1. 先取得使用者對具體預覽的明確上線批准；目前尚未取得。
2. 完成 GitHub 登入後，推送備份與新版：
```powershell
git push origin refs/tags/backup/pre-redesign-20261013
git push -u origin redesign-20261013
git ls-remote origin refs/tags/backup/pre-redesign-20261013 refs/heads/redesign-20261013
```
比對提交並記錄。確認 Pages 發布來源為 main/root，不把 _preview 當正式版。
3. 若 main 已有新提交，先整合、重測，不覆蓋新工作。批准後才合併 main／推送並確認 Pages 部署。
4. 還原採保留歷史的回退提交：單一 merge 上線用 git revert -m 1 <merge提交>；單一一般提交上線用 git revert <新版提交>。檢視差異後推送 main。不要 force push 改寫歷史。
5. 備份 tag 可在獨立 checkout 檢查；bundle 可用 git clone <bundle檔案> <新目錄> 還原儲存庫。
6. Git 只備份程式與素材，不還原 Firestore 家庭資料。本次沒有資料結構遷移。

## 工具與維護

內建 image_gen 生成素材，Sharp 壓 WebP，Pillow 檢查透明度。沒有新增線上 AI API、付費套件或網站執行期依賴。Playwright Chromium 安裝在相鄰 .tools/playwright-browsers，不部署到網站。

追加圖像保留 PNG 原圖、WebP 網頁版本、prompt 與既有 ID／圖集規格。純美術優先修改 design.js、redesign.css、character-palettes.css；主題角色、素材、整數門檻統一在 data.js 的 STUDENT_THEMES 維護，THEME_XP 由目錄產生，不另改其他 XP 規則或資料 schema。

參考：
- https://blog.duolingo.com/achievement-badges/
- https://blog.duolingo.com/streak-milestone-design-animation/
- https://www.nintendo.com/au/apps/nintendo-today/
- https://www.pokemon.com/uk/strategy/a-guide-to-collecting-cards-and-using-wonder-picks-in-pokemon-trading-card-game-pocket

## 角色與門檻表（最新核准）

| XP | 角色 | 場景 | 素材形式 |
| --- | --- | --- | --- |
| 1000 | 索隆 | 劍士冒險航線 | AI Q版插畫 |
| 2000 | Asa | 紫黑饒舌舞台 | AI Q版插畫 |
| 3000 | 皮卡丘 | 電光向日原野 | 官方角色＋AI場景 |
| 4000 | 魯夫 | 草帽啟航日 | AI Q版插畫 |
| 5000 | Ruka | 萊姆街舞城市 | AI Q版插畫 |
| 6000 | 伊布 | 森林奇遇旅程 | 官方角色＋AI場景 |
| 7000 | 娜美 | 橘子島尋寶記 | AI Q版插畫 |
| 8000 | Ahyeon | 緋紅搖滾舞台 | AI Q版插畫 |
| 9000 | 胖丁 | 粉紅晚安樂章 | 官方角色＋AI場景 |
| 10000 | 喬巴 | 雪國暖心小屋 | AI Q版插畫 |
| 11000 | Rami | 鈷藍月光音樂廳 | AI Q版插畫 |
| 12000 | 噴火龍 | 烈焰山巔試煉 | 官方角色＋AI場景 |
| 13000 | 香吉士 | 海上星光餐廳 | AI Q版插畫 |
| 14000 | Rora | 玫瑰復古協奏曲 | AI Q版插畫 |
| 15000 | 路卡利歐 | 波導修練山谷 | 官方角色＋AI場景 |
| 16000 | 羅賓 | 古代書海秘境 | AI Q版插畫 |
| 17000 | Chiquita | 熱帶耀金音浪 | AI Q版插畫 |
| 18000 | 超夢 | 星河覺醒之境 | 官方角色＋AI場景 |
| 19000 | 騙人布 | 奇想發明工坊 | AI Q版插畫 |
| 20000 | Pharita | 珍珠天鵝劇院 | AI Q版插畫 |
| 21000 | 傑尼龜 | 泡泡晴空海灣 | 官方角色＋AI場景 |
| 22000 | 佛朗基 | 超級造船夢工場 | AI Q版插畫 |
| 23000 | Asa | 銀翼未來舞台 | AI Q版插畫 |
| 24000 | 妙蛙種子 | 晨露溫室花園 | 官方角色＋AI場景 |
| 25000 | 紅髮傑克 | 夕陽領航誓約 | AI Q版插畫 |
| 26000 | Ruka | 塗鴉自由街區 | AI Q版插畫 |
| 27000 | 耿鬼 | 紫夜星光嘉年華 | 官方角色＋AI場景 |
| 28000 | 吉貝爾 | 深海龍宮航道 | AI Q版插畫 |
| 29000 | Chiquita | 夕陽屋頂派對 | AI Q版插畫 |
| 30000 | 快龍 | 雲端金色遠航 | 官方角色＋AI場景 |

## 女團視覺辨識

Asa 紫黑／狹長眼冷靜表情；Ruka 萊姆綠街舞／高編辮；Ahyeon 緋紅搖滾／張嘴笑；Rami 鈷藍音樂廳／金髮閉眼高歌；Rora 玫瑰復古／月牙笑眼；Chiquita 橘金青綠／短 bob 眨眼；Pharita 珍珠金劇院。這些是藝術造型設定，不是宣稱真實人物的固定長相。特別造型沿用各自新版角色參考。
