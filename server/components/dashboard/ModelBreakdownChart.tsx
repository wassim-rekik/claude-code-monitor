import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyUsageRow } from "@/lib/types";
import { rangeLabel } from "@/lib/format";
import { Panel } from "./Panel";
import { EmptyChart } from "./EmptyChart";
import { CustomTooltip } from "./CustomTooltip";
import { Legend } from "./Legend";
import { MODEL_SERIES } from "./modelSeries";
import { AXIS_TICK_STYLE } from "./chartTheme";

const CHART_HEIGHT = 100;

export function ModelBreakdownChart({ data, rangeDays }: { data: DailyUsageRow[]; rangeDays: number }) {
  return (
    <Panel label={`TOKENS BY MODEL (${rangeLabel(rangeDays)})`}>
      {data.length === 0 ? (
        <EmptyChart height={CHART_HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <BarChart data={data} barGap={2}>
            <XAxis dataKey="date" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {MODEL_SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="a"
                fill={s.color}
                radius={i === MODEL_SERIES.length - 1 ? [4, 4, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      <Legend entries={MODEL_SERIES} />
    </Panel>
  );
}
