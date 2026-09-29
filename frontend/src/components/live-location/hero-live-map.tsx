import { useLanguage } from "@/lib/i18n";
import { Radio } from "lucide-react";
import { GoogleLiveMap } from "@/components/maps/google-live-map";

export function HeroLiveMap() {
  const { t } = useLanguage();
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white p-2 shadow-2xl ring-1 ring-black/5">
      <div className="relative h-[400px] w-full overflow-hidden rounded-[1.6rem] bg-sky-100/60 lg:h-[480px]">
        <GoogleLiveMap />
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-[11px] font-bold text-ink shadow-lg ring-1 ring-black/5 sm:text-xs">
          <Radio className="h-3.5 w-3.5 text-primary" />
          {t("map.gps")}
        </div>
        <a href="/live-location" className="absolute bottom-3 right-3 z-10 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-lg">
          {t("map.open")}
        </a>
      </div>
    </div>
  );
}
