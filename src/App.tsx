import { useCallback, useEffect, useMemo, useState } from "react";
import { applyBackup, parseBackupPayload } from "./merge";
import {
  getAllCards,
  getMeta,
  putCard,
  saveAllCards,
  setMeta,
} from "./db";
import { isDue, previewIntervalDays, reviewCard } from "./srs";
import { mergePastedJson, syncFromRemote } from "./sync";
import type { DeckFilter, Rating, StoredCard } from "./types";
import "./App.css";

const FILTER_KEY = "deckFilter";

function loadFilter(): DeckFilter {
  const saved = localStorage.getItem(FILTER_KEY);
  if (saved === "EN" || saved === "JP" || saved === "all") return saved;
  return "all";
}

function formatSyncTime(iso: string | undefined): string {
  if (!iso) return "尚未同步";
  try {
    return new Date(iso).toLocaleString("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "尚未同步";
  }
}

function mergeLabel(added: number, updated: number): string {
  if (added === 0 && updated === 0) return "已是最新，沒有新單字";
  const parts = [];
  if (added) parts.push(`新增 ${added} 張`);
  if (updated) parts.push(`更新 ${updated} 張`);
  return `${parts.join("，")}（複習進度已保留）`;
}

export default function App() {
  const [cards, setCards] = useState<StoredCard[]>([]);
  const [filter, setFilter] = useState<DeckFilter>(loadFilter);
  const [screen, setScreen] = useState<"home" | "review">("home");
  const [queue, setQueue] = useState<StoredCard[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | undefined>();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [doneCount, setDoneCount] = useState(0);

  const refresh = useCallback(async () => {
    const [all, syncAt] = await Promise.all([
      getAllCards(),
      getMeta("lastSyncAt"),
    ]);
    setCards(all);
    setLastSync(syncAt);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
        const result = await syncFromRemote();
        if (cancelled) return;
        setCards(result.cards);
        setLastSync(new Date().toISOString());
        setMessage(mergeLabel(result.added, result.updated));
      } catch (err) {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : "同步失敗";
        setError(`自動同步失敗：${detail}`);
        try {
          await refresh();
        } catch {
          setError("無法讀取本機單字庫");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  const filtered = useMemo(
    () => (filter === "all" ? cards : cards.filter((card) => card.lang === filter)),
    [cards, filter],
  );

  const dueCards = useMemo(
    () =>
      filtered
        .filter((card) => isDue(card))
        .sort((a, b) => a.due - b.due || a.id.localeCompare(b.id)),
    [filtered],
  );

  const counts = useMemo(() => {
    const now = Date.now();
    const dueOf = (lang?: DeckFilter) =>
      cards.filter(
        (card) =>
          (lang === "all" || !lang || card.lang === lang) && isDue(card, now),
      ).length;
    return {
      all: dueOf("all"),
      EN: dueOf("EN"),
      JP: dueOf("JP"),
      total: cards.length,
      totalEN: cards.filter((c) => c.lang === "EN").length,
      totalJP: cards.filter((c) => c.lang === "JP").length,
    };
  }, [cards]);

  const current = queue[0];
  const remaining = queue.length;

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      const result = await syncFromRemote();
      setCards(result.cards);
      setLastSync(new Date().toISOString());
      setMessage(mergeLabel(result.added, result.updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "同步失敗");
    } finally {
      setSyncing(false);
    }
  }

  function startReview() {
    if (dueCards.length === 0) return;
    setQueue(dueCards);
    setDoneCount(0);
    setFlipped(false);
    setScreen("review");
    setMessage(null);
  }

  async function rate(rating: Rating) {
    if (!current) return;
    const updated = reviewCard(current, rating);
    await putCard(updated);
    setCards((prev) =>
      prev.map((card) => (card.id === updated.id ? updated : card)),
    );
    setFlipped(false);
    setDoneCount((n) => n + 1);
    setQueue((prev) => {
      const rest = prev.slice(1);
      if (rating === "again") return [...rest, updated];
      return rest;
    });
  }

  async function handlePasteImport() {
    setError(null);
    try {
      const result = await mergePastedJson(pasteText);
      setCards(result.cards);
      setPasteText("");
      setPasteOpen(false);
      setMessage(mergeLabel(result.added, result.updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯入失敗");
    }
  }

  function handleExport() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cards,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lang-flashcards-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("已下載備份檔");
  }

  async function handleBackupImport(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const backup = parseBackupPayload(JSON.parse(text) as unknown);
      const next = applyBackup(cards, backup.cards);
      await saveAllCards(next);
      await setMeta("lastSyncAt", new Date().toISOString());
      setCards(next);
      setMessage(`已匯入備份，共 ${backup.cards.length} 張（含複習進度）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "備份匯入失敗");
    }
  }

  if (busy) {
    return (
      <div className="app">
        <div className="panel loading">載入單字庫中…</div>
      </div>
    );
  }

  if (screen === "review") {
    return (
      <div className="app review-app">
        <header className="topbar">
          <button className="text-btn" onClick={() => setScreen("home")}>
            ← 結束
          </button>
          <div className="progress">
            {remaining === 0
              ? "完成"
              : `${doneCount + 1}／${doneCount + remaining}`}
          </div>
          <div className="deck-chip">
            {filter === "all" ? "全部" : filter === "EN" ? "English" : "日本語"}
          </div>
        </header>

        {remaining === 0 || !current ? (
          <section className="done-card">
            <p className="stamp">今日複習完成</p>
            <h2>先休息一下</h2>
            <p className="muted">到期卡片都複習完了。新單字同步後會再出現在這裡。</p>
            <button className="primary" onClick={() => setScreen("home")}>
              回到首頁
            </button>
          </section>
        ) : (
          <>
            <button
              className={`flashcard ${flipped ? "flipped" : ""}`}
              onClick={() => setFlipped((v) => !v)}
              aria-label={flipped ? "顯示正面" : "翻面看解答"}
            >
              <div className="flashcard-inner">
                <div className="face front">
                  <span className={`lang-badge ${current.lang}`}>
                    {current.lang === "EN" ? "English" : "日本語"}
                  </span>
                  <p className="front-text">{current.front}</p>
                  <span className="hint">點擊翻面</span>
                </div>
                <div className="face back">
                  <span className={`lang-badge ${current.lang}`}>
                    {current.lang === "EN" ? "English" : "日本語"}
                  </span>
                  <p className="back-text">{current.back}</p>
                </div>
              </div>
            </button>

            {flipped ? (
              <div className="ratings">
                <button className="rate again" onClick={() => void rate("again")}>
                  <strong>再來一次</strong>
                  <span>{previewIntervalDays(current, "again")}</span>
                </button>
                <button className="rate good" onClick={() => void rate("good")}>
                  <strong>普通</strong>
                  <span>{previewIntervalDays(current, "good")}</span>
                </button>
                <button className="rate easy" onClick={() => void rate("easy")}>
                  <strong>簡單</strong>
                  <span>{previewIntervalDays(current, "easy")}</span>
                </button>
              </div>
            ) : (
              <p className="flip-prompt">先想答案，再翻面評分</p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <p className="kicker">Lucas · 間隔重複</p>
        <h1>單字閃卡</h1>
        <p className="lede">英文與日文分開記；單字會自動合併，複習進度留在這台裝置。</p>
      </header>

      <div className="segment" role="tablist" aria-label="牌組">
        {(
          [
            ["all", "全部"],
            ["EN", "English"],
            ["JP", "日本語"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="stats">
        <div className="stat-main">
          <span className="stat-label">今日待複習</span>
          <strong>{filter === "all" ? counts.all : counts[filter]}</strong>
          <span className="stat-sub">
            EN {counts.EN} · JP {counts.JP}
          </span>
        </div>
        <div className="stat-side">
          <span>牌組共 {filter === "all" ? counts.total : filter === "EN" ? counts.totalEN : counts.totalJP} 張</span>
          <span>English {counts.totalEN} · 日本語 {counts.totalJP}</span>
        </div>
      </section>

      <button
        className="primary"
        onClick={startReview}
        disabled={dueCards.length === 0}
      >
        {dueCards.length === 0 ? "目前沒有到期卡片" : `開始複習（${dueCards.length}）`}
      </button>

      <button
        className="secondary"
        onClick={() => void handleSync()}
        disabled={syncing}
      >
        {syncing ? "同步中…" : "同步新單字"}
      </button>
      <p className="meta">上次同步：{formatSyncTime(lastSync)}</p>

      {message && <p className="banner ok">{message}</p>}
      {error && <p className="banner err">{error}</p>}

      <section className="data">
        <h2>資料</h2>
        <p className="muted">
          可貼上教練給的 JSON，或匯出／匯入整份備份。同步與貼上只合併內容，不會清掉 SRS 進度。
        </p>
        <button className="ghost" onClick={() => setPasteOpen((v) => !v)}>
          {pasteOpen ? "收合貼上匯入" : "貼上匯入 JSON"}
        </button>
        {pasteOpen && (
          <div className="paste-box">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder='{"version":1,"cards":[{"id":"EN-…","lang":"EN","front":"…","back":"…"}]}'
              rows={7}
            />
            <button
              className="secondary"
              onClick={() => void handlePasteImport()}
              disabled={!pasteText.trim()}
            >
              合併貼上內容
            </button>
          </div>
        )}
        <div className="row">
          <button className="ghost" onClick={handleExport}>
            匯出備份
          </button>
          <label className="ghost file-btn">
            匯入備份
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                void handleBackupImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
