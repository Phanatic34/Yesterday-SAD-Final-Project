# 後端 API 使用說明（前端整合）

本文件說明目前 MVP 階段前端需要對接的後端 API 契約與使用注意事項。

## 技術架構（Backend）

- Runtime：Node.js（CommonJS）
- Web Framework：Express.js
- Database：Supabase PostgreSQL（`@supabase/supabase-js`）
- Auth：
  - 帳密登入：bcrypt + JWT
  - Google 登入：Google ID Token 驗證 + JWT
- 樂譜轉換（OMR）：
  - PDF 透過獨立的 Python / FastAPI OMR 服務（Audiveris）轉成 MusicXML
  - 後端以 `OMR_SERVICE_URL` 代理該服務（`conversionService`）
- 檔案處理：
  - `multer`（memory storage，單檔上限 50 MB）接收 multipart 上傳
  - `jszip` 解壓 `.mxl` 取出內含的 MusicXML
- Middleware：
  - `authMiddleware`：Bearer Token 驗證
  - `loadScoreMiddleware`：依 `:scoreId` 預載 `req.score`
  - `projectPermissionMiddleware("params" | "score")`：專案成員權限檢查
  - `canEditScoreMiddleware`：編輯權限；**現已掛載**於 `PATCH /scores/:scoreId/musicxml`
- Error Handling：
  - 全域 `notFound` + `errorHandler`
  - 統一 response 格式（`sendSuccess` / `sendError`）

## 基本資訊

- 本機 API Base URL：`http://localhost:3001/api`
- 請求 Body 格式：`application/json`
- 需要登入的 API 請帶 JWT：
  - `Authorization: Bearer <token>`

## 回傳格式（統一）

成功回傳範例：

```json
{
  "success": true,
  "message": "string",
  "data": {},
  "error": null
}
```

失敗回傳範例：

```json
{
  "success": false,
  "message": "string",
  "data": null,
  "error": {}
}
```

## 前端呼叫注意事項（務必先看）

- 所有需要登入的 API，如果沒帶 `Authorization` 會回 `401`。
- `Authorization` 格式必須是 `Bearer <token>`，少空白或拼錯都會 `401`。
- 建立專案 `POST /projects` 目前 **必填** `sectionId`，未傳會 `400`。
- 目前 `scores` 回傳的是 Storage metadata，不是 `file_url`：
  - `storage_bucket`, `storage_path`, `file_type`, `original_filename`, `mime_type`, `file_size_bytes`
  - 讀單一樂譜（`GET /scores/:scoreId`）與上傳回應另含 `piece_id` 與 `xml_content`（inline MusicXML 字串）。
- **樂譜可視範圍已放寬**：只要是專案成員（含 `member`／`principal`）都可看到專案內**所有聲部**的樂譜列表與內容；上傳與註記仍受聲部限制（見下方各節）。
- inline MusicXML 上限由 5 MB 提高到 **20 MB**（Express body 限制亦同步為 `20mb`）。
- 權限不足時：
  - 非專案成員查專案/樂譜回 `403`
  - 查詢不存在資料回 `404`
- 註記儲存表（`score_annotations`）若尚未套用 migration，註記 API 會回 `503`，提示套用
  `supabase/migrations/20260604_add_score_annotations.sql`。
- 需要聲部清單（建立專案、邀請、上傳選聲部）時，呼叫 `GET /api/sections`（需登入），
  回傳 `[{ id, code, name, sort_order, created_at }]`，依 `sort_order` 排序。

## 一、認證 API

### 1) `POST /auth/register`（一般註冊）

用途：用 email/password/name 建立帳號。

