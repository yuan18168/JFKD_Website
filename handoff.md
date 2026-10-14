# 2026-10-15 發布阻擋與三輪驗證接續（最高優先）

- 使用者已授權直接上線、遇到 Bug 自行修正、最後對實際上線版本完整測試 3 輪；中途若修改產品程式需重新起算。
- 本機與 GitHub main 最新 699d9e85aff8edc361a64961dea32d3a93ed26c1，包含對比修正 3a4a22c、文案與 180 句鼓勵語 000680f、測試工具 699d9e8。本機測試通過，但截至本節紀錄 CDN 仍是 883a1f3，對比修正與鼓勵語尚未正式生效。不要聲稱已上線或三輪已完成。
- GitHub Pages build 步驟成功，deploy 失敗：`Deployment request failed ... due to in progress deployment. Please cancel 3a4a22cfa94307dadd8efb6c8d22dba3e08e33a3 first or wait for it to complete.` 舊發布已逾時且 cancel API 顯示 deployment_cancelled，仍殘留服務端鎖。已重試失敗步驟、Pages 完整建置及新提交，仍同錯誤。最新失敗 run 38599253242；先前重試 38597587802 仍 queued。勿刪除 Pages 網站或 force push。
- 正式 GitHub Pages 網址 https://yuan18168.github.io/JFKD_Website/；必要時先 GET 舊 deployment 狀態，再 POST pages/builds 重試一次，避免堆積工作。登入已由 GCM 保存，不輸出憑證。
- 部署成功且 app.html 確認含 theme-copy.js 與 readability.css 後執行 preview/three-rounds.ps1，三輪每輪含 16 頁載入、主要互動、180 文案／120 大字布局、31 配色規矩文字對比、30 主題實際套用與 150 導覽切換、配色、正式登入頁桌面／手機與效能紀錄。工具使用正式 CDN 產品資源，但在測試瀏覽器隔離替換資料；不得改正式家庭資料。原生 Safari／實體手機未測，不可宣稱全裝置零 Bug。
- 測試結果保存 _qa/live-round-1..3。若測試工具本身有問題可修正工具；產品 bug 修正上線後清楚建立新的三輪紀錄。完成後回填實際成功部署 SHA、測試結果與效能數據，再回報使用者。

## 2026-10-15 主題圖文與每日鼓勵

- 使用者已確認 30 款圖文自動對應、每款 6 句原創角色特色鼓勵語（共 180 句），並授權直接發布與完成後三輪功能／UI／效能測試。
- js/theme-copy.js 保存介紹與鼓勵語；js/design.js 一律使用目前主題名稱，忽略舊 bannerTitle/bannerTagline（原資料不刪除）。家長 themes 頁移除無效的標題編輯操作，說明自動文案規則。
- 重整或換主題會抽選不同於上一句的鼓勵語；同一學生同一主題的任務重繪保持不變。localStorage 只記上一句索引，存取失敗時採記憶體備援，不寫入 Firebase。
- preview/theme-copy.cjs 通過 180 句唯一性、刷新／切回不重複、重繪穩定、舊標題覆蓋防護、30 主題 × 4 尺寸大字布局。preview/live-test-hook.cjs 從正式 CDN 讀取資源，在測試瀏覽器替換認證與資料為隔離示範資料，以免測試更動家人的真實記錄。三輪結果後續寫入 _qa/live-round-*；不是 Safari 真機或正式帳號寫入測試。

## 2026-10-15 正式站文字對比修正

- 修正舊深色主題 token（kid-ink／kid-soft／k-good-bg）與新版淺色卡片混用，造成規矩、提醒、結算紀錄與打卡狀態文字不可讀。
- 新增 css/readability.css，將舊文字 token 對應新版角色文字與邊框色；成功／待處理狀態使用清楚的深字淺底；保留角色主題配色。app.html 以 20261015a 版號載入。
- preview/readability.cjs 檢查 30 主題加預設、390／1440 寬，實際規矩內容加完整狀態 fixture，所有受測文字至少 4.5:1、無溢出或 JS 例外。interactions.cjs 全通過且零正式資料請求。截圖與結果位於 _qa/readability-* 與 _qa/readability.json。
- 本次僅 CSS 與載入連結修正，未變更資料、規則或認證。前一正式提交 883a1f3；回退此修正可 revert 本次提交。

# 最新發布狀態（2026-10-14，以本節為準）

使用者已驗收十款 BABYMONSTER MV 主題與三十款精緻展示座，明確授權正式上線，GitHub 瀏覽器登入與推送預檢成功。下方較早的「待確認／未授權」均為歷史紀錄，不再適用。

