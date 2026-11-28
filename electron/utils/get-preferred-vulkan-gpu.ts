import { execFile } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { execPath } from "./get-resource-paths";
import logit from "./logit";

let cachedGpuId: string | null = null;

/**
 * Automatically selects a discrete Vulkan GPU (NVIDIA / Radeon RX / Radeon Pro / Intel Arc)
 * on dual-GPU systems when the user has not explicitly entered a custom gpuId.
 */
const getPreferredVulkanGpu = async (requestedGpuId?: string): Promise<string> => {
  if (requestedGpuId) return requestedGpuId;
  if (cachedGpuId !== null) return cachedGpuId;

  return new Promise((resolveGpu) => {
    execFile(
      execPath,
      [
        "-v",
        "-i",
        join(tmpdir(), "lms-studio-gpu-probe.png"),
        "-o",
        join(tmpdir(), "lms-studio-gpu-probe-out.png"),
      ],
      { timeout: 2000, windowsHide: true },
      (_error, stdout, stderr) => {
        const output = `${stdout}\n${stderr}`;
        const devices = [...output.matchAll(/\[(\d+)\s+([^\]]+)\]\s+queue/gi)].map(([, id, name]) => ({
          id,
          name: name.trim(),
        }));
        if (devices.length === 0) {
          logit("⚠️ Vulkan GPU probe found no devices; letting upscayl-bin choose automatically.");
          cachedGpuId = "";
          resolveGpu("");
          return;
        }
        const preferred = devices.find(({ name }) => /nvidia|rtx|radeon rx|radeon pro|arc/i.test(name));
        logit(
          "🔎 Vulkan GPUs detected:",
          devices.map(({ id, name }) => `[${id}] ${name}`).join(", "),
        );
        if (!preferred) {
          logit("⚠️ No discrete GPU was identified; letting upscayl-bin choose automatically.");
          cachedGpuId = "";
          resolveGpu("");
          return;
        }
        logit(`✅ Selected Vulkan GPU [${preferred.id}] ${preferred.name}`);
        cachedGpuId = preferred.id;
        resolveGpu(preferred.id);
      },
    );
  });
};

export default getPreferredVulkanGpu;
