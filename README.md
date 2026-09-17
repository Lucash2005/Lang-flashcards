# 單字閃卡（Lang Flashcards）

Lucas 的英文／日文間隔重複閃卡，介面為繁體中文。純前端、無後端、無登入；單字與複習進度存在你的瀏覽器（IndexedDB）。

線上使用：<https://lucash2005.github.io/Lang-flashcards/>

## iPhone 開啟步驟

1. 用 **Safari** 打開 [https://lucash2005.github.io/Lang-flashcards/](https://lucash2005.github.io/Lang-flashcards/)
2. 點下方 **分享** → **加入主畫面**
3. 之後從主畫面圖示開啟即可當 App 用（可離線複習本機已同步的單字）
4. 教練更新單字後，打開 App 會自動抓最新單字；也可手動點 **同步新單字**。相同 `id` 只更新正面／背面，**不會清掉複習進度**

建議把網站留在 Safari／主畫面，避免無痕模式（無痕可能無法長期保存進度）。

## 怎麼用

- **牌組**：全部／English／日本語。到期張數會分開顯示。
- **複習**：點卡片翻面，再選 **再來一次／普通／簡單**。
- **同步新單字**：向 `/Lang-flashcards/cards.json` 抓最新單字庫，依穩定 `id` 合併進 IndexedDB。
- **貼上匯入**：可選，貼上教練給的 JSON（`cards` 陣列），同樣合併、保留 SRS。
- **匯出／匯入備份**：整份 JSON 備份（含複習進度），換手機時用這個。

## 教練如何更新單字

編輯 `public/cards.json` 後 push 到 `main`。GitHub Actions 會建置並部署；學員打開 App 或點「同步新單字」即可合併新卡，SRS 進度會保留。

### `cards.json` 格式

```json
{
  "version": 1,
  "updatedAt": "2026-09-16T23:27:13.491088+00:00",
  "cards": [
    {
      "id": "EN-2026-09-17-dessert",
      "lang": "EN",
      "front": "dessert",
      "back": "甜點；餐後甜食｜I always order a dessert.",
      "date": "2026-09-17",
      "createdAt": "2026-09-17T00:00:00+08:00"
    }
  ]
}
```

- `id` 必須穩定；改釋義請沿用同一個 id。
- `lang` 只能是 `EN` 或 `JP`。

## 本機開發

```bash
npm ci
npm test
npm run dev
```

開發伺服器請走 `http://localhost:5173/Lang-flashcards/`（Vite `base` 為 `/Lang-flashcards/`，須與 GitHub Pages 路徑大小寫一致）。

```bash
npm run build
npm run preview
```

## GitHub Pages

推送到 `main` 後，工作流程會執行 `npm ci`、`npm test`、`npm run build`，並把 `dist/` 部署到 GitHub Pages（來源：GitHub Actions）。

第一次上線需要倉庫擁有者做一次設定（不需 PAT）：

1. 打開 [Settings → Pages](https://github.com/Lucash2005/Lang-flashcards/settings/pages)
2. Build and deployment → **Source: GitHub Actions** → Save
3. 到 [Actions：Deploy to GitHub Pages](https://github.com/Lucash2005/Lang-flashcards/actions/workflows/deploy.yml) 把最近一次失敗的 run 按 **Re-run jobs**

之後每次 push `main` 都會自動更新網站。