- 已正式上線：GitHub Pages 建置 built，發布合併提交 0d04c5d4aecb67c5af64818794393f710ed976fd；正式來源 main／根目錄，網址 https://yuan18168.github.io/JFKD_Website/ 。已核對 9 個正式頁面／腳本／樣式／圖片與 Git blob 完全一致，preview/mock.js 與 handoff.md 回傳 404。
- 舊正式基準：7fd16864f5386de6b46dba0276fd27d551c684d0；備份標籤 backup/pre-redesign-20261013。
- 上線前已從該基準重建並保存 44 張桌面／手機截圖於 _release/20261014/screenshots/before。使用同一組隔離示範資料，不是真實家庭紀錄；未讀寫正式 Firebase。
- 交付包含 30 套角色配色、10 款 MV 服裝與場景、150 個專屬導覽道具、62 個獨立成就圖示、每日心情與 28 天回顧、每 1000 XP 三系列交錯解鎖。
- 已驗證 30 主題實際套用與重新整理保存、150 導覽操作、多尺寸布局、文字對比、減少動態，以及零正式資料請求。Safari 真機未另行測試。
- Pages 排除 preview 工具及交接文件；_preview、_qa、_release 不進 Git。正式頁面保留原 Firebase 連線；認證、計算、安全規則不變，無資料遷移。
- 已產出本機 _release/20261014/report/index.html 前後對照報告，前後各 44 張截圖（共 88 張）均無 JavaScript 例外與正式資料請求。相鄰目錄 JFKD_正式發布備份_20261014.bundle 保存最新歷史。截圖與報告不公開部署。
- 遠端備份已驗證：backup/pre-redesign-20261013 指向 7fd1686，redesign-20261013 指向 c352f17。現在工作分支 main。
- 回退方式：在 main 執行 git revert -m 1 0d04c5d4aecb67c5af64818794393f710ed976fd，再正常 push main，等待 Pages 建置；不要 force push，Firebase 資料無須回退。
- 發布前補修登入頁未載入 STUDENT_THEMES 的共用設計腳本例外，16 頁重測全數通過。

---

# JFKD 家庭網站交接手冊

2026-10-14。**使用者對目前預覽表示「看起來都很棒了」，將稍後做最後確認，再開新 session 要求正式上線 GitHub。目前尚未發布。**

> 最新接續：文末另有羅賓重繪、全部 30 款底部導覽列與心情日記的追加實作；上線前舊站截圖與上線後前後對照報告已列為必做。尚待使用者最後驗收與發布指示。

## 2026-10-14 新一輪：角色專屬世界示範待確認

使用者在先前預覽認可後提出進一步需求，經指定 grill-me 逐題確認並回覆「確認，go」：保留現有主視覺、按需補角色細節，各主題整頁有專屬材質／符號／元件造型，操作位置固定，重點突出且內容清楚。先製作索隆、Asa、皮卡丘三款完整首頁與任務畫面，待使用者看過後再延伸其餘 27 款。**目前新增的三款示範尚待使用者確認，不應直接視作 30 款全部完成或已可正式發布。**

- 索隆：道場木質背景、卷軸卡片、刀鍔式勾選、刀柄纏紋進度條、深綠漆面與黃銅導覽細節。
- Asa：舞台光束與細點背景、演唱會票券卡片、金屬按鈕邊緣、音量節拍進度條、紫黑舞台導覽。
- 皮卡丘：電光圓點背景、圓潤裝置卡片、電池分格進度條、金色按鈕邊緣與圓角導覽。
- 任務卡新增主題陪伴區。索隆／Asa 使用既有 role-poses.webp 三姿勢，依未完成、部分完成、全部完成切換；皮卡丘沿用官方透明角色圖，以充電格及完成動作呼應，沒有聲稱新增角色原圖。全部完成時顯示專屬鼓勵文案；減少動態偏好停用動畫。
- 新增 css/signature-worlds.css，僅 app.html 載入並限定三個主題 class；js/design.js 新增 taskWorld()，js/app.js 僅插入呈現區。原主視覺與全身橫幅保留，未調整 XP、解鎖次序或資料寫入邏輯。
- 驗證：preview/signatures.cjs 通過三款實際切換、12 組大字級布局、全部完成／鍵盤取消狀態、零 JavaScript 例外；interactions.cjs 通過且零正式 Firebase 請求；palettes.cjs 通過 30 配色及任務／導覽文字對比與手機無溢出。人工檢視三款手機比較及桌面畫面。
- 截圖：_qa/signature-worlds-comparison.png；各款 _qa/signature-{zoro,babymonster,gold}-{mobile,desktop,complete}.png。QA 檔不部署。
- app.html 的 app.js／design.js 版號為 20261014g；新樣式為 20261014a。preview/build.py 改為清空輸出目錄內部但保留根目錄，避免執行中的 Windows 預覽伺服器鎖住工作目錄而建置失敗；Firebase 排除機制保留。
- 預覽服務本輪重啟於 127.0.0.1:8765，只供本機；若需手機區網預覽，需另以既有 start.ps1 啟動區網服務。未部署、未提交，舊備份與 ZIP 仍不含最新修改。

## 下次 session 優先閱讀：先前交接狀態（以上方新需求為準）

