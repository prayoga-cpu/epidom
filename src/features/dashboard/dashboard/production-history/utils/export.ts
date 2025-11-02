import { ChartProps } from "../types/chart.types";

// Format data for export
export const exportData = ({ chartData }: ChartProps) =>
  chartData.map((item) => ({
    Date: item.date,
    Quantity: item.quantity,
    Revenue: item.revenue ? `$${item.revenue.toFixed(2)}` : "—",
  }));
