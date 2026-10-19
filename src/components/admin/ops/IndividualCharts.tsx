"use client";
import { useId } from "react";
import {
  finite,
  mean,
  type Sample,
  type CorrelationPair,
} from "@/lib/individualStats";
const short = (date: string) => date.slice(5).split("-").reverse().join(".");
export function LineChart({
  points,
  color,
  unit,
  selected,
  onSelect,
  standard = false,
}: {
  points: Sample[];
  color: string;
  unit: string;
  selected?: string;
  onSelect: (day: string, trigger?: HTMLElement | SVGElement) => void;
  standard?: boolean;
}) {
  const id = useId().replace(/:/g, ""),
    values = points
      .filter((p) => finite(p.value))
      .map((p) => p.value as number);
  if (!values.length)
    return (
      <div className="ip-chart-empty">
        No comparable measurements in this period
      </div>
    );
  const w = 620,
    h = 190,
    l = 42,
    r = 12,
    t = 14,
    b = 30;
  const min = standard ? 1 : Math.min(...values),
    max = standard ? 10 : Math.max(...values),
    pad = standard ? 0 : Math.max((max - min) * 0.18, max > 30 ? 3 : 0.5);
  const lo = min - pad,
    hi = max + pad,
    x = (i: number) => l + (i / Math.max(1, points.length - 1)) * (w - l - r),
    y = (v: number) => t + ((hi - v) / Math.max(0.001, hi - lo)) * (h - t - b);
  const segments: string[] = [];
  let path = "";
  points.forEach((p, i) => {
    if (!finite(p.value)) {
      if (path) segments.push(path);
      path = "";
    } else path += `${path ? " L" : "M"}${x(i)},${y(p.value)}`;
  });
  if (path) segments.push(path);
  const average = mean(values)!;
  return (
    <svg
      className="ip-line"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${unit} history from ${points[0].date} to ${points.at(-1)!.date}. ${values.length} measured days.`}
    >
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {standard && (
        <rect
          x={l}
          y={y(7)}
          width={w - l - r}
          height={y(4) - y(7)}
          fill="#ffffff"
          opacity=".04"
        />
      )}
      {[0, 0.5, 1].map((f) => {
        const v = lo + f * (hi - lo);
        return (
          <g key={f}>
            <line x1={l} x2={w - r} y1={y(v)} y2={y(v)} stroke="#ffffff12" />
            <text x={l - 8} y={y(v) + 4} textAnchor="end">
              {v.toFixed(standard ? 0 : hi - lo > 15 ? 0 : 1)}
            </text>
          </g>
        );
      })}
      <line
        x1={l}
        x2={w - r}
        y1={y(average)}
        y2={y(average)}
        stroke={color}
        strokeDasharray="3 5"
        opacity=".35"
      />
      {segments.map((d, i) => (
        <g key={i}>
          <path
            d={d}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ))}
      {points.map((p, i) =>
        finite(p.value) ? (
          <g
            key={p.date}
            role="button"
            tabIndex={0}
            aria-label={`${p.date}: ${p.value.toFixed(1)} ${unit}. Open daily responses`}
            onClick={(e) => onSelect(p.date, e.currentTarget)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(p.date, e.currentTarget);
              }
            }}
          >
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={selected === p.date ? 6 : 3}
              fill={color}
            />
            <circle cx={x(i)} cy={y(p.value)} r="10" fill="transparent" />
            <title>
              {p.date} · {p.value.toFixed(1)} {unit}
            </title>
          </g>
        ) : null,
      )}
      {[0, Math.floor((points.length - 1) / 2), points.length - 1]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((i) => (
          <text
            key={i}
            x={x(i)}
            y={h - 7}
            textAnchor={
              i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
            }
          >
            {short(points[i].date)}
          </text>
        ))}
    </svg>
  );
}
export function ScatterChart({
  pairs,
  xLabel,
  yLabel,
  onSelect,
}: {
  pairs: CorrelationPair[];
  xLabel: string;
  yLabel: string;
  onSelect: (date: string, trigger?: HTMLElement | SVGElement) => void;
}) {
  if (!pairs.length)
    return <div className="ip-chart-empty">No paired observations</div>;
  const w = 620,
    h = 250,
    l = 54,
    r = 20,
    t = 18,
    b = 44,
    xs = pairs.map((p) => p.x),
    ys = pairs.map((p) => p.y),
    xmin = Math.min(...xs),
    xmax = Math.max(...xs),
    ymin = Math.min(...ys),
    ymax = Math.max(...ys);
  const xp = Math.max((xmax - xmin) * 0.1, 0.5),
    yp = Math.max((ymax - ymin) * 0.1, 0.5),
    x = (v: number) =>
      l + ((v - xmin + xp) / (xmax - xmin + 2 * xp)) * (w - l - r),
    y = (v: number) =>
      t + ((ymax + yp - v) / (ymax - ymin + 2 * yp)) * (h - t - b);
  return (
    <svg
      className="ip-scatter"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${xLabel} versus ${yLabel}. ${pairs.length} paired days.`}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line
            x1={l}
            x2={w - r}
            y1={t + f * (h - t - b)}
            y2={t + f * (h - t - b)}
            stroke="#ffffff12"
          />
          <text x={l - 9} y={t + f * (h - t - b) + 4} textAnchor="end">
            {(ymax + yp - f * (ymax - ymin + 2 * yp)).toFixed(1)}
          </text>
          <text x={l + f * (w - l - r)} y={h - 24} textAnchor="middle">
            {(xmin - xp + f * (xmax - xmin + 2 * xp)).toFixed(1)}
          </text>
        </g>
      ))}
      {pairs.map((p) => (
        <g
          key={p.date}
          role="button"
          tabIndex={0}
          aria-label={`${p.date}: ${xLabel} ${p.x.toFixed(2)}, ${yLabel} ${p.y.toFixed(2)}`}
          onClick={(e) => onSelect(p.date, e.currentTarget)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(p.date, e.currentTarget);
            }
          }}
        >
          <circle
            cx={x(p.x)}
            cy={y(p.y)}
            r="5"
            fill="#67e8f9"
            fillOpacity=".65"
            stroke="#a5f3fc"
          />
          <title>
            {p.xDate} → {p.date} · {p.x.toFixed(2)} / {p.y.toFixed(2)}
          </title>
        </g>
      ))}
      <text x={(l + w - r) / 2} y={h - 3} textAnchor="middle">
        {xLabel}
      </text>
      <text
        transform={`translate(12,${(t + h - b) / 2}) rotate(-90)`}
        textAnchor="middle"
      >
        {yLabel}
      </text>
    </svg>
  );
}