- 本次僅更新交接文件；使用者尚未要求現在上線。待使用者在新 session 明確要求正式發布後，接續下方上線流程。
- 目前成果包含：首頁橫幅只略裁頭髮頂端、保留全身氣勢與縮放進場；62 個成就獨立圖示；30 套整頁配色；三系列每 1,000 XP 交錯解鎖；海賊王入團順序及寶可夢進化／末三款 ex 造型。最新角色與門檻以本文件表格及 js/data.js 為準，後段較早回饋是歷史紀錄。
- 使用同一開發目錄與 redesign-20261013 分支繼續。HEAD 仍為 e371899，回饋修改及新素材尚未提交，包含未追蹤檔案；不要重設、清理或從舊 bundle／ZIP 覆蓋目前工作。
- 本機預覽：http://localhost:8765/app.html 。停止後按「開啟預覽」重建／啟動。舊可攜 ZIP 與 bundle 不含最新回饋修改，不能當最新發布來源。
- 已完成的檢查及素材來源見文末最新紀錄。iPhone／iPad Safari 真機驗收尚無紀錄；使用者將自行再確認，接手時依其最新回覆更新狀態。
- 正式發布時先檢查工作差異與新增素材完整性，重建預覽並執行相關驗證，再提交目前全部核准修改。確認 GitHub 登入、重新讀取遠端 main 與 Pages 發布設定；本文件的遠端 SHA 是本次查詢紀錄，不代表下次仍未變動。
- 按「正式上線」流程推送並驗證正式基準備份 tag 與新版分支，備份最新修改；若遠端 main 已更新，先整合並重測。取得使用者新 session 的發布指示後才合併／推送正式 main，確認 Pages 部署結果及正式頁面資源。不要把 _preview、模擬登入或假資料發布為正式版。
- 發布後回填正式提交 SHA、備份 tag、Pages 部署結果與回退方式；保留 Firebase 正式資料與現有安全規則，不做資料遷移。


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
- 2026-10-14 回饋修正：62 個成就各有獨立、符合任務特色的 AI 圖示，不再共用圖案。四張原圖經打包產生 achievement-tasks-v2.webp，JDesign.badge() 透過明確 badgeSlots 對應；最後兩格保留。原圖、prompt 與說明見 images/redesign/achievement-tasks-v2.md。
- 索隆與 Asa 各三種姿勢，依本機日期每週輪替；季節點綴依月份切換。不新增獎勵規則。
- 保留既有慶祝特效，加上輕量進場動畫；減少動態偏好停用 CSS 動畫。
- 家長端深色導覽、淺色內容、清晰表單。保留全站字級設定，補鍵盤焦點與卡片 Enter／Space 操作。

全部 30 款已有角色圖。寶可夢十款使用 Pokémon 官方透明原圖＋獨立 AI 場景，以 HTML/CSS 合成展示；沒有把官方角色送入另一服務重畫，也不宣稱角色是 AI 新生成。來源、URL、背景 prompt 見 images/redesign/pokemon-assets.md。布魯克使用 Bandai Namco 官方透明角色＋AI 爵士場景，另十九款為 AI Q 版插畫。新增來源見 images/redesign/unlock-order-20261014.md。索隆傷疤左眼閉合；BABYMONSTER 依預覽回饋改成明顯不同眼型、臉型、髮型、表情與色彩。

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

舊可攜版 JFKD_新版預覽_20261014.zip 尚未包含最新回饋修改；請優先使用本機即時預覽。該 ZIP 解壓後可執行 start-preview.ps1。以 HTTP 伺服器開啟，不要直接雙擊 HTML。

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
| 3000 | 皮卡丘 | 電光向日原野 | 官方角色＋AI 場景 |
| 4000 | 魯夫 | 草帽啟航日 | AI Q版插畫 |
| 5000 | Ruka | 萊姆街舞城市 | AI Q版插畫 |
| 6000 | 伊布 | 森林奇遇旅程 | 官方角色＋AI 場景 |
| 7000 | 娜美 | 橘子島尋寶記 | AI Q版插畫 |
| 8000 | Ahyeon | 緋紅搖滾舞台 | AI Q版插畫 |
| 9000 | 妙蛙花 | 盛放森林秘境 | 官方角色＋AI 場景 |
| 10000 | 騙人布 | 奇想發明工坊 | AI Q版插畫 |
| 11000 | Rami | 鈷藍月光音樂廳 | AI Q版插畫 |
| 12000 | 水箭龜 | 深藍守護海灣 | 官方角色＋AI 場景 |
| 13000 | 香吉士 | 海上星光餐廳 | AI Q版插畫 |
| 14000 | Rora | 玫瑰復古協奏曲 | AI Q版插畫 |
| 15000 | 快龍 | 雲端金色遠航 | 官方角色＋AI 場景 |
| 16000 | 喬巴 | 雪國暖心小屋 | AI Q版插畫 |
| 17000 | Chiquita | 熱帶耀金音浪 | AI Q版插畫 |
| 18000 | 耿鬼 | 紫夜星光嘉年華 | 官方角色＋AI 場景 |
| 19000 | 羅賓 | 古代書海秘境 | AI Q版插畫 |
| 20000 | Pharita | 珍珠天鵝劇院 | AI Q版插畫 |
| 21000 | 路卡利歐 | 波導修練山谷 | 官方角色＋AI 場景 |
| 22000 | 佛朗基 | 超級造船夢工場 | AI Q版插畫 |
| 23000 | Asa | 銀翼未來舞台 | AI Q版插畫 |
| 24000 | 甲賀忍蛙 ex | 月影水之秘境 | 官方角色＋AI 場景＋ex 箔光 |
| 25000 | 布魯克 | 靈魂爵士舞台 | 官方角色＋AI 場景 |
| 26000 | Ruka | 塗鴉自由街區 | AI Q版插畫 |
| 27000 | 超夢 ex | 星河覺醒之境 | 官方角色＋AI 場景＋ex 箔光 |
| 28000 | 吉貝爾 | 深海龍宮航道 | AI Q版插畫 |
| 29000 | Chiquita | 夕陽屋頂派對 | AI Q版插畫 |
| 30000 | 噴火龍 ex | 烈焰巔峰殿堂 | 官方角色＋AI 場景＋ex 箔光 |

