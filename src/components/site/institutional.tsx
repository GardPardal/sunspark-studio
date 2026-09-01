import { useState } from "react";
import { ArrowRight, Check, Play } from "lucide-react";
import { INSTITUTIONAL } from "./home-content";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate, trackEvent } from "./whatsapp-gate";

function youtubeId(url: string): string | null {
  const match = url?.match(/(?:\/embed\/|youtu\.be\/|v=|shorts\/)([\w-]{6,})/);
  return match ? match[1] : null;
}

export function InstitutionalSection({
  videoUrl,
  whatsapp,
  onHistory,
}: {
  videoUrl: string;
  whatsapp: string;
  onHistory: () => void;
}) {
  return (
    <section id="sobre" className="bg-white pb-16 md:pb-24">
      <div className="mx-auto max-w-[1320px] px-4 md:px-8">
        <div className="overflow-hidden rounded-3xl bg-navy-deep text-white shadow-[0_30px_80px_-50px_oklch(0.2_0.04_248)] lg:grid lg:grid-cols-2">
          <div className="p-7 md:p-12">
            <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight md:text-[2.5rem]">
              {INSTITUTIONAL.titleStart}
              <br />
              <span className="text-lzgreen">{INSTITUTIONAL.titleHighlight}</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70 md:text-base">
              {INSTITUTIONAL.text}
            </p>
            <ul className="mt-6 space-y-3">
              {INSTITUTIONAL.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-sm text-white/85 md:text-base"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-lzgreen">
                    <Check className="h-3 w-3 text-lzgreen" aria-hidden="true" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                trackEvent("cta_click", { location: "institucional" });
                onHistory();
              }}
              className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/25 px-6 py-3 font-display text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/5"
            >
              {INSTITUTIONAL.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <VideoPanel videoUrl={videoUrl} whatsapp={whatsapp} />
        </div>
      </div>
    </section>
  );
}

function VideoPanel({ videoUrl, whatsapp }: { videoUrl: string; whatsapp: string }) {
  const [active, setActive] = useState(false);
  const id = youtubeId(videoUrl ?? "");
  const poster = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;

  return (
    <div className="relative min-h-[280px] lg:min-h-full">
      {active && id ? (
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title="Vídeo institucional LZ7 Energia"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full min-h-[280px] w-full"
        />
      ) : (
        <>
          {poster ? (
            <img
              src={poster}
              alt="Sistema fotovoltaico instalado pela LZ7 Energia"
              loading="lazy"
              decoding="async"
              width={480}
              height={360}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-navy-soft" />
          )}
          <div className="absolute inset-0 bg-navy-deep/45" aria-hidden="true" />
          {id ? (
            <button
              type="button"
              onClick={() => {
                setActive(true);
                trackEvent("video_view");
              }}
              aria-label="Assistir vídeo institucional da LZ7 Energia"
              className="absolute inset-0 grid place-items-center"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-navy-deep shadow-lg transition hover:scale-105">
                <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden="true" />
              </span>
            </button>
          ) : null}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
            <p className="pointer-events-none max-w-[78%] font-display text-sm font-semibold leading-snug text-white drop-shadow md:text-base">
              {INSTITUTIONAL.videoCaption}
            </p>
            <WhatsAppGate
              whatsapp={whatsapp}
              location="video"
              aria-label="Falar no WhatsApp"
              className="pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lzgreen text-navy-deep shadow-lg transition hover:bg-lzgreen-strong hover:text-white"
            >
              <WhatsAppIcon className="h-5 w-5" />
            </WhatsAppGate>
          </div>
        </>
      )}
    </div>
  );
}