Request body：

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "王小明"
}
```

注意：

- `email`、`password`、`name` 都必填。
- email 重複會失敗（通常 `409`）。
- 回傳 user 不會包含 `password_hash`。

### 2) `POST /auth/login`（一般登入）

用途：使用 email/password 登入並取得 JWT。

Request body：

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

成功後請把 `data.token` 存起來，後續呼叫受保護 API 都要帶。

### 3) `POST /auth/google`（Google 登入）

用途：前端拿到 Google `idToken` 後送到後端換自己的 JWT。

Request body：

```json
{
  "idToken": "google-id-token"
}
```

注意：

- 後端需設定 `GOOGLE_CLIENT_ID`。
- 資料表 `users` 需有 `google_sub` 欄位。

### 4) `GET /auth/me`（取得目前登入使用者）

用途：驗證 token 是否有效並取得目前使用者資料。

Header：

```http
Authorization: Bearer <token>
```

---

## 二、專案 API

### 1) `POST /projects`（建立專案）

用途：建立專案，並把建立者自動加入 `project_members`（角色為 `concertmaster`）。

Header：

```http
Authorization: Bearer <token>
```

Request body：

```json
{
  "name": "弦樂團期末音樂會",
  "description": "2026 春季演出",
  "sectionId": "11111111-1111-1111-1111-111111111101"
}
```

必填參數：

- `name`：專案名稱
- `sectionId`：建立者所屬聲部（`sections.id`）

注意：

- `sectionId` 不可省略，否則回 `400`。
- `sectionId` 必須是資料庫中存在的 `sections.id`（有效 UUID），若不存在會回 `400`（`Invalid sectionId: section does not exist`）。
- `created_by` 會寫入目前登入者。

### 2) `GET /projects`（專案列表）

用途：依登入者權限取得可見專案。

權限規則：

- `platform_admin`：可看全部專案
- 其他使用者：只看自己有加入 `project_members` 的專案

### 3) `GET /projects/:projectId`（單一專案）

用途：查詢特定專案詳細資料。

權限規則：

- `platform_admin`：可查看
- 其他使用者：必須為該專案成員，否則 `403`

### 4) `POST /projects/:projectId/invite-code`（建立邀請碼）

用途：為指定專案產生可分享的邀請碼（JWT token 字串）。**邀請碼現在綁定「角色」與
「聲部」**——被邀請者一旦加入，角色與聲部直接套用邀請碼內容，加入時不再自選。

Header：

```http
Authorization: Bearer <token>
```

Request body（**必填**）：

```json
{
  "targetRole": "member",
  "sectionId": "11111111-1111-1111-1111-111111111102"
}
```

必填參數：

- `targetRole`：被邀請者加入後的角色，只能是 `principal` 或 `member`。
- `sectionId`：被邀請者加入後的聲部（必須是有效 `sections.id`）。

權限規則：

- `platform_admin`、專案 `concertmaster`：可為任何聲部建立 `principal` 或 `member` 邀請碼。
- 專案 `principal`：**只能**建立自己聲部的 `member` 邀請碼。
  - 邀請 `principal` 角色 → `403`
  - 邀請非自己聲部 → `403`
- 其他角色／非成員：`403`。

Response `data`：

```json
{
  "inviteCode": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "targetRole": "member",
  "sectionId": "11111111-1111-1111-1111-111111111102",
  "expiresAt": "iso-timestamp"
}
```

注意：

- 邀請碼沿用 `JWT_SECRET` 進行簽發與驗證（MVP 簡化方案），並在 `project_invites`
  資料表寫入一筆記錄（`token_id`、`target_role`、`target_section_id`、`expires_at`）。
- 邀請碼有效時間固定為 **7 天**（`expiresAt`）。
- 邀請碼為**一次性**：使用後該筆 invite 會標記 `used_at`，不可重複使用。

可能錯誤：

- `400`：`targetRole` 非 `principal`/`member`、`sectionId` 缺少或不存在。
- `403`：權限不足（如 `principal` 嘗試建立其他聲部或 `principal` 角色的邀請碼）。
- `404`：專案不存在。

### 5) `POST /projects/join-by-code`（用邀請碼加入專案）

用途：登入使用者透過邀請碼加入專案。加入後的**角色與聲部由邀請碼決定**（建立邀請碼時
已綁定），呼叫端不再傳 `sectionId`。

Header：

```http
Authorization: Bearer <token>
```

Request body：

```json
{
  "inviteCode": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
}
```

必填參數：

- `inviteCode`：由建立邀請碼 API 取得。

可能錯誤：

- `400`：`inviteCode` 缺少或無效。
- `409`：該使用者已經是專案成員。
- `410`：邀請碼已被使用過、已撤銷，或已過期。

### 6) `GET /projects/:projectId/members`（專案成員列表）

用途：列出專案所有成員（供成員面板顯示）。需為該專案成員，否則 `403`；`platform_admin` 例外。

Response `data`（陣列，依聲部與角色排序）：

```json
[
  {
    "project_member_id": "uuid",
    "project_id": "uuid",
    "user_id": "uuid",
    "user_name": "王小明",
    "user_email": "user@example.com",
    "section_id": "uuid",
    "section_code": "first_violin",
    "section_name": "First Violin",
    "role": "principal",
    "user_avatar_url": "https://... | null",
    "created_at": "iso-timestamp",
    "updated_at": "iso-timestamp"
  }
]
```

---

## 二之二、曲目（pieces）API

曲目（piece）是「同一首曲子」的容器，底下掛各聲部的樂譜（scores）。曲目管理權限限定
`concertmaster` 與 `platform_admin`，列表則所有專案成員可看。所有路由都掛在
`/api/projects/:projectId/...`，需登入且為專案成員（`platform_admin` 例外）。

### 1) `GET /projects/:projectId/pieces`（曲目列表）

依 `sort_order` 由小到大回傳該專案所有曲目。

Response `data`（陣列）：

```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "title": "Symphony No. 5",
    "composer": "Beethoven | null",
    "sort_order": 1,
    "created_by": "uuid",
    "created_at": "iso-timestamp",
    "updated_at": "iso-timestamp"
  }
]
```

### 2) `POST /projects/:projectId/pieces`（建立曲目）

權限：`concertmaster`、`platform_admin`，否則 `403`。

Request body：

```json
{
  "title": "Symphony No. 5",
  "composer": "Beethoven",
  "sortOrder": 1
}
```

- `title`：必填。
- `composer`：選填。
- `sortOrder`：選填正整數；未提供時自動接續最大 `sort_order + 1`。
- 同專案內 `title` 重複會回 `409`。

### 3) `PATCH /projects/:projectId/pieces/reorder`（重新排序）

權限：`concertmaster`、`platform_admin`。

Request body：

```json
{ "orderedPieceIds": ["uuid-a", "uuid-b", "uuid-c"] }
```

- `orderedPieceIds`：非空陣列，必須**剛好包含**該專案的每一個 piece id、不可有未知 id 或重複，否則 `400`。
- 回傳重排後的完整曲目列表。

### 4) `PATCH /projects/:projectId/pieces/:pieceId`（改名）

權限：`concertmaster`、`platform_admin`。Request body：`{ "title": "新曲名" }`（必填）。
piece 不屬於此專案回 `404`；同名衝突回 `409`。

### 5) `DELETE /projects/:projectId/pieces/:pieceId`（刪除曲目）

權限：`concertmaster`、`platform_admin`。連動刪除其底下的 scores（`on delete cascade`）。
piece 不屬於此專案回 `404`。回傳 `{ "id": "uuid" }`。

---

## 三、樂譜 API

### 1) `GET /projects/:projectId/scores`（查專案樂譜列表）

用途：取得該專案中目前使用者可見的樂譜。

權限規則（**已放寬：所有專案成員皆可見全部聲部**）：

- `platform_admin`、`concertmaster`、`principal`、`member`：同 project **全部聲部**可見。
- 非專案成員：`403`。

> 註：可視範圍放寬只影響「樂譜瀏覽」。**上傳**、**註記**、**曲目／合併的相似掃描**等仍各自有聲部限制。

### 2) `GET /scores/:scoreId`（查單一樂譜）

用途：依 scoreId 取得樂譜 metadata（含 `piece_id` 與 inline `xml_content`）。

流程：

1. 先載入 score（`loadScoreMiddleware`）
2. 檢查是否為該專案成員（或 admin），否則 `403`
3. 套用上述可視規則（目前所有成員皆可見全部聲部）

### 3) `POST /projects/:projectId/scores`（上傳樂譜）

用途：對應 `functional map.mmd` 的「上傳樂譜」。在指定專案中為某個曲目
（piece）× 某個聲部建立一份樂譜。同一個專案中同名曲目會自動共用一個
`piece` row。

權限規則：

- `platform_admin`、`concertmaster`：可為任何聲部上傳
- `principal`：**只能為自己的 `section_id` 上傳**
- `member`：不可上傳，固定 `403`
- 非專案成員：`403`

Header：

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Request body：

```json
{
  "sectionId": "11111111-1111-1111-1111-111111111101",
  "title": "第一小提琴 - Beethoven 5th - Movement 1",
  "piece": { "title": "Symphony No. 5", "composer": "Beethoven" },
  "fileType": "musicxml",
  "xmlContent": "<?xml version=\"1.0\"?>...<score-partwise>...</score-partwise>",
  "originalFilename": "beethoven_5_m1_violin1.musicxml",
  "mimeType": "application/vnd.recordare.musicxml+xml",
  "fileSizeBytes": 182044
}
```

必填參數：

- `sectionId`：聲部 UUID，必須是資料庫中存在的 `sections.id`。
- `title`：這份樂譜的標題（例：第一小提琴 - Beethoven 5th）。
- **曲目擇一**：
  - `piece.title`（與選用的 `piece.composer`）：依 `(project_id, title)` 在
    `pieces` 中尋找，找不到則自動建立並指派下一個 `sort_order`。
  - `pieceId`：直接指定既有的 `pieces.id`（必須屬於同專案，否則 `404`）。
- **檔案內容擇一**：
  - `xmlContent`：MusicXML / XML 檔案內容字串（≤ 20 MB；超出回 `413`）。寫入
    `scores.xml_content`，並由後端自動合成 `storage_path`。寫入前會先做
    metadata 正規化（補上 work-title、作曲家、聲部 part-name，並清掉 `music21 fragment`
    這類預設標題）。
  - `storagePath`：若前端已先把檔案上傳到 Supabase Storage，直接傳 path。
    此時 `xmlContent` 不必填、`scores.xml_content` 將為 `null`。

可選參數：

- `fileType`：`musicxml`、`xml`、`mxl` 三選一，預設 `musicxml`。
- `storageBucket`：預設 `scores`。
- `originalFilename`、`mimeType`、`fileSizeBytes`：metadata，未提供即為 `null`。

可能錯誤：

- `400`：必填欄位缺少、`fileType` 不合法、同時提供 `pieceId` 與 `piece.title`、
  同時都沒提供、`sectionId` 不存在。
- `403`：權限不足（如 `principal` 試圖上傳到其他聲部，或 `member` 嘗試上傳）。
- `404`：`pieceId` 不屬於此 `projectId`。
- `409`：`(piece_id, section_id)` 已存在一份樂譜（schema 的
  `scores_piece_section_unique` 約束）。
- `413`：`xmlContent` 超過 20 MB 上限。

Response（`201`）`data`：

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "piece_id": "uuid",
  "section_id": "uuid",
  "title": "第一小提琴 - Beethoven 5th - Movement 1",
  "storage_bucket": "scores",
  "storage_path": "inline/<project>/<piece>/<section>.musicxml",
  "file_type": "musicxml",
  "original_filename": "beethoven_5_m1_violin1.musicxml",
  "mime_type": "application/vnd.recordare.musicxml+xml",
  "file_size_bytes": 182044,
  "xml_content": "<?xml ...",
  "created_by": "uuid",
  "created_at": "iso-timestamp",
  "updated_at": "iso-timestamp"
}
```

