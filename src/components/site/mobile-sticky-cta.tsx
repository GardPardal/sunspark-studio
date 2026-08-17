import { useEffect, useState } from "react";
import { WhatsAppIcon } from "./icons";
import { WhatsAppGate } from "./whatsapp-gate";

export function MobileStickyCTA({ whatsapp }: { whatsapp: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <WhatsAppGate
        whatsapp={whatsapp}
        location="sticky_mobile"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lzgreen px-5 py-3.5 font-display text-base font-semibold text-navy-deep"
      >
        Solicitar orçamento <WhatsAppIcon className="h-5 w-5" />
      </WhatsAppGate>
    </div>
  );
}
