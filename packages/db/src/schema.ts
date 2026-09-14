import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const alignStatusEnum = pgEnum("align_status", [
  "aligned",
  "en_only",
  "zh_only",
]);

export const mediaStatusEnum = pgEnum("media_status", [
  "pending",
  "ready",
  "failed",
]);

export const shows = pgTable("shows", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleZh: text("title_zh").notNull(),
});

export const episodes = pgTable(
  "episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    showId: uuid("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    episode: integer("episode").notNull(),
    titleEn: text("title_en").notNull().default(""),
    titleZh: text("title_zh").notNull().default(""),
    durationMs: integer("duration_ms"),
    sourceLabel: text("source_label"),
  },
  (table) => [
    unique("episodes_show_season_episode_uidx").on(
      table.showId,
      table.season,
      table.episode,
    ),
  ],
);

export const cues = pgTable(
  "cues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    episodeId: uuid("episode_id")
      .notNull()
      .references(() => episodes.id, { onDelete: "cascade" }),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    textEn: text("text_en").notNull().default(""),
    textZh: text("text_zh").notNull().default(""),
    alignStatus: alignStatusEnum("align_status").notNull().default("aligned"),
    thumbKey: text("thumb_key"),
    clipKey: text("clip_key"),
    clipDurationMs: integer("clip_duration_ms"),
    mediaStatus: mediaStatusEnum("media_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("cues_episode_span_uidx").on(
      table.episodeId,
      table.startMs,
      table.endMs,
    ),
  ],
);

export const shares = pgTable("shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  cueId: uuid("cue_id")
    .notNull()
    .references(() => cues.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const showsRelations = relations(shows, ({ many }) => ({
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  show: one(shows, { fields: [episodes.showId], references: [shows.id] }),
  cues: many(cues),
}));

export const cuesRelations = relations(cues, ({ one, many }) => ({
  episode: one(episodes, {
    fields: [cues.episodeId],
    references: [episodes.id],
  }),
  shares: many(shares),
}));

export const sharesRelations = relations(shares, ({ one }) => ({
  cue: one(cues, { fields: [shares.cueId], references: [cues.id] }),
}));
