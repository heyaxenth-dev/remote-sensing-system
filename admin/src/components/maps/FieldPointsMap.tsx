import { useMemo, useState } from "react";
import type { MonitoringRow, ReforestationPlot } from "../../lib/fieldMonitoring";

type MapPoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone: "monitor" | "scene" | "flagged" | "plot";
};

function projectPoint(
  lat: number,
  lon: number,
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
  width: number,
  height: number,
  padding: number,
) {
  const latSpan = bounds.maxLat - bounds.minLat || 0.001;
  const lonSpan = bounds.maxLon - bounds.minLon || 0.001;
  const x = padding + ((lon - bounds.minLon) / lonSpan) * (width - padding * 2);
  const y =
    height - padding - ((lat - bounds.minLat) / latSpan) * (height - padding * 2);
  return { x, y };
}

export default function FieldPointsMap({
  submissions,
  plots = [],
  className = "",
}: {
  submissions: MonitoringRow[];
  plots?: ReforestationPlot[];
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const points = useMemo<MapPoint[]>(() => {
    const field: MapPoint[] = submissions
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      .map((r) => ({
        id: r.id,
        lat: r.latitude,
        lon: r.longitude,
        label: r.common_name ?? r.seedling_id ?? "Capture",
        tone: r.unsuitable_for_planting
          ? "flagged"
          : r.event_type === "monitor_seedling"
            ? "monitor"
            : "scene",
      }));

    for (const p of plots) {
      field.push({
        id: `plot-${p.id}`,
        lat: p.latitude,
        lon: p.longitude,
        label: p.plot_code,
        tone: "plot",
      });
    }
    return field;
  }, [submissions, plots]);

  const bounds = useMemo(() => {
    if (points.length === 0) return null;
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const p of points) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLon = Math.min(minLon, p.lon);
      maxLon = Math.max(maxLon, p.lon);
    }
    const pad = 0.004;
    return {
      minLat: minLat - pad,
      maxLat: maxLat + pad,
      minLon: minLon - pad,
      maxLon: maxLon + pad,
    };
  }, [points]);

  const active = points.find((p) => p.id === activeId) ?? null;

  if (!bounds || points.length === 0) {
    return (
      <EmptyMapPlaceholder className={className} message="No coordinates to plot yet." />
    );
  }

  const w = 640;
  const h = 320;
  const pad = 24;

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-950/90 to-gray-900 ring-1 ring-lime-500/25 ${className}`}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="relative z-[1] aspect-[2/1] min-h-[220px] w-full"
        role="img"
        aria-label="Interactive map of field capture points"
      >
        {points.map((p) => {
          const { x, y } = projectPoint(p.lat, p.lon, bounds, w, h, pad);
          const isActive = activeId === p.id;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={isActive ? 10 : 7}
              className={
                p.tone === "monitor"
                  ? "fill-lime-400"
                  : p.tone === "plot"
                    ? "fill-sky-400"
                    : p.tone === "flagged"
                      ? "fill-red-500"
                      : "fill-orange-400"
              }
              style={{ cursor: "pointer" }}
              onClick={() => setActiveId(p.id)}
            />
          );
        })}
      </svg>
      <MapFooter active={active} />
    </div>
  );
}

function MapFooter({ active }: { active: MapPoint | null }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-[2] border-t border-white/10 bg-black/50 px-4 py-3 text-xs text-gray-200 backdrop-blur-sm">
      {active ? (
        <p>
          <span className="font-semibold text-lime-200">{active.label}</span> ·{" "}
          {active.lat.toFixed(5)}°, {active.lon.toFixed(5)}°
        </p>
      ) : (
        <p>Tap a point to inspect coordinates. Blue = registered plot centroid.</p>
      )}
    </div>
  );
}

function EmptyMapPlaceholder({
  className,
  message,
}: {
  className?: string;
  message: string;
}) {
  return (
    <div
      className={`flex aspect-[2/1] min-h-[220px] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-950/80 to-gray-900 ring-1 ring-lime-500/20 ${className}`}
    >
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
