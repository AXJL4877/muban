"use client";

interface SimpleBarChartProps {
  labels: string[];
  values: number[];
  valueFormatter?: (value: number) => string;
  barClassName?: string;
}

export function SimpleBarChart({
  labels,
  values,
  valueFormatter = (v) => String(v),
  barClassName = "bg-primary/80",
}: SimpleBarChartProps) {
  const max = Math.max(...values, 1);

  if (labels.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        暂无数据
      </div>
    );
  }

  return (
    <div className="flex h-52 items-end gap-2 pt-6">
      {labels.map((label, index) => {
        const value = values[index] ?? 0;
        const height = Math.max((value / max) * 100, value > 0 ? 4 : 0);
        return (
          <div
            key={`${label}-${index}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="text-xs text-muted-foreground">
              {valueFormatter(value)}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-md transition-all ${barClassName}`}
                style={{ height: `${height}%`, minHeight: value > 0 ? "4px" : "0" }}
                title={`${label}: ${valueFormatter(value)}`}
              />
            </div>
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {label.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface DualBarChartProps {
  labels: string[];
  primaryValues: number[];
  secondaryValues: number[];
  primaryLabel: string;
  secondaryLabel: string;
}

export function DualBarChart({
  labels,
  primaryValues,
  secondaryValues,
  primaryLabel,
  secondaryLabel,
}: DualBarChartProps) {
  const max = Math.max(...primaryValues, ...secondaryValues, 1);

  if (labels.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        暂无数据
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          {primaryLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-400" />
          {secondaryLabel}
        </span>
      </div>
      <div className="flex h-52 items-end gap-3 pt-4">
        {labels.map((label, index) => {
          const primary = primaryValues[index] ?? 0;
          const secondary = secondaryValues[index] ?? 0;
          return (
            <div
              key={label}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <div
                  className="w-[42%] rounded-t-sm bg-emerald-500/85"
                  style={{
                    height: `${Math.max((primary / max) * 100, primary > 0 ? 4 : 0)}%`,
                    minHeight: primary > 0 ? "4px" : "0",
                  }}
                  title={`${primaryLabel}: ${primary}`}
                />
                <div
                  className="w-[42%] rounded-t-sm bg-rose-400/85"
                  style={{
                    height: `${Math.max((secondary / max) * 100, secondary > 0 ? 4 : 0)}%`,
                    minHeight: secondary > 0 ? "4px" : "0",
                  }}
                  title={`${secondaryLabel}: ${secondary}`}
                />
              </div>
              <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                {label.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
