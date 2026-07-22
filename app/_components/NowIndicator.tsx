"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { PX_PER_MIN } from "@/lib/calendar/grid";

interface Props {
  tz: string;
  startHour: number;
  endHour: number;
}

/** Red line + time bubble at the current moment, ticking once a minute. */
export default function NowIndicator({ tz, startHour, endHour }: Props) {
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const update = () => {
      const dt = DateTime.now().setZone(tz);
      setNowMin(dt.hour * 60 + dt.minute);
      setLabel(dt.toFormat("h:mm").toLowerCase());
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [tz]);

  if (nowMin === null) return null;
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  if (nowMin < dayStart || nowMin > dayEnd) return null;

  const top = (nowMin - dayStart) * PX_PER_MIN;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top }}
      aria-hidden
    >
      <div className="relative h-0 border-t-2 border-now">
        <span className="absolute -left-px -top-2.5 flex h-5 items-center rounded-full bg-now px-1.5 text-[10px] font-semibold text-white shadow">
          {label}
        </span>
      </div>
    </div>
  );
}
