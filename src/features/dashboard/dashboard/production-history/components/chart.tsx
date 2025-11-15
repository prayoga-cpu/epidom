"use client";

import { useMemo } from "react";
import { ProductionHistoryData } from "@/types/entities";
import {
  Area,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
} from "recharts";
import { useI18n } from "@/components/lang/i18n-provider";
import { createDayMap, createMonthMap, formatDateValue } from "@/lib/utils/date-translations";
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface Chart {
  chartData: ProductionHistoryData[];
}

function getMaxYValue(data: ProductionHistoryData[]): number {
  if (!data || data.length === 0) return 10; // Default minimum for empty data
  const max = Math.max(...data.map((d) => d.quantity));
  return max > 0 ? max : 10; // Ensure at least 10 for the scale
}

// Custom Tooltip component with i18n support
function CustomTooltip({ active, payload }: TooltipProps<ValueType, NameType>) {
  const { t } = useI18n();

  // Memoize translation maps to avoid recreation on every render
  const dayMap = useMemo(() => createDayMap(t), [t]);
  const monthMap = useMemo(() => createMonthMap(t), [t]);

  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductionHistoryData;
    const translatedDate = formatDateValue(data.date, t, dayMap, monthMap);

    return (
      <div
        style={{
          backgroundColor: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.5rem",
          padding: "0.5rem",
        }}
      >
        <p style={{ margin: 0, marginBottom: "0.25rem" }}>{translatedDate}</p>
        <p style={{ margin: 0, paddingLeft: "0.5rem" }}>
          {t("chart.quantity")}: {payload[0].value}
        </p>
      </div>
    );
  }

  return null;
}

export default function Chart({ chartData }: Chart) {
  const { t } = useI18n();
  const maxQty = getMaxYValue(chartData);
  const yAxisDomain = [0, maxQty + 10];

  // Memoize translation maps to avoid recreation on every render
  const dayMap = useMemo(() => createDayMap(t), [t]);
  const monthMap = useMemo(() => createMonthMap(t), [t]);

  // Custom tick formatter for XAxis (memoized to avoid recreation)
  const formatXAxisTick = useMemo(
    () => (value: string) => formatDateValue(value, t, dayMap, monthMap),
    [t, dayMap, monthMap]
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ left: 12, right: 12 }}>
        <defs>
          <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="gray"
          strokeWidth={1}
          opacity={0.5}
          strokeDasharray="5"
          horizontal={true}
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="gray"
          tickFormatter={formatXAxisTick}
        />
        <YAxis
          domain={yAxisDomain}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          stroke="gray"
          width={30}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="quantity"
          stroke="hsl(var(--primary))"
          strokeWidth={3}
          fill="url(#colorQty)"
          dot={{
            r: 5,
            fill: "hsl(var(--primary))",
            strokeWidth: 2,
            stroke: "hsl(var(--card))",
          }}
          activeDot={{ r: 7, fill: "hsl(var(--primary))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
