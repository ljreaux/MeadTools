import { sampleChartExtrema, type ChartSample } from "@meadtools/brew-domain/hydrometer";

export function chartGeometry(input: readonly ChartSample[], width: number, height: number) {
  const samples = sampleChartExtrema(input);
  if (!samples.length) return null;
  const from = Date.parse(samples[0].date);
  const to = Date.parse(samples[samples.length - 1].date);
  let min = Infinity;
  let max = -Infinity;
  for (const point of samples) {
    min = Math.min(min, point.value);
    max = Math.max(max, point.value);
  }
  const padding = Math.max((max - min) * 0.1, Math.abs(max) * 0.005, 0.005);
  const low = min - padding;
  const high = max + padding;
  const x = (time: number) => (from === to ? width / 2 : ((time - from) / (to - from)) * width);
  const y = (value: number) => height - ((value - low) / (high - low)) * height;
  return {
    samples,
    from,
    to,
    min,
    max,
    low,
    high,
    x,
    y,
    polyline: samples
      .map((point) => `${x(Date.parse(point.date)).toFixed(2)},${y(point.value).toFixed(2)}`)
      .join(" ")
  };
}

/** Every line shares time coordinates, even when manual readings are sparse. */
export function overlayChartGeometry(
  series: readonly { key: string; samples: readonly ChartSample[] }[],
  width: number,
  height: number
) {
  const lines = series.flatMap((item) => {
    const samples = item.samples
      .filter((sample) => Number.isFinite(sample.value) && Number.isFinite(Date.parse(sample.date)))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const geometry = chartGeometry(samples, width, height);
    return geometry ? [{ key: item.key, samples, geometry }] : [];
  });
  if (!lines.length) return null;
  const from = Math.min(...lines.map((line) => line.geometry.from));
  const to = Math.max(...lines.map((line) => line.geometry.to));
  const x = (time: number) => (from === to ? width / 2 : ((time - from) / (to - from)) * width);
  const times = [
    ...new Set(lines.flatMap((line) => line.samples.map((point) => Date.parse(point.date))))
  ].sort((a, b) => a - b);
  return {
    from,
    to,
    x,
    times,
    lines: lines.map((line) => ({
      ...line,
      polyline: line.geometry.samples
        .map(
          (point) =>
            `${x(Date.parse(point.date)).toFixed(2)},${line.geometry.y(point.value).toFixed(2)}`
        )
        .join(" ")
    }))
  };
}
