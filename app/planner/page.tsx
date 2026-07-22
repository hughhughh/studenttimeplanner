import { getWeekData } from "@/lib/calendar/week";
import WeekView from "@/app/_components/WeekView";
import { DEFAULT_WORKING_HOURS } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Planner — Student Time Planner",
};

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const parsed = Number.parseInt(w ?? "0", 10);
  const weekOffset = Number.isFinite(parsed) ? parsed : 0;

  const data = await getWeekData(weekOffset);

  return (
    <WeekView
      days={data.days}
      occurrences={data.occurrences}
      tz={data.tz}
      defaultWorkingHours={DEFAULT_WORKING_HOURS}
      weekOffset={weekOffset}
      weekLabel={data.weekLabel}
      nowIso={data.nowIso}
      dbConfigured={data.dbConfigured}
      dbMessage={data.dbMessage}
    />
  );
}