## 女團視覺辨識

Asa 紫黑／狹長眼冷靜表情；Ruka 萊姆綠街舞／高編辮；Ahyeon 緋紅搖滾／張嘴笑；Rami 鈷藍音樂廳／金髮閉眼高歌；Rora 玫瑰復古／月牙笑眼；Chiquita 橘金青綠／短 bob 眨眼；Pharita 珍珠金劇院。這些是藝術造型設定，不是宣稱真實人物的固定長相。特別造型沿用各自新版角色參考。

## 2026-10-14 接續檢查

- 工作分支仍為 redesign-20261013，接手時工作目錄乾淨，HEAD 為 e371899。
- 重新驗證相鄰完整版本 bundle：通過，包含正式基準與新版完整歷史。
- 重新查詢 GitHub：main 仍為 7fd16864f5386de6b46dba0276fd27d551c684d0；遠端新版分支與備份 tag 尚不存在。
- 已重新建置並啟動隔離預覽，PC 使用 http://localhost:8765/app.html；目前區網 IPv4 仍為 192.168.68.53。尚未驗證手機連入。
- 重新執行 verify.cjs、interactions.cjs、themes.cjs：16 頁與手機分頁無文件橫向溢出，任務及主題互動通過，30 個 XP 門檻、三系列篩選、150 組首頁版面及 30 款圖片通過。
- 首次在限制網路環境測試時 Chart.js CDN 無法載入；允許網路後重跑 16 頁檢查，JavaScript 例外為零，正式 Firebase 請求為零。預覽的 Chart.js 仍依賴網路。
- 正式網站未更新。下一步仍為使用者預覽與 iPhone／iPad Safari 真機驗收，再依上線流程取得明確批准。

## 2026-10-14 預覽回饋：女主角裁切與圖鑑重複

- 已修正女團系列首頁橫幅在寬螢幕上下裁切時切掉頭部：加入系列 class，以圖片頂部對齊固定人物頭部，停用該系列圖片縮放進場。索隆顯示維持原樣。
- 原因：舊 badge() 混用 semantic 對應和 BADGES 陣列位置，造成週末不休／滿月達人等重複及其他圖文不符。新版 62 個成就使用完整明確映射，各有獨立圖像；未來新增成就必須補圖與映射。
- 新圖例：週末不休＝週末日曆與陽傘；滿月達人＝滿月與 30 天日曆；化險為夷＝擋住閃電的單盾；有備無患＝雙盾；夜貓子＝月亮與睡貓；深夜衝刺＝夜空貓頭鷹與完成清單。
- 採用四張 4×4 象牙白底 AI 圖集原圖，preview/pack-badges.cjs 裁切留白、打包成 8×8 WebP，保留所有來源與最終 prompt。先前透明圖集試稿因鄰格殘影未採用。
- 新增 preview/artwork.cjs，驗證 62 項映射與圖像皆不同、秘密成就仍遮蔽，以及 10 款女團 × 5 種寬度共 50 組頂部對齊與無溢出。已人工檢視 Asa 手機／桌面截圖及 62 項圖文對照全覽，圖示輪廓無鄰格殘影。
- interactions.cjs、themes.cjs 再次通過：任務完成／取消、心情、主題套用、成就詳情，30 個 XP 門檻、3 系列篩選與 150 組首頁布局。未修改成就判定、XP 規則或正式資料。
- 全站 design.js／redesign.css 查詢版號更新為 20261014b；隔離預覽已重建。瀏覽器重新整理即可看到新版；正式網站未更新。
- 本次修改尚未提交；原 bundle 與可攜 ZIP 是本次回饋修改前的版本。當前新版請使用本機即時預覽。

## 2026-10-14 追加回饋：索隆一致化

- 依使用者要求，索隆首頁橫幅同步採用女團的 65% top 頂部對齊與停用圖片縮放進場設定，取代前述「索隆維持原樣」。
- 已重建隔離預覽，確認 320／390／768／1024／1440 px 均套用相同對齊、無橫向溢出；人工檢視 390 與 1440 px 截圖，頭部完整可見。
- 全站 redesign.css 版號更新為 20261014c；design.js 仍為 20261014b。正式網站尚未更新。

## 2026-10-14 最新回饋：首頁全身構圖、恢復進場、30 套整頁色彩

- 使用者明確限定裁切的是首頁主角／標題／日期橫幅，並要求保留縮放進場。取代前述單純頂部對齊及停用進場的方案。
- 二十張插畫在 js/design.js 的 heroHeadTop 各自記錄頭頂／帽頂位置：僅額外裁切約 0.6% 原圖高度，畫面高度依頭頂計算，底部保留全身姿勢，不再把寬景圖 cover 放大成半身大頭照。桌面橫幅至少 320px、手機至少 260px，手機向右調整以讓出文字空間。
- 構圖 CSS 僅限定首頁 .world-hero；造型收藏封面不改。寶可夢維持官方透明角色 contain 全身顯示。恢復 .8 秒輕微縮放進場（1.035 → 1），以頭部附近為縮放原點；減少動態偏好仍停用動畫。
- 30 款主題各有完整配色：背景、卡片、文字、按鈕、雙色進度條、深色導覽、細紋理與橫幅遮罩皆呼應角色。詳見 images/redesign/theme-colors.md。
- 配色來源 preview/theme-palettes.json；執行 node preview/build-palettes.cjs 產生 css/character-palettes.css。未改任何任務、成就或 XP 規則。
- artwork.cjs 驗證 20 款 × 5 寬度共 100 組完整姿勢布局、62 成就圖示、進場與減少動態；themes.cjs 的 30 門檻／3 篩選／150 大字級布局再次通過。palettes.cjs 驗證 30 套實際顏色組合不同、任務及導覽文字對比至少 4.5:1、手機無橫向溢出。
- 已人工檢視二十款桌面橫幅，以及索隆、Asa、皮卡丘、魯夫、Ruka、喬巴的手機配色比較。
- 查詢版號：redesign.css 與 character-palettes.css 為 20261014e；design.js 為 20261014d。本機隔離預覽已更新，正式網站未上線。原 bundle／可攜 ZIP 仍為回饋修改前版本，本次工作尚未提交。

