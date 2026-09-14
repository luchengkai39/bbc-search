"use client";

type Props = {
  src: string;
  poster: string | null;
};

export function ClipPlayer({ src, poster }: Props) {
  return (
    <video
      className="aspect-video w-full bg-black"
      src={src}
      poster={poster ?? undefined}
      controls
      loop
      muted
      autoPlay
      playsInline
      preload="metadata"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
        }
      }}
    />
  );
}
