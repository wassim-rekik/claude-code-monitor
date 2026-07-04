import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyUsageRow } from "@/lib/types";
import { fmtTokens } from "@/lib/format";
import { Panel } from "./Panel";
import { EmptyChart } from "./EmptyChart";
import { CustomTooltip } from "./CustomTooltip";
import { MODEL_SERIES } from "./modelSeries";
import { AXIS_TICK_STYLE, GRID_STROKE } from "./chartTheme";

const CHART_HEIGHT = 200;
const MIN_POINTS_FOR_CHART = 2;

export function TokenUsageChart({ data }: { data: DailyUsageRow[] }) {
  return (
    <Panel label="TOKEN USAGE OVER TIME">
      {data.length < MIN_POINTS_FOR_CHART ? (
        <EmptyChart height={CHART_HEIGHT} message="Not enough data yet — more will appear as you use Claude Code" />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <AreaChart data={data}>
            <defs>
              {MODEL_SERIES.map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
            <XAxis dataKey="date" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} tickFormatter={fmtTokens} />
            <Tooltip content={<CustomTooltip />} />
            {MODEL_SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={`url(#g-${s.key})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}