## 2026-10-14 最新：三系列交錯解鎖與進化／ex 造型

- 全部頁籤依 XP 遞增，每 1,000 XP 解鎖一款，固定海賊王 → BABYMONSTER → 寶可夢循環十輪，各十款，最高 30,000 XP。各系列篩選也按此門檻遞增。
- 索隆保留首款，其他採魯夫、娜美、騙人布、香吉士、喬巴、羅賓、佛朗基、布魯克、吉貝爾的順序。以布魯克替換非草帽成員的紅髮傑克。BABYMONSTER 的十筆角色設定與 XP 完全不變。
- 寶可夢採皮卡丘、伊布、妙蛙花、水箭龜、快龍、耿鬼、路卡利歐、甲賀忍蛙 ex、超夢 ex、噴火龍 ex。這是依使用者偏好設計的收藏進程，不宣稱官方稀有度或最新人氣排行。最後三款以網頁箔光邊框及 ex 標誌呈現卡牌風格。
- 布魯克使用 Bandai Namco 官方透明全身角色，另生成爵士舞台背景；甲賀忍蛙另生成月影水庭背景。素材、完整 prompt 與來源見 images/redesign/unlock-order-20261014.md。
- 所有既有主題 ID 保留：shanks 現為布魯克、bulbasaur 為妙蛙花、squirtle 為水箭龜、jigglypuff 為甲賀忍蛙 ex，無資料庫遷移。既有使用者所選 ID 因此會顯示替換後的角色。
- themes.cjs 通過 30 門檻、三系列交錯及系列內順序、三款 ex、DOM 排序與 150 組版面；palettes.cjs 通過 30 配色與對比；interactions.cjs 通過且無正式 Firebase 請求。人工檢視新角色桌面／手機橫幅及寶可夢收藏列表。
- 首頁橫幅的全身構圖及縮放進場保留。布魯克採透明角色完整顯示，其他 19 張插畫使用頭頂座標構圖。
- data.js、design.js、redesign.css、character-palettes.css 查詢版號皆為 20261014f。本機預覽已更新；未部署、未提交，舊 bundle／ZIP 不含本次修改。
## 使用者指定：上線前截圖存證與上線後分享報告（必做）

2026-10-14 使用者要求：最後確認拍板後、正式發布前，先把舊版本截圖記錄；上線後提供「改版前 vs 改版後」報告，讓家人小孩快速理解亮點並分享改版喜悅。

- 此項是發布前置工作，不要等覆蓋正式站後才補舊版截圖。截圖範圍包含舊站所有主要頁面及可重現的重點狀態，至少孩子端首頁／任務、規矩、成績、許願池、圖鑑、主題造型，以及家長端主要管理頁；採桌面與手機相同尺寸保留前後對照。
- 保存舊正式版本 SHA、日期、頁面名稱與尺寸；若有其他可取得的舊版，明確標示其版本，不把單一舊版寫成全部歷史版本。無法安全讀取正式內容時，以該正式 SHA 的隔離預覽配同一組示範資料重現，報告中明確標記模擬資料；不將家庭隱私、登入資訊外傳。
- 發布成功後，使用同尺寸、同頁面與可比較的資料截取新版，產出繁體中文「改版前 vs 改版後」分享報告，以圖片對照、簡短亮點說明為主，適合家長和孩子快速閱讀。內容含視覺風格、角色主題、任務陪伴、心情打卡、圖鑑收藏、解鎖進程及操作改善，僅列實際已上線的功能。
- 報告保留本機檔案及清楚入口，於正式發布完成回覆中提供。現在只是記錄此要求，尚未獲得立即發布指示。
## 2026-10-14 追加：羅賓重繪、30 款導覽列與心情日記

