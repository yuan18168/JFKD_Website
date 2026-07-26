# 【JFKD】家規獎懲系統

家庭專屬的成績獎懲儀表板網站。取代 Google Sheet，家人可以直接在網頁上新增成績、自動計算獎金與處罰，並用圖表看歷史趨勢。

- **前端**：純 HTML / CSS / JavaScript，不需要任何建置工具（build tool），可直接放上 GitHub Pages。
- **後端資料庫**：Firebase（Google 出品，免費額度足夠一般家庭使用）
  - Firebase Authentication：Google 帳號登入
  - Cloud Firestore：儲存學生、成績、獎懲規則
- **登入保護**：僅限白名單內的家人 Google Email 登入

---

## 目錄結構

```
jfkd-family-rules/
├── index.html          # 總覽頁（登入後首頁）
├── student.html         # 單一學生詳細頁（新增成績、看趨勢圖）
├── config.html          # 獎懲規則設定頁（級距獎金、進步獎金、全科加碼、學生名單）
├── login.html            # 登入頁
├── css/style.css         # 樣式
├── js/
│   ├── firebase-config.js  # ⚠️ 需要您自己填入 Firebase 金鑰與家人 Email 白名單
│   ├── auth.js              # 登入驗證邏輯
│   ├── calc.js               # 獎懲計算邏輯（還原自 Google Sheet 公式）
│   ├── data.js                # Firestore 讀寫
│   ├── nav.js                  # 側邊欄選單
│   ├── dashboard.js             # 總覽頁邏輯
│   ├── student.js                # 學生詳細頁邏輯
│   └── config.js                  # 規則設定頁邏輯
└── firestore.rules         # Firestore 安全規則（要貼到 Firebase 主控台）
```

---

## 上線步驟

整個流程分成三大階段：**① 申請帳號 → ② 設定 Firebase 資料庫 → ③ 部署到 GitHub Pages**。
全部都是「免費」方案，不需要輸入信用卡。

### 步驟 1：申請 GitHub 帳號

1. 前往 [github.com](https://github.com) → 右上角「Sign up」。
2. 輸入 Email、密碼、使用者名稱（例如 `jerry-chang`），完成驗證。
3. 註冊完成後，建議設定「兩步驟驗證」（Settings → Password and authentication）增加帳號安全性。

### 步驟 2：在 GitHub 建立一個新的 Repository

1. 登入後點右上角「+」→「New repository」。
2. Repository name 填 `JFKD_Website`（或您喜歡的名稱）。
3. 選擇 **Public**（GitHub Pages 免費方案需要 Public repo；別擔心，網站本身有 Google 帳號白名單保護，資料庫也有安全規則，外人看到程式碼也進不去您的資料）。
4. 不要勾選「Add a README file」（我們已經準備好檔案了）。
5. 點「Create repository」。

### 步驟 3：把網站程式碼上傳到 GitHub

最簡單的方式是用瀏覽器直接拖曳上傳，不需要安裝任何軟體：

1. 進入剛建立的 repository 頁面，點「uploading an existing file」（或 Add file → Upload files）。
2. 把 `JFKD_Website` 資料夾裡「全部」的檔案與資料夾拖進去（`index.html`、`css/`、`js/` 等）。
3. 下方填寫 commit message，例如「初版上傳」，點「Commit changes」。

> 之後如果我幫您修改程式碼，也會用同樣方式提供新檔案，您只要重新上傳覆蓋即可；熟悉之後也可以改用 GitHub Desktop 或 `git` 指令，會更方便。

### 步驟 4：設定 Firebase（資料庫 + 登入）

1. 前往 [console.firebase.google.com](https://console.firebase.google.com)，用您的 Google 帳號登入。
2. 點「新增專案」，專案名稱填 `JFKD_Website`，可以關閉 Google Analytics（不需要），建立專案。
3. 進入專案後，左側選單「Build → Authentication」→「開始使用」→ 在「Sign-in method」啟用 **Google** 這個登入方式，儲存。
4. 左側選單「Build → Firestore Database」→「建立資料庫」→ 選「以正式版模式啟動」→ 選離您最近的地區（如 `asia-east1` 台灣）→ 完成。
5. 進入 Firestore 的「規則 Rules」分頁，把整份內容換成本專案資料夾裡 `firestore.rules` 的內容，並把裡面的 Email 改成您們全家的 Google Email，按「發布」。
6. 回到「專案總覽」（左上角齒輪 → 專案設定）→ 往下捲到「我的應用程式」→ 點網頁圖示 `</>` → 應用程式暱稱填 `jfkd-web` → 註冊。
7. 系統會顯示一段 `firebaseConfig = {...}` 程式碼，把裡面的 `apiKey`、`authDomain`、`projectId` 等值，複製貼到您資料夾裡的 `js/firebase-config.js`（取代 `YOUR_API_KEY` 等佔位文字）。
8. 同一個檔案裡的 `ALLOWED_EMAILS` 陣列，填入全家會登入的 Google Email（要跟步驟 5 的 `firestore.rules` 白名單一致）。
9. 存檔後，重新上傳這個檔案到 GitHub（覆蓋步驟 3 上傳的舊版本）。

### 步驟 5：開啟 GitHub Pages

1. 回到 GitHub repository 頁面 → 上方「Settings」→ 左側「Pages」。
2. Source 選擇「Deploy from a branch」，Branch 選 `main`，資料夾選 `/ (root)`，點「Save」。
3. 等待 1～2 分鐘，畫面會出現網址，例如：
   `https://您的帳號.github.io/jfkd-family-rules/login.html`
4. 打開這個網址，用白名單裡的 Google 帳號登入，就完成上線了！

> 建議把這個網址加到手機主畫面（瀏覽器選單「加入主畫面」），開起來就像一個 App。

---

## 獎懲計算邏輯說明（還原自您的 Google Sheet）

| 項目 | 規則 |
|---|---|
| 基礎獎金（翻倍） | 每科依分數對應級距（100分／95-100／90-94／80-89／<80）取得基礎獎金，該科在本次考試「名次」第 1 名 ×1、第 2 名 ×2、第 3 名 ×4，依此類推 |
| 進步獎金 | 與上次同科分數相比，每進步 1 分 +5 元（可在設定頁調整） |
| 衛冕獎金 | 該科這次與上次都達 90 分以上，依「這次的級距」加發 |
| 全科加碼獎金 | 本次全部科目都達到同一級距（以最低那科為準），依科目數（3科／5科）整組加發 |
| 處罰機制 | 任一科低於 80 分 → 標記「需處罰」，實際執行方式在設定頁的文字說明（例如體罰、進步計劃）由家長人工執行 |

這是盡量還原試算表公式的近似邏輯。如果實際計算跟您認定的獎金有落差，新增紀錄時可以填「手動覆寫總額」欄位，直接以您輸入的金額為準，不影響其他紀錄。

所有級距金額、進步獎金、全科加碼、處罰說明，都可以在網站的「獎懲規則設定」頁隨時調整，全站即時套用，不需要改程式碼。

---

## 之後可以擴充（第二階段）

等這個「家規獎懲系統」上線穩定後，您提到的第二份 Google Sheet 可以用同樣的架構（新增一個 Firestore collection + 對應頁面）整合進同一個網站，變成完整的 JFKD 家庭入口網站。

## 遇到問題怎麼辦

把錯誤訊息或截圖丟給我，我可以幫您判斷是「GitHub Pages 設定」「Firebase 設定」還是「程式碼」的問題。
