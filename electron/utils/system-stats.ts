import os from "os";
import { execFileAsync } from "./tool-files";

export type SystemStats = {
  ramUsedGb: number;
  ramTotalGb: number;
  /** GPU numbers are null when they cannot be read */
  gpuUsage: number | null;
  vramUsedGb: number | null;
  vramTotalGb: number | null;
  gpuTemperature: number | null;
};

const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;

// nvidia-smi gives everything at once; other GPUs fall back to Windows counters
const nvidiaStats = async () => {
  const { stdout } = await execFileAsync(
    "nvidia-smi",
    ["--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu", "--format=csv,noheader,nounits"],
    { timeout: 2000, windowsHide: true },
  );
  const [usage, used, total, temperature] = stdout.trim().split("\n")[0].split(",").map((v) => Number(v.trim()));
  if ([usage, used, total].some(Number.isNaN)) throw new Error("bad nvidia-smi output");
  return { gpuUsage: usage, vramUsedGb: gb(used * 1024 ** 2), vramTotalGb: gb(total * 1024 ** 2), gpuTemperature: temperature };
};

const windowsGpuStats = async () => {
  const script = [
    "$e = @(Get-Counter '\\GPU Engine(*engtype_3D)\\Utilization Percentage' -ErrorAction Stop).CounterSamples",
    "$u = ($e | Measure-Object -Property CookedValue -Sum).Sum",
    "$m = @(Get-Counter '\\GPU Adapter Memory(*)\\Dedicated Usage' -ErrorAction SilentlyContinue).CounterSamples",
    "$mu = if ($m.Count -gt 0) { ($m | Measure-Object -Property CookedValue -Maximum).Maximum } else { $null }",
    "[PSCustomObject]@{ usage = [Math]::Round([Math]::Min($u, 100), 0); used = $mu } | ConvertTo-Json -Compress",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    timeout: 4000,
    windowsHide: true,
  });
  const data = JSON.parse(stdout.trim());
  return {
    gpuUsage: typeof data.usage === "number" ? data.usage : null,
    vramUsedGb: typeof data.used === "number" ? gb(data.used) : null,
    vramTotalGb: null,
    gpuTemperature: null,
  };
};

let useNvidia = true;

export const getSystemStats = async (): Promise<SystemStats> => {
  const ram = { ramUsedGb: gb(os.totalmem() - os.freemem()), ramTotalGb: gb(os.totalmem()) };
  try {
    if (useNvidia) return { ...ram, ...(await nvidiaStats()) };
  } catch {
    useNvidia = false;
  }
  try {
    if (process.platform === "win32") return { ...ram, ...(await windowsGpuStats()) };
  } catch {}
  return { ...ram, gpuUsage: null, vramUsedGb: null, vramTotalGb: null, gpuTemperature: null };
};
