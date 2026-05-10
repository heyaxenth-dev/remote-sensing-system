/**
 * Open-Meteo (free, no API key). Forecast URL can be overridden via env for testing or proxies.
 */
function forecastBaseUrl() {
  const fromEnv =
    process.env.EXPO_PUBLIC_OPEN_METEO_FORECAST_URL ||
    process.env.EXPO_PUBLIC_OPEN_METEO_URL;
  return (fromEnv && String(fromEnv).trim()) || "https://api.open-meteo.com/v1/forecast";
}

function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function norm01(x, lo, hi) {
  if (hi <= lo) return 0;
  return clamp01((x - lo) / (hi - lo));
}

/**
 * Pulls the same normalized indices as analysis/recommend.py::_fetch_weather_signals.
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchOpenMeteoSignalsForRecommend(latitude, longitude) {
  const qs = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
  });
  const url = `${forecastBaseUrl()}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  const payload = await res.json();
  const cur = payload?.current || {};
  const out = {};

  const temp = cur.temperature_2m;
  if (typeof temp === "number" && Number.isFinite(temp)) {
    out.heatIndex = norm01(temp, 10, 35);
    out.temperatureC = temp;
  }
  const rh = cur.relative_humidity_2m;
  if (typeof rh === "number" && Number.isFinite(rh)) {
    out.humidityIndex = clamp01(rh / 100);
    out.humidityPct = rh;
  }
  const precip = cur.precipitation;
  if (typeof precip === "number" && Number.isFinite(precip)) {
    out.rainIndex = norm01(precip, 0, 8);
    out.precipitationMm = precip;
  }
  const wind = cur.wind_speed_10m;
  if (typeof wind === "number" && Number.isFinite(wind)) {
    out.windIndex = norm01(wind, 0, 15);
    out.windSpeedMs = wind;
  }
  return out;
}

/**
 * Human-readable current weather for the home dashboard.
 * @param {number} latitude
 * @param {number} longitude
 */
export async function fetchWeatherForDashboard(latitude, longitude) {
  const qs = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code",
  });
  const url = `${forecastBaseUrl()}?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, error: `Weather HTTP ${res.status}` };
  }
  const payload = await res.json();
  const cur = payload?.current || {};
  const temp = cur.temperature_2m;
  const rh = cur.relative_humidity_2m;
  const precip = cur.precipitation;
  const wind = cur.wind_speed_10m;

  const parts = [];
  if (typeof temp === "number" && Number.isFinite(temp)) parts.push(`${Math.round(temp)}°C`);
  if (typeof rh === "number" && Number.isFinite(rh)) parts.push(`${Math.round(rh)}% humidity`);
  if (typeof precip === "number" && Number.isFinite(precip) && precip > 0) {
    parts.push(`${precip.toFixed(1)} mm rain`);
  }
  if (typeof wind === "number" && Number.isFinite(wind)) {
    parts.push(`wind ${wind.toFixed(1)} m/s`);
  }

  return {
    ok: true,
    temperatureC: typeof temp === "number" ? temp : null,
    humidityPct: typeof rh === "number" ? rh : null,
    precipitationMm: typeof precip === "number" ? precip : null,
    windSpeedMs: typeof wind === "number" ? wind : null,
    summary: parts.length ? parts.join(" · ") : "Weather data unavailable",
    latitude,
    longitude,
  };
}
