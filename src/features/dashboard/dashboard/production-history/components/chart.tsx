"use client";

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
import type { TooltipProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface Chart {
  chartData: ProductionHistoryData[];
}

function getMaxYValue(data: ProductionHistoryData[]): number {
  return Math.max(...data.map((d) => d.quantity));
}

// Custom Tooltip component with i18n support
function CustomTooltip({
  active,
  payload,
}: TooltipProps<ValueType, NameType>) {
  const { t } = useI18n();

  if (active && payload && payload.length) {
    const data = payload[0].payload as ProductionHistoryData;

    // Translate the date value
    const formatDateValue = (dateValue: string): string => {
      // Check if it's a day name (Mon, Tue, etc.)
      const dayMap: Record<string, string> = {
        Mon: t("chart.days.mon"),
        Tue: t("chart.days.tue"),
        Wed: t("chart.days.wed"),
        Thu: t("chart.days.thu"),
        Fri: t("chart.days.fri"),
        Sat: t("chart.days.sat"),
        Sun: t("chart.days.sun"),
      };

      if (dayMap[dateValue]) {
        return dayMap[dateValue];
      }

      // Check if it's a month name
      const monthMap: Record<string, string> = {
        Jan: t("chart.months.jan"),
        Feb: t("chart.months.feb"),
        Mar: t("chart.months.mar"),
        Apr: t("chart.months.apr"),
        May: t("chart.months.may"),
        Jun: t("chart.months.jun"),
        Jul: t("chart.months.jul"),
        Aug: t("chart.months.aug"),
        Sep: t("chart.months.sep"),
        Oct: t("chart.months.oct"),
        Nov: t("chart.months.nov"),
        Dec: t("chart.months.dec"),
      };

      if (monthMap[dateValue]) {
        return monthMap[dateValue];
      }

      // Check if it's a week format (Week 1, Week 2, etc.)
      if (dateValue.startsWith("Week ")) {
        const weekNum = dateValue.replace("Week ", "");
        return `${t("chart.week")} ${weekNum}`;
      }

      // Return as is if no translation found
      return dateValue;
    };

    return (
      <div
        style={{
          backgroundColor: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.5rem",
          padding: "0.5rem",
        }}
      >
        <p style={{ margin: 0, marginBottom: "0.25rem" }}>{formatDateValue(data.date)}</p>
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

  // Custom tick formatter for XAxis
  const formatXAxisTick = (value: string) => {
    // Check if it's a day name (Mon, Tue, etc.)
    const dayMap: Record<string, string> = {
      Mon: t("chart.days.mon"),
      Tue: t("chart.days.tue"),
      Wed: t("chart.days.wed"),
      Thu: t("chart.days.thu"),
      Fri: t("chart.days.fri"),
      Sat: t("chart.days.sat"),
      Sun: t("chart.days.sun"),
    };

    if (dayMap[value]) {
      return dayMap[value];
    }

    // Check if it's a month name
    const monthMap: Record<string, string> = {
      Jan: t("chart.months.jan"),
      Feb: t("chart.months.feb"),
      Mar: t("chart.months.mar"),
      Apr: t("chart.months.apr"),
      May: t("chart.months.may"),
      Jun: t("chart.months.jun"),
      Jul: t("chart.months.jul"),
      Aug: t("chart.months.aug"),
      Sep: t("chart.months.sep"),
      Oct: t("chart.months.oct"),
      Nov: t("chart.months.nov"),
      Dec: t("chart.months.dec"),
    };

    if (monthMap[value]) {
      return monthMap[value];
    }

    // Check if it's a week format (Week 1, Week 2, etc.)
    if (value.startsWith("Week ")) {
      const weekNum = value.replace("Week ", "");
      return `${t("chart.week")} ${weekNum}`;
    }

    // Return as is if no translation found
    return value;
  };

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
