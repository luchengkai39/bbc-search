"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  prevId: string | null;
  nextId: string | null;
  query: string;
};

export function CuePager({ prevId, nextId, query }: Props) {
  const router = useRouter();
  const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && prevId) router.push(`/c/${prevId}${qs}`);
      if (event.key === "ArrowRight" && nextId) router.push(`/c/${nextId}${qs}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextId, prevId, qs, router]);

  if (!prevId && !nextId) return null;

  return (
    <>
      {prevId ? (
        <button
          type="button"
          onClick={() => router.push(`/c/${prevId}${qs}`)}
          className="absolute left-3 top-[28%] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white hover:bg-black/70"
          aria-label="上一段"
        >
          ‹
        </button>
      ) : null}
      {nextId ? (
        <button
          type="button"
          onClick={() => router.push(`/c/${nextId}${qs}`)}
          className="absolute right-3 top-[28%] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white hover:bg-black/70"
          aria-label="下一段"
        >
          ›
        </button>
      ) : null}
    </>
  );
}