> 上傳採用 `application/json`（MVP 簡化方案）；前端讀取檔案後以字串放在
> `xmlContent`。若要直接傳檔（含 PDF / MXL），改用下方的 `…/scores/upload`。

### 4) `POST /projects/:projectId/scores/upload`（直接上傳檔案，multipart）

用途：以 `multipart/form-data` 直接上傳譜檔，後端依副檔名自動處理。權限同
`POST …/scores`（`member` 不可上傳、`principal` 限自己聲部）。

- form 欄位 `file`：譜檔（單檔上限 50 MB）。
- 其餘欄位（`sectionId`、`title`、`pieceId` 或 `pieceTitle`/`pieceComposer` 等）以 form 欄位帶上。

依副檔名行為：

- `.xml` / `.musicxml`：讀成字串、驗證像 MusicXML 後，比照 `xmlContent` 建立樂譜（`201`）。
- `.mxl`：以 `jszip` 解壓取出內含 MusicXML 後建立樂譜（`fileType = mxl`，`201`）。
- `.pdf`：**不直接建立樂譜**，而是丟給 OMR 服務啟動轉檔工作，回 `202` 與
  `{ jobId, status: "queued", originalFilename }`（後續流程見「三之二、PDF 轉檔（OMR）」）。
- 其他副檔名：`400`。

