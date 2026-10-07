import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Single-series line over time. One measure per chart (never a second y-axis); the
 * heading names the series, so there's no legend. Colors come from the validated
 * --chart-* tokens in index.css.
 */
export default function TrendChart({
  data,
  unit,
  label,
  decimals = true,
}: {
  data: { date: string; value: number }[];
  unit: string;
  /** For screen readers, e.g. "Body weight over time". */
  label: string;
  decimals?: boolean;
}) {
  return (
    <div className="h-56" role="img" aria-label={`${label}, see table below`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: 'var(--chart-axis)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
            domain={['auto', 'auto']}
            allowDecimals={decimals}
          />
          <Tooltip
            cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-lg">
                  <p className="text-white/70">{shortDate(payload[0].payload.date)}</p>
                  <p className="font-semibold">
                    {payload[0].value} {unit}
                  </p>
                </div>
              ) : null
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-series)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'var(--chart-series)', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
