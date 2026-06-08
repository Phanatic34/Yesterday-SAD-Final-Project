# Yesterday — 同步總譜管理與註記系統

[![tests](https://github.com/Phanatic34/Yesterday-SAD-Final-Project/actions/workflows/test.yml/badge.svg)](https://github.com/Phanatic34/Yesterday-SAD-Final-Project/actions/workflows/test.yml)

Yesterday 是一套為樂團（特別是弦樂團）設計的線上總譜協作平台。樂團上傳整份總譜後，系統會解析並產生各聲部的分譜，協助首席線上完成弓法、力度、音色等註記，並在偵測到不同聲部應有一致演奏方式的段落時自動同步、衝突時自動提示，最終一鍵匯出包含所有註記的分譜與總譜。

> 課程：SAD（Systems Analysis and Design）期末專案

---

## 目錄

- [專案目的](#專案目的)
- [主要功能](#主要功能)
- [技術架構](#技術架構)
- [檔案架構](#檔案架構)
- [安裝說明](#安裝說明)
- [開發與啟動方式](#開發與啟動方式)
- [環境變數](#環境變數)
- [資料庫初始化](#資料庫初始化)
- [使用方法](#使用方法)
- [API 概覽](#api-概覽)
- [角色與權限](#角色與權限)
- [常見問題](#常見問題)

---

## 專案目的

樂團演奏需要協調各個聲部，例如小提琴和大提琴在演奏同一段落時，弓法的上下必須要相同。在目前實務上：

- 各聲部的首席會各自在自己聲部的分譜上做註記（弓法、力度、音色等）。
- 整個樂團還會有一份總譜，需要把各聲部的註記彙整在一起。
- 要對齊各聲部時，只能在團練時逐行確認，或傳送有註記的分譜 PDF 給其他首席手動核對，**耗時且容易出現疏漏**。

Yesterday 想解決的痛點：

1. **自動拆譜**：上傳一份 MusicXML 總譜，系統解析後生成各聲部分譜。
2. **跨聲部同步**：系統分析出「不同聲部需要一致演奏方式」的段落，註記後自動同步到其他聲部。
3. **衝突偵測**：偵測兩個聲部註記不一致或互相衝突的情況，主動通知指揮與首席協調。
4. **版本控制**：以類 Git 的方式記錄歷代版本、比較版本、建立分支與合併。
5. **一鍵輸出**：完成編輯後輸出各聲部分譜與含註記的總譜（MusicXML / PDF）。

詳細功能藍圖請參考 [`functional map.mmd`](./functional%20map.mmd)；後端 API 契約請參考 [`backend/README-backend.md`](./backend/README-backend.md)；雲端部署（Vercel 前端 + Railway 後端／OMR）請參考 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

---

## 主要功能

- **專案與成員**：建立合奏專案、設定身分與樂器、檢視成員清單（含頭像）。**邀請碼綁定角色＋聲部**——邀請者選好「首席／團員」與聲部後產生邀請碼，被邀請者貼上即依該設定加入。
- **曲目與樂譜管理**：以「曲目（piece）×聲部」為單位管理樂譜；上傳 **MusicXML / XML / MXL**，或上傳 **PDF 經 OMR（Audiveris）自動轉成 MusicXML**，儲存於 Supabase Storage。專案內所有成員皆可瀏覽全部聲部樂譜。
- **註記編輯器**：在瀏覽器內以 OpenSheetMusicDisplay 渲染樂譜，提供畫筆（上下弓、圓滑線、漸強漸弱、staccato/accent/tenuto/fermata 等）、滴管、復原/重做、縮放等工具，並可把編輯後的 MusicXML 存回後端。
- **私人／共用註記**：註記與樂譜本體分離儲存，分 `private`（個人）與 `shared`（聲部共用）兩種；shared 由聲部首席維護。
- **跨聲部同步與弓法建議**：後端解析各聲部旋律，偵測「相同小節」的相似段落並標色提示；可掃描整首曲目，把首席標好的 shared 弓法**建議**同步到相似的其他聲部。
- **歷史紀錄（類 Git）**：歷代版本、版本比較、版本切換、分支與合併（合併權限保留給群主／指揮）。
- **總譜合成與輸出**：後端即時把同一首曲目的各聲部分譜合併成一份多部總譜，前端以 OpenSheetMusicDisplay 渲染（指揮檢視），並把跨樂器相似段落標色提示以利對齊弓法；可匯出 MusicXML（PDF 規劃中）。
- **介面偏好**：支援**中／英雙語**切換與**淺色／深色**模式，偏好存於 `localStorage`。
- **管理員後台**：平台管理員可檢視所有專案、刪除專案、新增管理員帳號。

---

## 技術架構

### 前端

| 項目 | 內容 |
| --- | --- |
| 框架 | React 19 + TypeScript |
| 建構工具 | Vite |
| 路由 | react-router-dom v7 |
| 樣式 | Tailwind CSS v4（含淺色／深色主題） |
| 國際化 | 自建 i18n（`src/i18n.ts`，中／英雙語） |
| 圖標 | lucide-react |
| 樂譜渲染 | opensheetmusicdisplay |
| 認證 | @react-oauth/google + 自建 JWT context |

### 後端

| 項目 | 內容 |
| --- | --- |
| Runtime | Node.js（**CommonJS**） |
| Web Framework | Express 5 |
| 資料庫 | Supabase PostgreSQL（`@supabase/supabase-js`） |
| 認證 | bcrypt + JWT；Google ID Token 驗證（`google-auth-library`） |
| 檔案上傳 | `multer`（multipart）、`jszip`（解壓 `.mxl`） |
| 中介層 | `authMiddleware`、`projectPermissionMiddleware`、`loadScoreMiddleware`、`canEditScoreMiddleware`（已啟用於 MusicXML 儲存） |
| 回應格式 | 統一 `sendSuccess` / `sendError`；全域 `notFound` + `errorHandler` |

### OMR 轉檔服務（PDF → MusicXML）

| 項目 | 內容 |
| --- | --- |
| Runtime | Python 3.11 |
| Web Framework | FastAPI + Uvicorn |
| OMR 引擎 | Audiveris 5.10.2（含 poppler / pdf2image / Tesseract） |
| 位置 | `services/omr/`（獨立服務，後端以 `OMR_SERVICE_URL` 代理） |

### 通訊

- 前端開發伺服器（Vite）`5173`：`/api` 透過 proxy 轉發到後端。
- 後端 `3001`：對外 Base URL 為 `http://localhost:3001/api`。
- OMR 服務 `8000`：由後端 `conversionService` 透過 `OMR_SERVICE_URL` 呼叫，不直接對前端開放。

---

## 檔案架構

```
Yesterday-SAD-Final-Project/
├── README.md                      # 本檔案
├── DEPLOYMENT.md                  # 部署說明（Vercel 前端 + Railway 後端/OMR）
├── functional map.mmd             # 功能藍圖（Mermaid mindmap）
├── package.json                   # 前端 + monorepo 入口（含 dev/build/dev:omr 腳本）
├── vite.config.ts                 # Vite 設定（含 /api proxy）
├── tsconfig*.json                 # TypeScript 編譯設定
├── eslint.config.js               # ESLint 設定
├── index.html                     # Vite 入口 HTML
├── .env.example                   # 前端 + 後端共用環境變數樣板
├── Dockerfile                     # 前端容器映像（multi-stage：vite build → nginx）
├── nginx.conf                     # 前端容器內的 nginx 設定（SPA fallback + /api proxy）
├── docker-compose.yml             # 一鍵起前後端服務
├── .dockerignore                  # 前端 build context 排除清單
│
├── public/                        # 靜態資源（Vite public）
│   ├── favicon.svg
│   ├── icons.svg
│   ├── musicxml/                  # 範例 MusicXML（Dvorak Sym. 9）
│   └── pdf/                       # 範例分譜 PDF
│
├── pdf/                           # 原始 PDF 素材（不直接給前端用）
│
├── src/                           # 前端原始碼（React + TS）
│   ├── main.tsx                   # 入口；包 GoogleOAuthProvider
│   ├── App.tsx                    # 路由設定
│   ├── index.css                  # Tailwind 全域樣式（含深色主題變數）
│   ├── i18n.ts                    # 中／英雙語字串與 useTranslation
│   ├── types.ts                   # 共用 TypeScript 型別
│   ├── vite-env.d.ts
│   ├── api/
│   │   ├── client.ts              # fetch 包裝、token 儲存、401 處理
│   │   ├── auth.ts                # /auth/* 呼叫
│   │   ├── projects.ts            # /projects/* 呼叫
│   │   ├── scores.ts              # /scores/*、上傳/編輯 呼叫
│   │   ├── pieces.ts              # /projects/:id/pieces/* 呼叫
│   │   ├── annotations.ts         # 註記 CRUD 呼叫
│   │   ├── conversions.ts         # PDF→MusicXML 轉檔工作呼叫
│   │   ├── mappers.ts             # API ↔ 前端型別轉換
│   │   └── types.ts               # API 回應型別
│   ├── auth/
│   │   ├── AuthContext.tsx        # 使用者狀態 context
│   │   ├── ProtectedRoute.tsx     # 需登入路由守衛
│   │   └── GuestRoute.tsx         # 未登入專用路由（登入頁等）
│   ├── config/
│   │   └── env.ts                 # 讀取 VITE_* 環境變數
│   ├── state/
│   │   └── AppState.tsx           # 全域應用狀態（含語言、深淺色偏好）
│   ├── mock/
│   │   └── mockData.ts            # 開發用假資料
│   ├── utils/
│   │   └── sectionLabels.ts       # 聲部代碼 → 中／英顯示名稱
│   ├── assets/                    # 前端內嵌資源
│   └── ui/
│       ├── layout/                # AppLayout / PublicLayout / HeaderBar / Sidebar / ToastStack
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── HomePage.tsx       # 登入後首頁（dashboard）
│       │   ├── ProjectsPage.tsx
│       │   ├── ProjectFormPage.tsx  # 建立／編輯專案表單（/projects/new、/edit）
│       │   ├── ProjectDetailPage.tsx
│       │   ├── ScoreEditorPage.tsx
│       │   ├── ScoreMusicXmlPage.tsx  # MusicXML 註記編輯器（OSMD）
│       │   ├── ScorePdfViewPage.tsx
│       │   ├── SettingsPage.tsx     # 偏好設定（語言、深淺色）
│       │   ├── UserProfilePage.tsx
│       │   ├── AdminDashboardPage.tsx
│       │   ├── modals/
│       │   │   └── CreateProjectModal.tsx
│       │   └── project/           # 專案詳情頁子面板
│       │       ├── PiecesPanel.tsx          # 曲目列表/排序/上傳入口
│       │       ├── PieceSectionUploadModal.tsx  # 單一(曲目×聲部)上傳/轉檔
│       │       ├── MembersPanel.tsx
│       │       ├── BranchesPanel.tsx
│       │       ├── VersionsPanel.tsx
│       │       └── FullScorePanel.tsx
│       ├── primitives/            # Button / Card / Badge / Modal / Avatar
│       └── utils/
│           └── cn.ts              # className 合併工具
│
├── backend/                       # 後端服務（Express, CommonJS）
│   ├── package.json
│   ├── .env.example
│   ├── Dockerfile                 # 後端容器映像（node:22-alpine, USER node）
│   ├── .dockerignore
│   ├── README-backend.md          # 後端 API 詳細契約
│   ├── tests/                     # node:test 測試
│   │   ├── helpers/
│   │   │   ├── testEnv.js         # 測試前設定 env vars
│   │   │   ├── fakeSupabase.js    # 記憶體版 supabase client（給 integration / E2E test 用）
│   │   │   ├── httpHarness.js     # 把 Express 綁到 ephemeral port + fetch helper
│   │   │   └── fixtures.js        # seed sections / users / JWT
│   │   ├── utils/                 # response / appError / jwt / inviteToken
│   │   ├── middlewares/           # errorHandler
│   │   ├── services/              # scoreService / projectService / historyService（純單元 + service-level integration）
│   │   ├── integration/           # HTTP 層整合測試（health / auth / projects / invites / scores）
│   │   └── e2e/                   # 多步驟 user journey 測試
│   └── src/
│       ├── server.js              # 啟動 Express server
│       ├── app.js                 # 組裝 Express middleware 與路由
│       ├── config/
│       │   ├── env.js             # 讀取環境變數
│       │   └── supabase.js        # Supabase client
│       ├── routes/
│       │   ├── index.js           # /api 入口；掛載 /auth /sections /projects /scores /annotations /conversions /health
│       │   ├── authRoutes.js
│       │   ├── sectionRoutes.js   # GET /sections（聲部清單）
│       │   ├── projectRoutes.js   # 專案 / 曲目 / 樂譜上傳 / 轉檔
│       │   ├── scoreRoutes.js     # 樂譜讀寫 / 註記 / 相似掃描
│       │   ├── annotationRoutes.js # PATCH / DELETE 單筆註記
│       │   ├── conversionRoutes.js # 轉檔狀態 / 結果 MusicXML
│       │   └── historyRoutes.js   # branches / commits / merges（git-like 歷史）
│       ├── controllers/           # auth / section / project / piece / score / annotation / conversion / history / health
│       ├── services/              # 商業邏輯（auth / section / project / piece / score / annotation / annotationPermission / melodySimilarity / fullScore / conversion / history）
│       ├── middlewares/
│       │   ├── authMiddleware.js              # Bearer JWT 驗證
│       │   ├── projectPermissionMiddleware.js # 專案成員權限
│       │   ├── loadScoreMiddleware.js         # 預先載入 score
│       │   ├── canEditScoreMiddleware.js      # 編輯權限（預留）
│       │   ├── notFound.js
│       │   └── errorHandler.js
│       └── utils/
│           ├── jwt.js             # JWT 簽發/驗證
│           ├── inviteToken.js     # 邀請碼簽發/驗證
│           ├── musicXmlMetadata.js # 上傳時正規化 MusicXML metadata（標題/作曲家/part-name）
│           ├── mxlUtils.js        # 解壓 .mxl 取出 MusicXML
│           ├── response.js        # sendSuccess / sendError
│           └── appError.js        # 自訂錯誤類別
│
├── services/
│   └── omr/                       # PDF→MusicXML OMR 微服務（Python / FastAPI / Audiveris）
│       ├── Dockerfile             # 兩階段：建置 Audiveris 5.10.2 → 執行 FastAPI
│       ├── main.py                # FastAPI 入口（/upload /status /result.. /health）
│       ├── requirements.txt
│       ├── engines/               # OMR 引擎封裝（audiveris_engine.py）
│       ├── utils/                 # MusicXML / 影像前處理工具
│       ├── templates/、static/    # 內建上傳/預覽 Web UI
│       └── jobs/                  # 轉檔工作輸出（Railway volume 掛載點）
│
└── supabase/
    ├── schema.sql                 # 建表、索引、view、trigger（含 score_annotations）
    ├── seed.sql                   # 範例資料（聲部、使用者、專案、樂譜）
    └── migrations/
        └── 20260604_add_score_annotations.sql  # 註記表（既有 DB 增量套用）
```

---

## 安裝說明

### 先決條件

- **Node.js** ≥ 18（建議 LTS，因為 Express 5 + Vite 8 對版本敏感）
- **npm** ≥ 9
- 一個可用的 **Supabase** 專案（提供 PostgreSQL 與 Storage）
- 一組 **Google OAuth Client ID**（若要啟用 Google 登入）

### 取得程式碼

```bash
git clone <repo-url>
cd Yesterday-SAD-Final-Project
```

### 安裝依賴

根目錄已設定 `postinstall`，會自動安裝 `backend/` 內的依賴：

```bash
npm install
```

> 若只想單獨安裝後端依賴，可在 `backend/` 目錄下執行 `npm install`。

---

## 開發與啟動方式

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 同時啟動前端（Vite, `:5173`）與後端（Nodemon, `:3001`），輸出以 `frontend` / `backend` 區分顏色 |
| `npm run dev:all` | 同時啟動前端、後端與 **OMR 服務**（`:8000`），三色前綴 |
| `npm run dev:frontend` | 只啟動 Vite 前端 |
| `npm run dev:backend` | 只啟動後端 |
| `npm run dev:omr` | 只啟動 OMR Python 服務（Uvicorn, `:8000`；需先建立 `services/omr/.venv` 或安裝其 `requirements.txt`） |
| `npm run build` | 執行 `tsc -b && vite build` 建置前端 |
| `npm run preview` | 預覽前端 production build |
| `npm run lint` | 執行 ESLint |
| `npm test --prefix backend` | 跑後端測試（Node 內建 `node:test`，零額外依賴） |
| `npm start --prefix backend` | 以 `node` 直接啟動後端（production 用） |

啟動成功後：

- 前端：<http://localhost:5173>
- 後端 API：<http://localhost:3001/api>
- 健康檢查：<http://localhost:3001/api/health>

Vite 已設定把 `/api/*` 反向代理到 `:3001`，前端程式可直接呼叫相對路徑 `/api/...` 或使用 `VITE_API_URL`。

---

## Docker

如果你想用容器跑（接近 production 的方式），repo 已附：

- `Dockerfile`（根目錄）— 前端，multi-stage：`node:22-alpine` build → `nginx:1.27-alpine` 提供 `dist/` 並把 `/api/*` 反代到 `backend` 服務。
- `nginx.conf`（根目錄）— SPA fallback、`/api` proxy、Vite hashed assets 的 1 年快取設定。
- `backend/Dockerfile` — 後端，`node:22-alpine` + `npm ci --omit=dev`，runtime 用 `node` 使用者執行。
- `services/omr/Dockerfile` — OMR 服務，兩階段建置 Audiveris 5.10.2 後跑 FastAPI。
- `docker-compose.yml`（根目錄）— 把 `backend`（`:3001`）、`omr`（`:8000`，附 `omr-jobs` volume）與 `frontend`（host `:8080` → container `:80`）一起拉起來；backend 用 `/api/health`、omr 用 `/health` 做 healthcheck，`frontend` 等到 backend `healthy` 才啟動，後端以 `OMR_SERVICE_URL=http://omr:8000` 連到 OMR 服務。

### 前置條件

確保 repo 根目錄有 `.env` 並包含必填變數（同 [環境變數](#環境變數) 那節）：

```dotenv
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
JWT_SECRET=...
# 選填
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_ID=...
# 選填，預設 /api 走 nginx proxy
VITE_API_URL=/api
```

`docker compose` 會自動把根目錄 `.env` 拿去做變數代換；缺 `SUPABASE_URL`、`SUPABASE_ANON_KEY` 或 `JWT_SECRET` 任一個會直接讓 compose 報錯（必填守門）。

### 常用指令

```bash
# 建置並啟動
docker compose up --build

# 背景啟動
docker compose up -d --build

# 看 log
docker compose logs -f backend
docker compose logs -f frontend

# 停止並清掉容器
docker compose down
```

啟動後：

- 前端：<http://localhost:8080>
- 後端 API：<http://localhost:3001/api>（也可從前端的 `/api` 走）
- 健康檢查：<http://localhost:3001/api/health>

### 重要注意

- **Vite 變數會在 build time 寫死進 bundle**。`VITE_API_URL` 與 `VITE_GOOGLE_CLIENT_ID` 改了之後必須 `docker compose build frontend` 重 build；只 `up` 不會生效。
- **Supabase 不在 compose 中**。本專案用外部 Supabase，沒有本機 DB 容器；compose 負責 frontend + backend + omr 三個服務。
- **OMR 服務首次 build 很久**：`services/omr/Dockerfile` 會從 GitHub clone 並用 Gradle 編譯 Audiveris 5.10.2，初次建置耗時且需要網路；轉檔工作輸出存在 `omr-jobs` volume。OMR 服務在 <http://localhost:8000>（`/health` 可測）。
- **`/api` 路徑**：前端容器內的 nginx 把 `/api/*` 反代到 `backend:3001/api/*`，所以前端可以一直用相對路徑 `/api/...`，跟 dev 模式行為一致。
- **port 8080**：用 8080 而不是 80 是為了避免要 sudo / 與系統 web server 衝突；要改可在 `docker-compose.yml` 改 `ports:`。
- **後端 port 3001 仍對外開放**，方便用 curl / Postman 直接打 backend。要做真正的 sealed production 部署，把 `backend.ports` 整個註解掉。

---

## 環境變數

複製 `.env.example` 為 `.env`（**放在專案根目錄**），根目錄 `.env` 同時涵蓋前端（`VITE_*`）與後端：

```dotenv
# Frontend (Vite)
VITE_API_URL=http://localhost:3001/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Backend (Express)
NODE_ENV=development
PORT=3001
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
# OMR 轉檔服務位址（後端代理 PDF→MusicXML 用），預設 http://127.0.0.1:8000
OMR_SERVICE_URL=http://127.0.0.1:8000
```

如果只要單獨運行後端，也可以另外在 `backend/.env` 放後端那一段（已附 `backend/.env.example`）。

### 變數說明

- `VITE_API_URL`：前端呼叫後端的 base URL，預設 `http://localhost:3001/api`。
- `VITE_GOOGLE_CLIENT_ID`：給 `@react-oauth/google` 用。未設定時前端會跳過 Google 登入按鈕的 Provider。
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`：後端連到 Supabase 用。
- `JWT_SECRET`：簽發 JWT 與邀請碼。請改成夠長的隨機字串。
- `JWT_EXPIRES_IN`：JWT 有效期，預設 `7d`（邀請碼固定 7 天）。
- `GOOGLE_CLIENT_ID`：後端驗證 Google ID Token 用，需與前端 `VITE_GOOGLE_CLIENT_ID` 一致。
- `OMR_SERVICE_URL`：後端呼叫 OMR（PDF→MusicXML）服務的位址，預設 `http://127.0.0.1:8000`。未啟動 OMR 服務時，PDF 轉檔相關 API 會回 `502`。

---

## 資料庫初始化

1. 在 Supabase 建立一個新專案，取得 `SUPABASE_URL` 與 `anon key`。
2. 開啟 Supabase SQL Editor，依序執行：
   - [`supabase/schema.sql`](./supabase/schema.sql)：建立 `users` / `sections` / `projects` / `project_members` / `pieces` / `scores` / `score_annotations` / `project_invites` / `branches` / `commits` 等資料表、view、index、trigger。
   - [`supabase/seed.sql`](./supabase/seed.sql)：載入範例資料（5 個聲部、1 名 admin、5 名首席、20 名團員、1 個示範專案、10 份樂譜）。
3. 在 Supabase Storage 建立名為 `scores` 的 bucket（與 schema 中預設值一致）。

> 若資料庫是在加入「私人／共用註記」功能**之前**就建好的，請另外套用
> [`supabase/migrations/20260604_add_score_annotations.sql`](./supabase/migrations/20260604_add_score_annotations.sql)
> 補上 `score_annotations` 表（全新建立的 `schema.sql` 已內含，不必重複套用）。否則註記 API 會回 `503`。

> seed 中的所有測試帳號密碼皆為 `password123`。例如：
> - `admin@orchestra.test`（平台管理員）
> - `concertmaster@orchestra.test`（總首席）
> - `principal.cello@orchestra.test`（大提琴首席）
> - …等

---

## 使用方法

以下流程對應 [`functional map.mmd`](./functional%20map.mmd) 的主幹功能。

1. **登入**：在 `/login` 以 email/password 或 Google 帳號登入。前端會把 JWT 存到 `localStorage`（key 為 `yesterday_auth_token`）。
2. **建立或加入專案**：
   - 群主：在「我的專案」按建立 → 填入名稱、描述、所屬聲部（`sectionId`）。
   - 邀請：群主或聲部首席在專案頁面選定「角色＋聲部」產生邀請碼。
   - 受邀者：在「加入專案」貼上邀請碼即可，角色與聲部由邀請碼決定（**不再自選**）。
3. **建立曲目並上傳樂譜**：群主在「曲目」面板新增曲目；接著為「曲目×聲部」上傳 **MusicXML / XML / MXL**，或上傳 **PDF**（後端送 OMR 轉成 MusicXML 後再匯入）。
4. **編輯與註記**：進入 Score Editor，使用畫筆/滴管工具標註上下弓、圓滑線、漸強漸弱、staccato/accent/tenuto/fermata 等；可存回 MusicXML。註記分**私人**與**共用**（共用由聲部首席維護），系統會在相同段落提示跨聲部相似處。
5. **版本與分支**：可建立分支、比較版本、切換版本；分支合併權限保留給群主。
6. **總譜合成與輸出**：在「總譜預覽」面板選擇曲目並按「產生總譜」，後端會即時把該曲目所有可見聲部合併成一份多部總譜並回傳；前端以 OSMD 渲染，把跨樂器相似段落（相同小節）標色並於側欄列出，提醒指揮確認上下弓一致，最後可匯出 MusicXML（PDF 規劃中）。
7. **偏好設定**：在 `/settings` 切換中／英語言與淺色／深色模式（偏好存於 `localStorage`）。

> 詳細的編輯器互動、衝突偵測 UI 仍在持續打磨。後端目前已完成認證、專案、**成員列表**、角色綁定**邀請**、**曲目管理**、樂譜列表/讀取與**上傳**（JSON 與 multipart，含 **PDF→MusicXML OMR 轉檔**；會自動依專案內 piece 標題 find-or-create）、樂譜 MusicXML 儲存（`PATCH /api/scores/:scoreId/musicxml`）與刪除、**私人／共用註記 API**、跨聲部**相似段落偵測**與**弓法同步建議**、**總譜合成匯出**（`GET /api/projects/:projectId/pieces/:pieceId/full-score`，即時合併各聲部為多部總譜並附跨樂器相似提示），以及對應 functional map「歷史紀錄_用git_」的分支／commit／比較／合併 API（合併權限限定 concertmaster）。

---

## API 概覽

完整契約請見 [`backend/README-backend.md`](./backend/README-backend.md)。重點摘要：

| Method | Path | 說明 |
| --- | --- | --- |
| `GET` | `/api/health` | 健康檢查 |
| `POST` | `/api/auth/register` | 帳密註冊 |
| `POST` | `/api/auth/login` | 帳密登入，回傳 JWT |
| `POST` | `/api/auth/google` | Google ID Token 換成自家 JWT |
| `GET` | `/api/auth/me` | 取得目前登入者 |
| `GET` | `/api/sections` | 列出所有聲部 |
| `POST` | `/api/projects` | 建立專案（必填 `sectionId`） |
| `GET` | `/api/projects` | 列出可見專案 |
| `GET` | `/api/projects/:projectId` | 取得單一專案 |
| `GET` | `/api/projects/:projectId/members` | 列出專案成員（含頭像） |
| `POST` | `/api/projects/:projectId/invite-code` | 產生邀請碼（body `{ targetRole, sectionId }`） |
| `POST` | `/api/projects/join-by-code` | 用邀請碼加入專案（body `{ inviteCode }`） |
| `GET` | `/api/projects/:projectId/pieces` | 列出曲目 |
| `POST` | `/api/projects/:projectId/pieces` | 建立曲目（concertmaster） |
| `PATCH` | `/api/projects/:projectId/pieces/reorder` | 曲目重新排序（concertmaster） |
| `PATCH` | `/api/projects/:projectId/pieces/:pieceId` | 改曲目名稱（concertmaster） |
| `DELETE` | `/api/projects/:projectId/pieces/:pieceId` | 刪除曲目（concertmaster） |
| `GET` | `/api/projects/:projectId/scores` | 列出專案中可見的樂譜（所有成員可見全部聲部） |
| `POST` | `/api/projects/:projectId/scores` | 上傳樂譜（JSON `{ sectionId, title, piece, xmlContent }`；principal 限自己聲部） |
| `POST` | `/api/projects/:projectId/scores/upload` | 直接上傳譜檔（multipart；XML/MXL 直接建立、PDF 觸發轉檔） |
| `GET` | `/api/scores/:scoreId` | 取得單一樂譜 metadata（含 `xml_content`） |
| `PATCH` | `/api/scores/:scoreId/musicxml` | 儲存編輯後的 MusicXML（concertmaster / principal） |
| `DELETE` | `/api/scores/:scoreId` | 刪除樂譜（principal 限自己聲部） |
| `GET` | `/api/scores/:scoreId/annotations` | 列出可見註記 |
| `POST` | `/api/scores/:scoreId/annotations` | 建立註記（private／shared） |
| `PATCH` | `/api/annotations/:annotationId` | 更新註記 |
| `DELETE` | `/api/annotations/:annotationId` | 刪除註記 |
| `POST` | `/api/scores/:scoreId/similar-passages` | 找與選取片段相似的段落 |
| `POST` | `/api/scores/:scoreId/similar-passages/scan` | 整份樂譜相似掃描 |
| `POST` | `/api/projects/:projectId/pieces/:pieceId/similar-passages/scan` | 整首曲目跨聲部相似掃描 |
| `POST` | `/api/projects/:projectId/pieces/:pieceId/bowing-suggestions/scan` | 弓法同步建議掃描 |
| `POST` | `/api/projects/:projectId/conversions` | 啟動 PDF→MusicXML 轉檔（multipart） |
| `GET` | `/api/conversions/:jobId` | 查詢轉檔狀態 |
| `GET` | `/api/conversions/:jobId/musicxml` | 取得轉檔結果 MusicXML |
| `POST` | `/api/projects/:projectId/conversions/:jobId/import` | 把轉檔結果匯入成樂譜 |
| `GET` | `/api/projects/:projectId/pieces/:pieceId/full-score` | 即時合成多部總譜（MusicXML）+ 跨聲部相似提示（指揮用） |
| `GET` | `/api/projects/:projectId/branches` | 列出分支 |
| `POST` | `/api/projects/:projectId/branches` | 建立分支（body `{ name, fromCommitId? }`） |
| `GET` | `/api/projects/:projectId/branches/:branchId` | 取得分支 |
| `PATCH` | `/api/projects/:projectId/branches/:branchId` | 版本切換 / 改名（concertmaster） |
| `DELETE` | `/api/projects/:projectId/branches/:branchId` | 刪除分支（concertmaster；不可刪 default） |
| `GET` | `/api/projects/:projectId/branches/:branchId/commits` | 列出該分支的歷代版本 |
| `POST` | `/api/projects/:projectId/branches/:branchId/commits` | 新增 commit（concertmaster / principal） |
| `GET` | `/api/projects/:projectId/commits/:commitId` | 取得 commit 詳情與 score_versions |
| `GET` | `/api/projects/:projectId/commits/compare?from=&to=` | 比較兩個 commits |
| `POST` | `/api/projects/:projectId/merges` | 合併分支（**僅 concertmaster**） |

回應一律包含 `success` / `message` / `data` / `error` 四個欄位。需要登入的 API 必須帶：

```http
Authorization: Bearer <jwt>
```

---

## 角色與權限

樂譜**瀏覽**已放寬：所有專案成員都看得到專案內全部聲部的樂譜。**上傳／編輯／註記／曲目管理**仍依角色限制：

| 角色 | 樂譜瀏覽 | 上傳／編輯／刪除樂譜 | 曲目管理 | 邀請碼 | 註記 |
| --- | --- | --- | --- | --- | --- |
| `platform_admin` | 全部 | 任意聲部 | 可 | 任意角色／聲部 | 任意聲部 |
| `concertmaster`（總首席） | 專案全部聲部 | 任意聲部 | 可 | 任意角色／聲部 | 可建 private（任意聲部） |
| `principal`（聲部首席） | 專案全部聲部 | 限自己聲部 | 不可 | 限自己聲部的 `member` | 可建／改 private 與**該聲部 shared** |
| `member`（一般團員） | 專案全部聲部 | 不可 | 不可 | 不可 | 限自己聲部的 private |

商業規則（由資料庫 unique index 強制）：

- 每個專案僅一名 `concertmaster`。
- 每個專案的每個聲部僅一名 `principal`。
- 同一首曲目（piece）的每個聲部僅一份樂譜（`scores_piece_section_unique`）。

---

## 測試

後端目前已建立測試套件，前端則尚未導入測試框架。

### 後端

- **執行方式**：`npm test --prefix backend`（或在 `backend/` 內 `npm test`）。
- **執行器**：Node 內建的 `node:test`（不需額外安裝任何套件，要求 Node 18+ / CI 用 22；HTTP harness 仰賴全域 `fetch`）。
- **測試類型**：純單元測試（pure helpers）→ 服務層整合測試（記憶體版 Supabase）→ HTTP 層整合測試（真正啟動 Express 並用 `fetch` 打）→ 多步驟 E2E 旅程測試。
- **測試目錄結構**（`backend/tests/`）：
  - `helpers/testEnv.js`：每個測試的第一行 `require("../helpers/testEnv")` 會先把 `JWT_SECRET`、`SUPABASE_URL` 等測試環境變數塞進 `process.env`，再 require 任何 production module。
  - `helpers/fakeSupabase.js`：記憶體版 supabase client，模擬 `.from().select().eq().in().order().limit().single()/.maybeSingle()` 等鏈式 API，會依 `select("col1, col2")` 投影欄位（模擬 Postgres 行為，避免 `password_hash` 之類欄位意外外洩）；也模擬 `branches`、`pieces`、`scores` 上的 unique 約束。透過 `require.cache` 注入。
  - `helpers/httpHarness.js`：把 Express app bind 到 ephemeral port，並提供 `request(method, path, { body, token })` 用全域 `fetch` 發 request。每個 HTTP 測試檔 `test.after(harness.stop)` 收尾。
  - `helpers/fixtures.js`：seed 5 個聲部、seed user（內建 bcrypt 雜湊的 `password123` 供登入測試）、`signAccessToken` 直接簽 JWT 供需要繞過 bcrypt 的測試使用。
  - `utils/`、`middlewares/`、`services/*.test.js`：純單元測試（含 `mxlUtils.test.js`、`annotationService.test.js`、`annotationPermissionService.test.js`、`melodySimilarityService.test.js`）。
  - `services/scoreService.upload.*.test.js`：上傳 payload 驗證、權限矩陣、xml_content 持久化、`(piece, section)` 重複 409、`fileType` 變體、`storage_bucket` 覆寫等。
  - `services/historyService.*.test.js`：分支／commit／compare／merge 服務層測試。
  - `integration/*.http.test.js`：HTTP 層測試，把 request 從 Express 入口打完整路徑：
    - `health.http.test.js` — `/api/health` 與未知 route 的錯誤封套。
    - `auth.http.test.js` — register / login（真正跑 bcrypt）/ `/auth/me` 的 401／403 / 200 路徑。
    - `projects.http.test.js` — projects 建立、列表、依角色可視；platform_admin 看全部；非成員 403；不存在 404。
    - `invites.http.test.js` — 角色綁定邀請碼（`{ targetRole, sectionId }`）與 `join-by-code` 雙端流程，含 principal 越權建立、重複加入 409、過期/撤銷 410。
    - `pieces.http.test.js` — 曲目 CRUD 與排序、權限（僅 concertmaster）、同名 409。
    - `scores.http.test.js` — 上傳 happy path、auth/permission 401／403、`(piece, section)` 409、principal 跨聲部 403、musicxml 儲存與刪除、可視範圍。
    - `annotations.http.test.js` — private／shared 註記 CRUD 與讀寫權限矩陣。
    - `bowingSuggestions.http.test.js` — 跨聲部相似掃描與弓法同步建議。
  - `e2e/*.test.js`：多步驟 user journey：
    - `concertmasterJourney.test.js` — 註冊 → 登入 → 取得使用者 → 建立 project → 上傳 2 份不同聲部的樂譜（共用同一個 piece）→ list → get。
    - `inviteAndUploadJourney.test.js` — CM 建專案後，為第二小提琴發一張 `principal` 邀請碼（綁定角色＋聲部）；受邀者用邀請碼加入即為該聲部 principal → 上傳自己聲部 OK／跨聲部 403；CM 與 principal 列表都看到雙聲部（可視範圍已放寬）。
    - `historyJourney.test.js` — 完整跑一遍 git-like 流程：建立 default branch → 連兩個 commit → list → compare → 開 feature 分支 → 在分支上 commit → merge 回主幹並驗證 head 推進與 score_versions 採用 feature 分支版本。

  目前共 **229 個測試**，全部通過（執行時間約 4 秒）。

- **CI**：GitHub Actions workflow 設定在 `.github/workflows/test.yml`。每次 `push`（任何分支）與 PR 進 `main` 時會自動在 Ubuntu + Node 22 上 `npm ci` 並執行 `npm test --prefix backend`。

### 前端

Vite 專案天然搭配 Vitest，但目前 `package.json` 還沒安裝 `vitest`／`@testing-library/react`／`jsdom` 等套件，也尚未撰寫測試。若要補上，可優先針對：

- `src/api/client.ts` 的 token 儲存與 401 處理
- `src/auth/AuthContext.tsx` 的登入／登出流程
- `src/state/AppState.tsx` 的 reducer 行為

---

## 常見問題

- **`401 Unauthorized`**：八成是沒帶 `Authorization` header，或格式拼錯成 `Bearer<token>`（少空格）。前端 `apiRequest` 會在 401 時自動清除 token 並觸發登出。
- **`400 Invalid sectionId`**：建立專案或加入專案時 `sectionId` 必須是 `sections.id` 中既存的 UUID。先用 `seed.sql` 載入聲部資料。
- **`409 conflict`**：註冊時 email 重複，或加入專案時你已是該專案成員。
- **`scores` 沒有 `file_url`**：MVP 階段回傳的是 Storage metadata（`storage_bucket` / `storage_path` / `file_type` …），由前端自行向 Supabase Storage 取檔。
- **Google 登入按鈕看不到**：確認 `VITE_GOOGLE_CLIENT_ID` 已設定且重啟 Vite。後端則需要相同的 `GOOGLE_CLIENT_ID`。
- **前端打不到後端**：確認 `npm run dev` 兩條 process 都活著，或檢查 `vite.config.ts` 的 proxy 目標是不是 `:3001`。

---

歡迎開 issue 或 PR。專案仍在迭代中，部分功能（編輯器同步細節、總譜 PDF 匯出）為規劃中或開發中。