### 5) `PATCH /scores/:scoreId/musicxml`（儲存編輯後的 MusicXML）

用途：把編輯器改動後的整份 MusicXML 存回 `scores.xml_content`。對應前端 Score Editor 的「儲存」。

權限（`canEditScoreMiddleware`，**現已掛載**）：

- `platform_admin`、`concertmaster`：可編輯任何聲部。
- `principal`：只能編輯自己 `section_id` 的樂譜。
- `member`：不可編輯（`403`）。

Request body：

```json
{ "xmlContent": "<?xml ...><score-partwise>...</score-partwise>" }
```

- `xmlContent`：非空字串，否則 `400`；超過 20 MB 回 `413`。
- 回傳更新後的樂譜（含 `xml_content`）。

### 6) `DELETE /scores/:scoreId`（刪除樂譜）

權限同上傳（`platform_admin`／`concertmaster` 任意聲部；`principal` 限自己聲部；`member` `403`）。
成功回傳被刪除的樂譜物件。

---

## 三之二、PDF 轉檔（OMR）API

對應「上傳樂譜」中 PDF → MusicXML 的光學樂譜辨識流程。後端本身不做辨識，而是把工作代理給
獨立的 Python / FastAPI **OMR 服務**（以 Audiveris 引擎，位於 `services/omr/`），透過
`OMR_SERVICE_URL` 連線。轉檔工作狀態目前存在後端記憶體（`jobs` Map），與 `userId`／`projectId` 綁定。

### 1) `POST /projects/:projectId/conversions`（啟動轉檔，multipart）

- form 欄位 `file`：PDF 檔；非 `.pdf` 回 `400`。
- 選填 `preprocessMode`：`none`（預設）/ `basic` / `high_contrast` / `resize` / `classical_part` / `thin_ink`，其他值 `400`。
- 回 `202`：`{ jobId, status: "queued", originalFilename }`。
- OMR 服務無法連線回 `502`。

> `POST …/scores/upload` 上傳 PDF 時也會走同一條轉檔流程並回 `202`。

### 2) `GET /conversions/:jobId`（查詢轉檔狀態）

回傳 OMR 服務的工作狀態（`status`、頁數進度、`error_message` 等），外加
`project_id`、`original_filename`。工作不存在回 `404`，非工作擁有者回 `403`。

### 3) `GET /conversions/:jobId/musicxml`、`GET /conversions/:jobId/pages/:pageNumber/musicxml`

直接回傳轉檔結果的 MusicXML（`Content-Type: application/vnd.recordare.musicxml+xml`）：
前者是整份合併結果，後者是指定頁。

### 4) `POST /projects/:projectId/conversions/:jobId/import`（把轉檔結果存成樂譜）

用途：把某個完成的轉檔工作匯入成正式樂譜。後端會抓取該工作的完整 MusicXML，
組成上傳 payload（`fileType = musicxml`）後走一般的 `uploadScore` 流程。

Request body：與 `POST …/scores` 相同的曲目／聲部欄位（`sectionId`、`title`、
`pieceId` 或 `pieceTitle`/`pieceComposer`）。成功回 `201` 與新建立的樂譜。

---

## 三之三、註記（annotations）API

對應註記編輯器的「弓法、力度、發音等」標記。註記與樂譜本體（`scores.xml_content`）**分離**
儲存在 `score_annotations` 表，分成 `shared`（聲部共用）與 `private`（個人）兩種 scope，
之後再疊加渲染。所有路由需登入且為專案成員（`platform_admin` 例外）。

> 若資料庫尚未套用 `supabase/migrations/20260604_add_score_annotations.sql`，
> 註記 API 會回 `503` 並提示套用該 migration。

註記欄位：

- `scope`：`shared` | `private`。
- `annotationType`：`bowing` | `dynamic` | `articulation` | `slur` | `hairpin` | `text`。
- `targetRef`：非空物件，描述標記指向的音符位置（前端自定）。
- `payload`：非空物件，標記內容（前端自定）。