- 羅賓：已使用內建 image_gen 參考官方新世界造型重繪，保留原主視覺構圖與柔和 3D Q 版質感，加入露額黑長髮、頭頂墨鏡、藍紫上衣／花紋長裙、交叉手勢、花花果實手臂與考古石碑。新版 images/redesign/theme-robin-v2.png/.webp，舊圖保留；完整 prompt 與參考來源 images/redesign/robin-v2.md。主題 ID robin 及 19000 XP 不變；heroHeadTop .033。已檢視手機與桌面橫幅，墨鏡頂端僅略裁、全身保留。
- 使用者追加要求「每個不同主題的底部導覽也要相應變化」：已擴及全部 30 款的底部導覽列；新增 js/theme-navigation.js 與 css/theme-navigation.css。每款首頁徽記不同、專屬紋理／外框／色彩，其他四個入口依航海、舞台、寶可夢三類採各自圖示語彙。名稱與位置仍為首頁、規矩、成績、許願池、圖鑑。保留通知圓點原節點；免費預設主題仍用基本圖示。這不代表其餘 27 款完整頁面已完成「角色專屬世界」，三款示範以外的整頁設計仍待確認後延伸。
- 打卡區改為「我的心情日記」，新增今天的我、大表情與五種心情各自的鼓勵文字、記錄／更新今天心情入口、最近 28 天已收藏數量。日曆以表情為主，任務打卡以小勾標示，月份交界標明日期，今天外框高亮。普通或低落心情同樣被接納，未填不虛構為開心。
- 沿用既有 moodLog、saveMoodToday 及心情成就規則，沒有新增 XP 或資料欄位。原完成任務後提問保留，新增手動入口可修改今天；彈窗支援關閉、Escape、焦點循環與儲存失敗提示／重試。未成功儲存不顯示成功。
- 原預覽 mock 使用無效的 happy 代碼，因此舊圖只有日期沒有心情表情。已將新的示範資料改為正式 MOOD_OPTIONS 中五個有效代碼；已有預覽 localStorage 的 happy 僅在 mock adapter 轉為 great。此相容修正不接觸正式資料，也不改正式心情定義。
- 新增 css/mood-journal.css 及 preview/navigation-mood.cjs。已通過全部 30 導覽徽記唯一、120 組大字級版面、五入口切換、通知節點保留、五種心情儲存／重新整理保留、Escape、失敗重試，零 JS 例外／正式 Firebase 請求。既有 interactions.cjs、palettes.cjs 再次通過。
- QA：_qa/navigation-30.png、_qa/robin-v2-{mobile,desktop}.png、_qa/mood-journal-{mobile,desktop}.png。素材存入工作目錄，不依賴 generated_images 暫存路徑。全站 data.js/design.js 版號 20261014h；孩子 app.js 20261014i；新導覽與心情 CSS/JS 20261014a。
- 本機預覽已重建，正式網站未發布、所有本輪修改未提交。使用者另要求的發布前舊版截圖與發布後分享報告，見上一節「必做」記錄。
## 2026-10-14 最新：立體道具導覽三款示範待確認

使用者認為前版線框導覽太陽春，指定 grill-me 並確認：角色世界立體道具、精緻展示座、每位角色五款專屬道具；先做索隆、Asa、皮卡丘三套，待確認質感後才擴及其餘 27 款。

- 內建 image_gen 生成透明 5×3 圖集 images/redesign/navigation-props-v1.png；preview/pack-navigation.cjs 分割並保留透明，產出 navigation/ 下 15 張 208×208 WebP。完整 prompt、材質／道具對應與來源見 images/redesign/navigation-props.md。
- 三款導覽改用真實點陣立體道具，取消小圖示方框、大面積白色選中塊與粗條紋；森林綠黃銅、紫黑舞台金屬、暖黃琺瑯三種展示底座。選中採局部光暈、細底線和輕微浮起。高度 84px，較前版增加 6px；入口名稱／順序、通知節點及至少 44px 觸控範圍保留。減少動態模式停用浮起及過渡。
- js/theme-navigation.js 以 data-props 分流三款，其他 27 款與免費預設保留前版，未誤套尚未製作的道具。app.html 新導覽 CSS/JS 版號為 20261014b。
- preview/navigation-props.cjs：15 圖片解碼、三款各四個尺寸／大字級、每款五入口、通知節點、減少動態檢查通過，無 JS 例外。每款重新載入隔離頁面驗證；先前持續快速切頁的壓力跑法曾 click timeout，不以該次失敗結果宣稱通過。palettes.cjs 更新透明選中區的對比取樣方式後，30 主題文字對比與手機溢出檢查通過。
- 人工檢視 _qa/props-navigation-comparison.png 與 _qa/props-page-{zoro,babymonster,gold}.png，已修正選中圖示殘留的舊白色方框。navigation-mood.cjs 的導覽唯一性檢查已相容圖像圖示。
- 隔離預覽已重建；未正式發布、未提交。前版存證及上線後對照報告的必做要求仍有效。

## 2026-10-14 BABYMONSTER MV 重設：參考方向待審閱

使用者透過 grill-me 已確認：成員各取熱門 MV 的辨識造型、3–3.5 頭身精緻 3D Q 版、保留本人五官差異；服裝／髮型／場景依 MV 取材，整頁配色跟隨。Asa／Ruka／Chiquita 特別款必須採另一支 MV。先審閱十款取材，再試作 Asa、Ruka， likeness 確認後延伸其餘。最近 go 授權的是整理參考對照，尚非全面重繪。

