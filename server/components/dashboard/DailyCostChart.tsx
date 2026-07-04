import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyUsageRow } from "@/lib/types";
import { Panel } from "./Panel";
import { EmptyChart } from "./EmptyChart";
import { CustomTooltip } from "./CustomTooltip";
import { AXIS_TICK_STYLE, GRID_STROKE } from "./chartTheme";

const CHART_HEIGHT = 140;
const MIN_POINTS_FOR_CHART = 2;
const COST_COLOR = "var(--color-model-sonnet)";

export function DailyCostChart({ data }: { data: DailyUsageRow[] }) {
  return (
    <Panel label="DAILY COST ($)">
      {data.length < MIN_POINTS_FOR_CHART ? (
        <EmptyChart height={CHART_HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="g-cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COST_COLOR} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COST_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="cost" name="cost" stroke={COST_COLOR} fill="url(#g-cost)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