權限規則：

| 動作 | 規則 |
| --- | --- |
| 讀 `private` | 只有 `owner` 本人 |
| 讀 `shared` | `concertmaster`／`platform_admin` 看全部；`principal`／`member` 只看自己聲部的 shared 註記 |
| 建立 `private` | `concertmaster`／`platform_admin` 任意聲部；`principal`／`member` 限自己聲部；`owner` 必為自己 |
| 建立 `shared` | **僅該聲部的 `principal`**（且樂譜與目標皆為自己聲部） |
| 改 / 刪 `private` | `owner` 本人 |
| 改 / 刪 `shared` | **僅該聲部的 `principal`** |

### 1) `GET /scores/:scoreId/annotations`（列出可見註記）

依上述讀取規則過濾後回傳該樂譜的註記陣列（依 `createdAt` 由舊到新）。

### 2) `POST /scores/:scoreId/annotations`（建立註記）

Request body：

```json
{
  "scope": "shared",
  "annotationType": "bowing",
  "sectionId": "uuid（選填，預設取樂譜聲部）",
  "targetRef": { "measureNumber": 12, "noteIndex": 0 },
  "payload": { "bowing": "down-bow" }
}
```

成功回 `201`。欄位驗證失敗 `400`，權限不足 `403`。

### 3) `PATCH /annotations/:annotationId`（更新註記）

Request body：`targetRef`、`payload` **至少一個**（不可改 `scope`，否則 `400`）。
找不到回 `404`，無權限回 `403`。

### 4) `DELETE /annotations/:annotationId`（刪除註記）

找不到回 `404`，無權限回 `403`。回傳被刪除的註記。

---

## 三之四、相似段落與弓法同步建議 API

對應「跨聲部同步」與「衝突偵測」的偵測層。後端解析各聲部 inline MusicXML，比對旋律
（音程 70% + 節奏 30%）。相似度與筆數有預設門檻：scan 類預設 `threshold = 0.78`、
`windowSizes = [8, 12, 16]`、`maxHighlights = 20`（皆可由 body 覆寫）。

### 1) `POST /scores/:scoreId/similar-passages`（找出與選取片段相似的段落）

Request body 需含 `sourceRange`（`{ startRef, endRef }`，至少 4 個音）；選填
`threshold`（預設 `0.7`）、`limit`（預設 `10`）、`targetSectionIds`。在**同曲目其他聲部**中
找相似片段。回傳候選**陣列**（含 `targetScoreId`、`startMeasureNumber`、`endMeasureNumber`、
`similarity`、`intervalScore`、`rhythmScore`、`noteCount` 等）。
來源片段過短或找不到 ref → `400`。

### 2) `POST /scores/:scoreId/similar-passages/scan`（整份樂譜掃描）

不需 `sourceRange`，掃描整份來源樂譜對同曲目其他聲部。回傳 `{ "highlights": [...] }`，
每筆含 `sourceStartMeasureNumber`/`sourceEndMeasureNumber` 與
`targetStartMeasureNumber`/`targetEndMeasureNumber` 等。

### 3) `POST /projects/:projectId/pieces/:pieceId/similar-passages/scan`（整首曲目掃描）

對整首曲目的**所有可見聲部**兩兩掃描。回傳 `{ "highlights": [...] }`，每筆為跨聲部配對
（`leftScoreId`/`leftSectionName`/`leftStartMeasureNumber`…與對應的 `right*` 欄位）。
此處可視範圍**較嚴格**：`concertmaster`／`platform_admin` 看全部聲部，`principal`／`member`
只比對自己聲部。（同一份 highlights 也用於 `…/full-score` 的標色提示。）

### 4) `POST /projects/:projectId/pieces/:pieceId/bowing-suggestions/scan`（弓法同步建議）

在整首曲目找相似段落後，把**已標記為 shared 的弓法**（MusicXML 內帶
`data-user-bowing="true"` 且 `data-bowing-layer="shared"` 的 `up-bow`/`down-bow`）
依比例映射到相似的其他聲部，產生「建議他聲部跟著上下弓」的清單。

回傳：

```json
{
  "suggestions": [
    {
      "id": "string",
      "sourceScoreId": "uuid",
      "sourceSectionName": "First Violin",
      "sourceMeasureRange": "m.5–8",
      "targetScoreId": "uuid",
      "targetSectionName": "Cello",
      "targetRef": { "measureNumber": 5, "noteIndex": 0, "...": "..." },
      "bowingType": "down-bow",
      "similarity": 0.91,
      "status": "pending"
    }
  ]
}
```

不足兩份可見樂譜時回 `{ "suggestions": [] }`。

---

## 三之五、歷史紀錄 API（git-like history）

對應 `functional map.mmd` 的「歷史紀錄_用git_」分支。所有路由都掛在
`/api/projects/:projectId/...` 底下，並要求：

- 必須登入（`Authorization: Bearer <token>`）。
- 必須是該專案成員，否則回 `403`；`platform_admin` 例外。

權限規則速查：