暫定十款（原 ID、XP、順序不變；下列配色是設計提案）：
- 2000 babymonster Asa：SHEESH，粉色挑染／冷酷饒舌，黑莓紫＋玫粉。
- 5000 ruka Ruka：DRIP，破洞短帽 T／彩色圖案工裝褲，墨黑＋酸橙綠＋塗鴉亮色。
- 8000 ahyeon Ahyeon：DRIP，黃色運動上衣／淺藍寬版工裝牛仔褲，奶油黃＋天空藍。
- 11000 rami Rami：SHEESH，騎士外套／鉚釘頸飾，石墨黑＋冰銀藍。
- 14000 rora Rora：SHEESH，角狀髮型／銀飾，深紫＋煙玫瑰。
- 17000 chiquita Chiquita：SHEESH，金色雙馬尾／黑色挑染，香檳金＋黑莓色。
- 20000 pharita Pharita：SHEESH，白色禮服／毛絨手套／華麗飾品，珍珠白＋冷銀。
- 23000 asa-silver Asa：FOREVER，蕾絲套裝／藍色腰帶／銀色蝴蝶結耳飾，冰藍＋銀白；取時裝秀／精品空間方向。
- 26000 ruka-graffiti Ruka：BATTER UP，皮革外套／粉色迷彩髮夾，黑皮革＋莓紅＋粉色點綴。
- 29000 chiquita-sunset Chiquita：DRIP，寬版牛仔褲／淡粉厚底鞋／毛帽，丹寧藍＋糖果粉。

證據邊界：已查官方文章、成員預告與有標名的服裝拆解；尚未完成十套 MV 全身畫面逐鏡核對，不可宣稱已看完 MV 或已驗證全部服裝細節。場景延伸、網站配色為提案，不是 MV 原畫面的事實描述。繪製前需取得清楚的標名成員近景與同套全身參考，不混用 MV、宣傳照與打歌舞台。

參考來源：
- 熱門依據（官方歷史里程碑，非即時排行）：https://www.ygfamily.com/en/news/report/7561 （SHEESH／DRIP 4 億）；https://www.ygfamily.com/en/news/report/6706 （BATTER UP 3 億）。
- SHEESH 官方成員造型：Asa https://www.ygfamily.com/en/news/report/5841 、Rami https://www.ygfamily.com/en/news/report/5853 、Rora https://www.ygfamily.com/en/news/report/5835 、Chiquita https://ygfamily.com/en/news/report/5834 、Pharita https://ygfamily.com/en/news/report/5846 。
- DRIP 服裝拆解（第二手，有成員標名）：https://inkistyle.com/kpop-fashion-babymonster-drip-mv/
- FOREVER 官方場景：https://www.ygfamily.com/en/news/report/6272 ；服裝拆解：https://inkistyle.com/kpop-fashion-babymonster-forever-mv/
- BATTER UP 服裝拆解：https://inkistyle.com/kpop-fashion-babymonster-batter-up-mv/

網站素材與程式本階段未替換，未部署。下一步：使用者審閱十款方向，再核對 Asa／Ruka 具體影像並試作。

## 2026-10-14 BABYMONSTER：Asa／Ruka MV 試稿完成，待辨識度審閱

使用者已確認十款取材提案，依分階段共識先完成 Asa《SHEESH》與 Ruka《DRIP》兩張試稿，未擴及其餘八款、未套回 app 主題。

- 內建 image_gen 參考有成員標名的 MV 圖像生成。參考保存在 _qa/mv-references，來源為 InkiStyle SHEESH Asa Look #1、DRIP Ruka Look #1；已實際檢視選定圖像，未宣稱觀看完整 MV。
- 實圖修正前輪提案：所選 Asa 服裝畫面是黑色雙馬尾，保留粉黑毛飾上衣、星形腰鍊及紅黑扣帶靴；不混入另一鏡頭的粉色挑染。Ruka 服裝是珊瑚粉鏤空袖帽 T、黃綠圖案工裝褲，配色調整為橄欖綠／珊瑚粉／暖黃。
- 場景依選定畫面轉作網站構圖：Asa 紅白階梯、Ruka 粉色音箱與白色支架。不是逐像素復刻。人物是 Q 版藝術詮釋，本人辨識度仍待使用者審閱。
- 新素材 images/redesign/mv-study/{asa-sheesh,ruka-drip}-v1.png/.webp，1672×941。生成原檔分別 exec-ddff8ae7-beae-4fbd-92c3-edd693b5879a.png、exec-805f208a-8794-4046-8187-eb0ff5de805a.png；完整 prompt、來源與調整理由見 preview/mv-study-prompts.json。
- 獨立對照頁 preview/mv-study.html，預覽 http://localhost:8765/mv-study.html。可切寬版／手機構圖、展開目前版本比較。build.py 會保留此獨立預覽頁；沒有新增正式 app 入口。
- preview/check-mv-study.cjs 通過圖片解碼、320／390／768／1440 無橫向溢出、完整圖高、尺寸切換與減少動態、零 JS 錯誤。首輪檢查受進場 scale 影響量測，改以 reducedMotion 測穩定構圖後通過。人工檢視手機全頁 _qa/mv-study-390.png，主角頭髮與鞋子完整可見；另有 1440 截圖。
- 正式網站、XP、解鎖順序、目前 app 人物及其他主題沒有更動；未發布。下一步等使用者確認兩人辨識度，再決定修臉或延伸整頁與其他角色。

## 2026-10-14 最新完成：十款 BABYMONSTER MV 主題＋三十套精緻展示座

使用者已認可 Asa《SHEESH》／Ruka《DRIP》試稿，並經 grill-me 確認完成十款女團及三十套展示座；採「功能清楚＋角色特色」，保留五入口名稱、順序、通知與原解鎖規則。本節取代前文僅三款道具示範及女團待製作的狀態。

