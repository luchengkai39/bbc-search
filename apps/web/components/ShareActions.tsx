"use client";

import { useState } from "react";

type Props = {
  cueId: string;
};

export function ShareActions({ cueId }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"copy" | "download" | null>(null);

  async function copyLink() {
    setBusy("copy");
    setMessage(null);
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cueId }),
      });
      const body = (await response.json()) as { path?: string; error?: string };
      if (!response.ok || !body.path) throw new Error(body.error || "share_failed");
      const url = `${window.location.origin}${body.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setMessage("已复制分享链接，7 天后失效");
      } catch {
        setMessage(url);
      }
    } catch {
      setMessage("复制失败，请重试");
    } finally {
      setBusy(null);
    }
  }

  async function downloadCard() {
    setBusy("download");
    setMessage(null);
    try {
      const response = await fetch(`/api/cues/${cueId}/card?download=1`);
      if (!response.ok) throw new Error("card_failed");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `bigboom-${cueId.slice(0, 8)}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setMessage("已开始下载双语卡片");
    } catch {
      setMessage("下载失败，请重试");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={busy !== null}
          className="rounded-md bg-[#2ecf8f] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy === "copy" ? "生成中…" : "复制分享链接"}
        </button>
        <button
          type="button"
          onClick={() => void downloadCard()}
          disabled={busy !== null}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 disabled:opacity-60"
        >
          {busy === "download" ? "生成中…" : "下载双语卡片"}
        </button>
      </div>
      {message ? <p className="break-all text-sm text-neutral-500">{message}</p> : null}
    </div>
  );
}
