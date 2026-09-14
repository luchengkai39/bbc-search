"use client";

import { Bungee, Playfair_Display } from "next/font/google";
import type { FormEvent } from "react";
import type { LangPref } from "@/lib/clips";

const bungee = Bungee({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  style: ["italic"],
});

const TITLE = [
  { word: "The", color: "#FF6B35" },
  { word: "Big", color: "#F4C430" },
  { word: "Bang", color: "#E63946" },
  { word: "Theory", color: "#2ECF8F" },
] as const;

const SEASONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const EXAMPLE_KEYWORDS = [
  "Sheldon",
  "Howard",
  "Penny",
  "peanut",
  "花生",
  "霍华德",
];

type Props = {
  query: string;
  season: number;
  lang: LangPref;
  onQueryChange: (value: string) => void;
  onSeasonChange: (value: number) => void;
  onLangChange: (value: LangPref) => void;
  onSubmit: () => void;
  onExample: (term: string) => void;
};

export function SearchHero({
  query,
  season,
  lang,
  onQueryChange,
  onSeasonChange,
  onLangChange,
  onSubmit,
  onExample,
}: Props) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="shrink-0 bg-[#fafafa] px-4 pt-3 pb-2 sm:px-6">
      <h1
        className={`${bungee.className} mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-center text-[1.65rem] leading-none sm:text-4xl`}
      >
        {TITLE.map((part) => (
          <span
            key={part.word}
            style={{
              color: part.color,
              textShadow: "0 3px 0 rgba(0,0,0,0.08)",
            }}
          >
            {part.word}
          </span>
        ))}
      </h1>
      <blockquote className="mx-auto mt-2 max-w-2xl text-center">
        <p className={`${playfair.className} text-sm italic text-neutral-500 sm:text-base`}>
          “I&apos;m not crazy. My mother had me tested.”
          <span className="ml-2 not-italic font-sans text-xs text-neutral-400">
            我没疯。我妈妈带我去检查过。
          </span>
        </p>
      </blockquote>

      <form
        onSubmit={handleSubmit}
        className="mx-auto mt-3 flex max-w-xl items-center gap-2"
      >
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索台词，中英均可"
          className="h-10 min-w-0 flex-1 rounded-full border border-neutral-200 bg-white px-4 text-sm text-neutral-900 shadow-sm outline-none ring-[#2ecf8f]/30 focus:ring-2"
        />
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800"
        >
          搜索
        </button>
      </form>

      <div className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center justify-center gap-2">
        <ul className="flex flex-wrap justify-center gap-1.5">
          {EXAMPLE_KEYWORDS.map((term) => (
            <li key={term}>
              <button
                type="button"
                onClick={() => onExample(term)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                  query.trim() === term
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {term}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <label className="flex items-center gap-1.5">
            季
            <select
              value={season}
              onChange={(event) => onSeasonChange(Number(event.target.value))}
              className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-800"
            >
              {SEASONS.map((value) => (
                <option key={value} value={value}>
                  S{String(value).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            语言
            <select
              value={lang}
              onChange={(event) => onLangChange(event.target.value as LangPref)}
              className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-neutral-800"
            >
              <option value="both">双语</option>
              <option value="en">只英</option>
              <option value="zh">只中</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