| 動作 | 允許的角色 |
| --- | --- |
| 列出 / 查詢 branches、commits、compare | 所有專案成員（含 `platform_admin`） |
| 建立 branch (`POST /branches`) | 所有專案成員 |
| 改 branch head 或改名 (`PATCH /branches/:branchId`) | `concertmaster`、`platform_admin` |
| 刪除 branch (`DELETE /branches/:branchId`) | `concertmaster`、`platform_admin`；不可刪 `is_default` |
| 建立 commit (`POST /branches/:branchId/commits`) | `concertmaster`、`principal`、`platform_admin`；`principal` 只能 commit 自己聲部的 score |
| 合併 branch (`POST /merges`) | `concertmaster`、`platform_admin`（對應「群主才可以合併」） |

可視範圍補充：`principal` / `member` 呼叫 `GET /commits/:commitId` 與
`GET /commits/compare` 時，回傳的 `score_versions` 會自動只保留**自己聲部**的
紀錄；commit metadata（message、author、時間）仍可看到。

### 1) `GET /projects/:projectId/branches`（列出分支）

用途：列出該專案所有分支。回傳會把 `is_default = true` 的分支排在最前面。

Response `data`（陣列）：

```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "name": "main",
    "head_commit_id": "uuid | null",
    "is_default": true,
    "created_by": "uuid",
    "created_at": "iso-timestamp",
    "updated_at": "iso-timestamp"
  }
]
```

### 2) `POST /projects/:projectId/branches`（建立分支）

用途：建立新分支。專案第一條分支會自動成為 `is_default = true`。

Request body：

```json
{
  "name": "feature/bowing-fix",
  "fromCommitId": "uuid"
}
```

必填參數：

- `name`：分支名稱；同一專案內不可重複，否則回 `409`。

可選參數：

- `fromCommitId`：自哪個 commit 分出來；若提供必須屬於同一專案，否則回 `404`。未提供時 `head_commit_id` 為 `null`（空分支）。

### 3) `GET /projects/:projectId/branches/:branchId`

用途：取得單一分支詳細資料。分支不存在回 `404`。

### 4) `PATCH /projects/:projectId/branches/:branchId`（版本切換 / 改名）

用途：對應「版本切換」。把 `head_commit_id` 移到任一 commit，或重新命名分支。
僅 `concertmaster`、`platform_admin` 可操作，否則回 `403`。

Request body（兩個欄位至少要有一個）：

```json
{
  "headCommitId": "uuid | null",
  "name": "new-name"
}
```

注意：

- `headCommitId` 必須是同專案的 commit，否則回 `404`。
- `headCommitId: null` 可清空（回到尚未 commit 的狀態）。
- 沒有任何可更新欄位回 `400`。

### 5) `DELETE /projects/:projectId/branches/:branchId`（刪除分支）

權限：`concertmaster`、`platform_admin`。

注意：

- 不能刪除 `is_default = true` 的分支，會回 `400`。
- 連動：相關 commits（`on delete cascade`）與其 `score_versions` 會一併移除。

### 6) `GET /projects/:projectId/branches/:branchId/commits`（歷代版本）

用途：對應「歷代版本」。列出指定分支上所有 commits（依 `created_at` 倒序）。

Response `data`（陣列）：

```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "branch_id": "uuid",
    "parent_commit_id": "uuid | null",
    "merge_parent_commit_id": "uuid | null",
    "message": "string",
    "author_user_id": "uuid",
    "created_at": "iso-timestamp"
  }
]
```

### 7) `POST /projects/:projectId/branches/:branchId/commits`（建立 commit）

用途：在指定分支上新增一個 commit，並把指定的 score 變更打成 snapshot。

權限：`concertmaster`、`principal`、`platform_admin`。`principal` 不能對非自己
聲部的 score 建立 commit，否則回 `403`。

Request body：

```json
{
  "message": "Update violin1 bowing in m. 10-15",
  "scoreSnapshots": [
    {
      "scoreId": "uuid",
      "storageBucket": "scores",
      "storagePath": "projects/<id>/violin1/...musicxml",
      "fileType": "musicxml",
      "originalFilename": "violin1-r3.musicxml",
      "mimeType": "application/vnd.recordare.musicxml+xml",
      "fileSizeBytes": 182044
    }
  ]
}
```

必填參數：

- `message`：commit 訊息。
- `scoreSnapshots`：非空陣列。每筆必須含 `scoreId`、`storagePath`、`fileType`（`musicxml` / `xml` / `mxl`）。`storageBucket` 預設 `scores`。

可選參數（每筆 snapshot）：

- `originalFilename`、`mimeType`、`fileSizeBytes`：metadata，未提供視為 `null`。

行為：

- 新 commit 的 `parent_commit_id` = 該分支當下的 `head_commit_id`。
- score_versions 內容 = 父 commit 的 score_versions ∪ 本次 `scoreSnapshots`（同 `scoreId` 時以本次為準），確保每個 commit 都包含所有 scores 的完整快照。
- 成功後該分支的 `head_commit_id` 會更新為新 commit。