### 已整合
- 十款女團全數使用新版 MV 參考 Q 版主視覺：Asa SHEESH、Ruka DRIP、Ahyeon DRIP、Rami SHEESH、Rora SHEESH、Chiquita SHEESH、Pharita SHEESH、Asa FOREVER、Ruka BATTER UP、Chiquita DRIP。ID 與 2000～29000 每隔 3000 XP 的門檻不變，三系列仍每 1000 XP 交錯。
- 新素材 images/redesign/mv-study/ 的十組 PNG 原稿與 WebP；舊角色圖保留。前兩款沿用使用者認可稿，其餘八款使用內建 image_gen 個別參考有標名 MV 圖像繪製，風格參考認可 Asa。完整 prompt／原檔來源：preview/mv-study-prompts.json、preview/mv-completion.json。參考原圖在 _qa/mv-references，未放入預覽／正式網頁素材目錄。
- 證據邊界：有檢視指定鏡頭參考，未宣稱完整看過每支 MV。實圖有別於前輪文字提案時，以同套鏡頭為準：Asa 黑色雙馬尾；Ruka 珊瑚粉上衣；Rami 採銀鏡場景的黑色上衣、白綁帶黑褲與紅鞋，未混搭騎士外套。Rora 等僅上身參考的下半身有藝術補全；Pharita 與場景也有構圖改編，皆非精確服裝復刻或官方素材。
- js/data.js 更新十款主題名稱、場景、圖像、選色提示；preview/theme-palettes.json＋css/character-palettes.css 更新十款完整配色。css/mv-worlds.css 進一步處理各款卡片外形、材質紋理、按鈕／任務與雙色進度條，覆蓋原 Asa 固定紫色樣式。其他二十款保留既有整頁配色。
- js/design.js 十款皆加入當前 MV 角色陪伴卡與日期縮圖，移除女團舊 Asa 造型 sprite；非透明角色卡為刻意採用的小型收藏卡呈現。首頁全身構圖與縮放進場保留，各圖頭頂定位在 heroHeadTop。
- 三十款 × 五入口＝150 張不同的透明立體道具全部完成；新增 images/redesign/navigation-atlas-0.png～5.png 原稿、navigation-v2/{theme}-{home,rules,score,wish,dex}.webp。導覽功能意象為角色首頁徽記／清單／獎盃／禮物或寶箱／圖鑑，角色材質及飾物不同。原三款道具保留於舊 navigation/，現在全部使用 v2。
- 內建 image_gen 生成六張 5×5 圖集。preview/navigation-all.json 保存完整 prompt、各列 ID 與生成原檔；preview/pack-navigation-all.cjs 找透明間隔分割、裁邊、縮為 208×208 WebP，裁切座標記錄 _qa/navigation-crops.json。
- js/theme-navigation.js 全三十款啟用立體道具；css/navigation-worlds.css 提供每款展示座材料、邊緣、色彩及造型。保持 84px 高度、44px 以上觸控範圍、選中細線／光暈、通知節點與減少動態模式。免費預設維持原圖示。
- app.html 新增 mv-worlds.css、navigation-worlds.css。data.js／design.js／character-palettes.css 與導覽查詢版號更新為 20261014mv30。

### 驗證與預覽
- check-all-worlds.cjs：150 檔雜湊不同、透明通道與圖片解碼正常；30 主題 × 320／390／768／1440 大字級布局無溢出、觸控大小、十款新陪伴圖、通知保留、五入口、零 JS 例外及正式 Firebase 請求。
- check-theme-apply-all.cjs：在拋棄式瀏覽器的 mock 資料提高 XP（未修改使用者預覽資料或正式資料），實際操作套用全部 30 主題、150 次五分頁切換及每款重新整理持續性皆通過。
- themes.cjs：30 門檻、三系列順序與篩選、150 組首頁布局、30 張圖像通過；最後選色提示更新後再跑通過。
- palettes.cjs：30 款色彩組合不同、任務／導覽文字對比至少 4.5:1、手機無溢出通過。
- interactions.cjs：任務完成／取消、心情儲存、已解鎖套用與未解鎖限制、成就詳情及五尺寸通過，零 JS 例外及正式請求。
- 人工檢視 _qa/navigation-all-30.png 全部導覽、Ruka 與 Pharita 手機整頁。其他 QA 包含 _qa/mv-live-{id}.png 十款手機畫面、_qa/worlds-all-30.png。
- 總覽 http://localhost:8765/completion-gallery.html （來源 preview/completion-gallery.html，建置器 preview/build-worlds-gallery.cjs），顯示十款實際手機截圖與三十套展示座總覽，可點圖放大。主互動預覽仍 http://localhost:8765/app.html。
- preview/build.py 保留總覽、舊試稿頁並複製必要 QA 圖，排除 mv-study 原稿 PNG 以縮小預覽。_preview 只供隔離測試，不可發布。整合腳本 preview/integrate-mv.cjs 與 integrate-navigation-all.cjs 記錄此次應用方式。

### 尚待使用者最後預覽／發布拍板
- 本機預覽已更新，正式網站未部署、未提交。本輪沒有更動任何正式家庭紀錄、積分、成就判定或解鎖規則。
- 真機 iPhone／iPad Safari 驗收仍待完成。
- 正式上線前必須先完成舊版桌面／手機截圖存證、記錄正式 SHA；上線後製作繁體中文「改版前 vs 改版後」家庭分享報告。既有必做要求仍有效。