Response `data`：

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "branch_id": "uuid",
  "parent_commit_id": "uuid | null",
  "merge_parent_commit_id": null,
  "message": "string",
  "author_user_id": "uuid",
  "created_at": "iso-timestamp",
  "score_versions": [
    {
      "id": "uuid",
      "commit_id": "uuid",
      "score_id": "uuid",
      "storage_bucket": "scores",
      "storage_path": "string",
      "file_type": "musicxml",
      "original_filename": "string | null",
      "mime_type": "string | null",
      "file_size_bytes": 123,
      "created_at": "iso-timestamp"
    }
  ]
}
```

### 8) `GET /projects/:projectId/commits/:commitId`（單一 commit）

用途：取得 commit 詳細資料（含 score_versions）。`principal` / `member`
僅看得到自己聲部的 score_versions。

Response 同 `POST /commits` 的回傳格式。

### 9) `GET /projects/:projectId/commits/compare`（比較版本）

用途：對應「比較版本」。比對兩個 commits 的 score_versions 差異。

Query string：

- `from`（必填）：起點 commitId（必須屬於同專案）。
- `to`（必填）：終點 commitId（必須屬於同專案）。

Response `data`：

```json
{
  "from": { "id": "uuid", "...": "..." },
  "to": { "id": "uuid", "...": "..." },
  "added":     [{ "scoreId": "uuid", "from": null, "to": { "...": "..." } }],
  "removed":   [{ "scoreId": "uuid", "from": { "...": "..." }, "to": null }],
  "modified":  [{ "scoreId": "uuid", "from": { "...": "..." }, "to": { "...": "..." } }],
  "unchanged": [{ "scoreId": "uuid", "from": { "...": "..." }, "to": { "...": "..." } }]
}
```

分類規則：以 `(storage_bucket, storage_path)` 是否相等判斷 `modified` 與
`unchanged`。`principal` / `member` 只會看到自己聲部的 scoreId。

### 10) `GET /projects/:projectId/merges/preview`（合併預覽 / 衝突偵測）

用途：在真正合併前，先用三方比對（3-way，相對於兩分支的共同祖先 merge base）
檢查 `fromBranch` 合進 `intoBranch` 會不會有衝突。**唯讀、不寫資料庫。**前端可
依此決定要直接合併還是先進衝突解決頁。

權限：同 merge，僅 `concertmaster`、`platform_admin`。

Query string：

- `from`（必填）：來源分支 id（`fromBranchId`）。
- `into`（必填）：目標分支 id（`intoBranchId`）。

衝突定義：某份 score 在 `fromBranch.head` 與 `intoBranch.head` 都相對於 merge base
被改成「不同的檔案」（以 `(storage_bucket, storage_path)` 判斷）時即為衝突。只有
單邊變更的 score 會自動合併、不算衝突。

Response `data`：

```json
{
  "from_branch": { "id": "uuid", "name": "feature/bowing-fix", "...": "..." },
  "into_branch": { "id": "uuid", "name": "main", "...": "..." },
  "base_commit_id": "uuid | null",
  "has_conflicts": true,
  "conflicts": [
    {
      "score_id": "uuid",
      "base":   { "storage_path": "...", "...": "..." },
      "ours":   { "storage_path": "...（intoBranch 版本）", "...": "..." },
      "theirs": { "storage_path": "...（fromBranch 版本）", "...": "..." }
    }
  ]
}
```

可能錯誤：`400`（缺 `from`/`into`、兩者相同、來源分支沒有 commit）、`403`（非群主）。

### 11) `POST /projects/:projectId/merges`（合併分支）

用途：對應「分支合併」。把 `fromBranchId` 合進 `intoBranchId`，在後者上產生
一個 merge commit。

權限：僅 `concertmaster`、`platform_admin`（對應 functional map 中的
「群主才可以合併」）。

Request body：

```json
{
  "fromBranchId": "uuid",
  "intoBranchId": "uuid",
  "message": "Merge feature/bowing-fix into main",
  "resolutions": [{ "scoreId": "uuid", "resolution": "ours" }]
}
```

必填參數：

- `fromBranchId`、`intoBranchId`：兩個分支必須屬於同一個 `projectId` 且不可相同。
- `fromBranch` 必須已有至少一個 commit（`head_commit_id != null`），否則回 `400`。

可選參數：

- `message`：merge commit 訊息；未提供時自動產生
  `"Merge branch '<from.name>' into '<into.name>'"`。
- `resolutions`：衝突解決清單，每筆 `{ scoreId, resolution }`，`resolution` 為
  `"ours"`（保留 `intoBranch` 版本）或 `"theirs"`（採用 `fromBranch` 版本）。

行為：

- 新 merge commit 寫到 `intoBranchId`，`parent_commit_id` = `intoBranch.head`、
  `merge_parent_commit_id` = `fromBranch.head`。
- score_versions 採三方合併（相對 merge base）：
  - 只有單邊變更的 score → 自動採用有變更的那一邊。
  - 兩邊都改成不同檔案的 score → 視 `resolutions` 而定。
- `resolutions` 行為：
  - **有帶 `resolutions`**：每個衝突都必須被解決，否則回 `409`（回傳的 `error`
    內含尚未解決的 `conflicts`）。
  - **沒帶 `resolutions`**：維持舊行為（向後相容）——衝突一律由 `fromBranch`
    版本勝出（theirs-wins）。前端應先呼叫 `GET /merges/preview`，有衝突時導向
    衝突解決頁，再帶 `resolutions` 來合併。
- 成功後 `intoBranch.head_commit_id` 更新為這個 merge commit。

Response 同 `POST /commits` 的回傳格式。

---

## 三之六、總譜匯出 API（full score）

對應 `functional map.mmd` 的「總譜合成與輸出」。把某個 piece 底下各聲部的樂譜
**即時合併**成一份多部（multi-part）`score-partwise` MusicXML，供指揮檢視與匯出。
**即時產生、不寫資料庫**（沒有新增任何 `scores` 列）。

### `GET /projects/:projectId/pieces/:pieceId/full-score`

用途：取得指定 piece 的合併總譜（含跨聲部相似提示）。前端以
OpenSheetMusicDisplay 渲染、把相似段落標色，並可下載 MusicXML。

Header：

```http
Authorization: Bearer <token>
```

權限規則：

- 必須是該專案成員，否則 `403`；`platform_admin` 例外。
- 合併範圍為「目前角色可見、且有 inline `xml_content`」的聲部樂譜，並依
  `sections.sort_order` 排序成總譜中各 part 的順序。

行為：

- 逐份解析各聲部的單一 `score-partwise`，重新編號 part id（`P1`、`P2`…，連同
  `score-instrument` 等 id 一併重映），把 `part-name` 改成聲部名稱，合併到同一個
  `part-list` 之下。
- 無法解析的樂譜會被略過；完全沒有可合併的 part 時回 `422`。
- 相似提示沿用跨聲部相似段落偵測（`melodySimilarityService.scanPieceSimilarPassages`）；
  偵測失敗時 `highlights` 會降級為空陣列，不影響總譜本身。

可能錯誤：

- `404`：piece 不屬於此專案，或該 piece 沒有任何可見的 inline MusicXML 樂譜。
- `422`：找到樂譜但沒有可合併的 MusicXML part。

Response `data`：

```json
{
  "pieceId": "uuid",
  "pieceTitle": "Symphony No. 5",
  "composer": "Beethoven",
  "xml": "<?xml ...><score-partwise>...（合併後的多部總譜）...</score-partwise>",
  "parts": [
    {
      "scoreId": "uuid",
      "sectionId": "uuid",
      "sectionName": "First Violin",
      "sectionCode": "first_violin",
      "partId": "P1",
      "partIndex": 0
    }
  ],
  "highlights": [
    {
      "leftScoreId": "uuid",
      "leftSectionName": "First Violin",
      "leftStartMeasureNumber": 12,
      "leftEndMeasureNumber": 14,
      "rightScoreId": "uuid",
      "rightSectionName": "Cello",
      "rightStartMeasureNumber": 12,
      "rightEndMeasureNumber": 14,
      "similarity": 0.91,
      "noteCount": 12
    }
  ]
}
```

> `parts[].partIndex` 是該聲部在合併總譜中的 part 順序；前端用它把
> `highlights` 的 `scoreId` 對回某個 part，於相同小節標色，提醒指揮在這些段落
> 確認各樂器上下弓一致。`highlights` 的完整欄位與相似段落掃描（含
> `leftSectionId`、`leftStartRef`、`intervalScore`、`rhythmScore` 等）一致，此處
> 僅示意常用欄位。

---

## 四、目前 scores 欄位（前端常用）

前端展示或開啟檔案時，請使用以下欄位：

- `id`
- `project_id`
- `piece_id`
- `section_id`
- `title`
- `storage_bucket`
- `storage_path`
- `file_type`（`musicxml` / `xml` / `mxl`）
- `original_filename`
- `mime_type`
- `file_size_bytes`
- `xml_content`（inline MusicXML 字串；上傳與 `GET /scores/:scoreId` 會回，列表不含）

---

## 五、推薦前端串接順序

1. 先做登入（`/auth/login` 或 `/auth/google`）拿 `token`
2. 呼叫 `/auth/me` 確認目前使用者
3. 呼叫 `/projects` 顯示可見專案
4. 點進專案後呼叫 `/projects/:projectId/pieces` 顯示曲目、`/projects/:projectId/scores` 顯示樂譜
5. 點某份樂譜時呼叫 `/scores/:scoreId`，並可載入 `/scores/:scoreId/annotations` 疊加註記

---

## 六、樂譜編輯權限（`canEditScoreMiddleware`，已啟用）

`canEditScoreMiddleware`（`src/middlewares/canEditScoreMiddleware.js`）目前已掛在
`PATCH /scores/:scoreId/musicxml`（儲存編輯後的 MusicXML）。策略：

- `platform_admin`：可編輯
- `concertmaster`：可編輯
- `principal`：可編輯自己聲部
- `member`：不可編輯（`403`）

---

## 七、建議前端邀請流程

1. 邀請者（`concertmaster` 或該聲部 `principal`）在專案頁面選定「角色＋聲部」，
   呼叫 `POST /projects/:projectId/invite-code`（body 帶 `targetRole`、`sectionId`）。
2. 前端拿到 `inviteCode` 後可做：
   - 顯示給使用者複製
   - 組成分享連結（例如帶在 query string）
3. 被邀請者登入後，在加入頁面**直接**呼叫 `POST /projects/join-by-code`（只需 `inviteCode`；
   角色與聲部由邀請碼決定，無需自選）。
4. 成功後重新呼叫 `GET /projects` 更新清單。