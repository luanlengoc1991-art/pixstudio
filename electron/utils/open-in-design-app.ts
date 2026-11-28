import { execFile, spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { IpcMainInvokeEvent } from "electron";
import { CorelDocumentPayload, DesignAppTarget, OpenInDesignAppPayload } from "../../common/types/types";

const execFileAsync = promisify(execFile);

interface AppSpec {
  label: string;
  extension: string;
  executableNames: string[];
  registryNames: string[];
  windowsInstallPatterns: { baseEnv: string; folderPattern: RegExp; relativeExecutable: string[] }[];
  macAppNames: string[];
}

export const DESIGN_APPS: Record<DesignAppTarget, AppSpec> = {
  corel: {
    label: "CorelDRAW",
    extension: "pdf",
    executableNames: ["CorelDRW.exe"],
    registryNames: ["CorelDRW.exe"],
    windowsInstallPatterns: [
      { baseEnv: "ProgramFiles", folderPattern: /^Corel/i, relativeExecutable: ["Programs64", "CorelDRW.exe"] },
      { baseEnv: "ProgramFiles", folderPattern: /^Corel/i, relativeExecutable: ["Programs", "CorelDRW.exe"] },
      { baseEnv: "ProgramFiles(x86)", folderPattern: /^Corel/i, relativeExecutable: ["Programs", "CorelDRW.exe"] },
    ],
    macAppNames: ["CorelDRAW"],
  },
  photoshop: {
    label: "Adobe Photoshop",
    extension: "psd",
    executableNames: ["Photoshop.exe"],
    registryNames: ["Photoshop.exe"],
    windowsInstallPatterns: [
      { baseEnv: "ProgramFiles", folderPattern: /^Adobe$/i, relativeExecutable: ["Adobe Photoshop*", "Photoshop.exe"] },
      { baseEnv: "ProgramFiles(x86)", folderPattern: /^Adobe$/i, relativeExecutable: ["Adobe Photoshop*", "Photoshop.exe"] },
    ],
    macAppNames: [
      "Adobe Photoshop 2026",
      "Adobe Photoshop 2025",
      "Adobe Photoshop 2024",
      "Adobe Photoshop 2023",
      "Adobe Photoshop",
    ],
  },
  illustrator: {
    label: "Adobe Illustrator",
    extension: "pdf",
    executableNames: ["Illustrator.exe"],
    registryNames: ["Illustrator.exe"],
    windowsInstallPatterns: [
      {
        baseEnv: "ProgramFiles",
        folderPattern: /^Adobe$/i,
        relativeExecutable: ["Adobe Illustrator*", "Support Files", "Contents", "Windows", "Illustrator.exe"],
      },
      {
        baseEnv: "ProgramFiles",
        folderPattern: /^Adobe$/i,
        relativeExecutable: ["Adobe Illustrator*", "Support Files", "Contents", "Windows", "64bit", "Illustrator.exe"],
      },
      {
        baseEnv: "ProgramFiles(x86)",
        folderPattern: /^Adobe$/i,
        relativeExecutable: ["Adobe Illustrator*", "Support Files", "Contents", "Windows", "Illustrator.exe"],
      },
    ],
    macAppNames: [
      "Adobe Illustrator 2026",
      "Adobe Illustrator 2025",
      "Adobe Illustrator 2024",
      "Adobe Illustrator 2023",
      "Adobe Illustrator",
    ],
  },
};

async function isFile(candidate: string): Promise<boolean> {
  if (!candidate) return false;
  try {
    return (await fs.stat(candidate)).isFile();
  } catch {
    return false;
  }
}

export function parseRegistryDefaultValue(output: string): string | null {
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*\((?:Default|Mặc định)\)\s+REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/i);
    if (!match) continue;
    const raw = match[1].trim().replace(/^"(.*)"$/, "$1");
    const exeMatch = raw.match(/^([a-zA-Z]:[^"]*?\.exe)\b/i);
    return (exeMatch ? exeMatch[1] : raw).trim();
  }
  return null;
}

function expandWindowsEnv(value: string, env: NodeJS.ProcessEnv): string {
  return value.replace(/%([^%]+)%/g, (whole, name) => env[name] || whole);
}

async function findInRegistry(registryNames: string[], env: NodeJS.ProcessEnv): Promise<string | null> {
  const roots = [
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths",
  ];
  for (const name of registryNames) {
    for (const root of roots) {
      try {
        const { stdout } = await execFileAsync("reg.exe", ["query", `${root}\\${name}`, "/ve"], {
          windowsHide: true,
          timeout: 3000,
        });
        const parsed = parseRegistryDefaultValue(stdout);
        const expanded = parsed ? expandWindowsEnv(parsed, env) : null;
        if (expanded && (await isFile(expanded))) return expanded;
      } catch {
        // Key may not exist on machines without the application installed.
      }
    }
  }
  return null;
}

function wildcardToRegExp(segment: string): RegExp {
  return new RegExp(`^${segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
}

async function walkPattern(currentDir: string, segments: string[]): Promise<string[]> {
  if (segments.length === 0) {
    return (await isFile(currentDir)) ? [currentDir] : [];
  }
  const [head, ...tail] = segments;
  if (!head.includes("*")) {
    return walkPattern(path.join(currentDir, head), tail);
  }
  let entries;
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const matcher = wildcardToRegExp(head);
  const matchingDirs = entries
    .filter((entry) => entry.isDirectory() && matcher.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
  const found: string[] = [];
  for (const dir of matchingDirs) {
    found.push(...(await walkPattern(path.join(currentDir, dir), tail)));
  }
  return found;
}

async function findInProgramFiles(spec: AppSpec, env: NodeJS.ProcessEnv): Promise<string | null> {
  for (const pattern of spec.windowsInstallPatterns) {
    const base = env[pattern.baseEnv];
    if (!base) continue;
    let entries;
    try {
      entries = await fs.readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    const matchingTopDirs = entries
      .filter((entry) => entry.isDirectory() && pattern.folderPattern.test(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
    for (const dir of matchingTopDirs) {
      const topPath = path.join(base, dir);
      const directMatches = await walkPattern(topPath, pattern.relativeExecutable);
      if (directMatches[0]) return directMatches[0];
      try {
        const children = await fs.readdir(topPath, { withFileTypes: true });
        const sortedChildren = children
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));
        for (const child of sortedChildren) {
          const nestedMatches = await walkPattern(path.join(topPath, child), pattern.relativeExecutable);
          if (nestedMatches[0]) return nestedMatches[0];
        }
      } catch {
        // Ignore unreadable vendor directories.
      }
    }
  }
  return null;
}

async function findInPath(executableNames: string[], env: NodeJS.ProcessEnv): Promise<string | null> {
  const rawPath = env.PATH || env.Path || "";
  for (const dir of rawPath.split(path.delimiter).filter(Boolean)) {
    for (const exe of executableNames) {
      const candidate = path.join(dir.replace(/^"(.*)"$/, "$1"), exe);
      if (await isFile(candidate)) return candidate;
    }
  }
  return null;
}

export async function findDesignAppExecutable(
  target: DesignAppTarget,
  options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; skipRegistry?: boolean } = {},
): Promise<string | null> {
  const spec = DESIGN_APPS[target];
  if (!spec) return null;
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  if (platform === "win32") {
    if (!options.skipRegistry) {
      const fromRegistry = await findInRegistry(spec.registryNames, env);
      if (fromRegistry) return fromRegistry;
    }
    const fromProgramFiles = await findInProgramFiles(spec, env);
    if (fromProgramFiles) return fromProgramFiles;
    return findInPath(spec.executableNames, env);
  }
  if (platform === "darwin") {
    for (const appName of spec.macAppNames) {
      const bundle = `/Applications/${appName}.app`;
      try {
        if ((await fs.stat(bundle)).isDirectory()) return bundle;
      } catch {
        // Keep searching older/unversioned application bundles.
      }
    }
  }
  return null;
}

export function sanitizeExportBaseName(fileName: string): string {
  const withoutExtension = (fileName || "thiet-ke").replace(/\.[^/.]+$/, "");
  const cleaned = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (cleaned || "thiet-ke").slice(0, 80);
}

export async function writeDesignExportTempFile(
  fileName: string,
  extension: string,
  bytes: Uint8Array,
  baseDir = os.tmpdir(),
): Promise<string> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    throw new Error("File xuất trống, không thể mở trong phần mềm thiết kế.");
  }
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!["pdf", "psd", "svg", "png"].includes(safeExtension)) {
    throw new Error("Định dạng file xuất không được hỗ trợ.");
  }
  const exportDir = path.join(baseDir, "lms-studio-design-exports");
  await fs.mkdir(exportDir, { recursive: true });
  const targetPath = path.join(exportDir, `${sanitizeExportBaseName(fileName)}-${Date.now()}.${safeExtension}`);
  await fs.writeFile(targetPath, bytes);
  return targetPath;
}

function decodePngDataUrl(dataUrl: string, index: number): Buffer {
  const match = typeof dataUrl === "string" ? dataUrl.match(/^data:image\/png;base64,([a-z0-9+/]+=*)$/i) : null;
  if (!match) {
    throw new Error(`Layer ${index + 1} không phải ảnh PNG hợp lệ để chuyển sang CorelDRAW.`);
  }
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.byteLength < 8) {
    throw new Error(`Layer ${index + 1} trống, không thể chuyển sang CorelDRAW.`);
  }
  return buffer;
}

async function openCorelLayeredDocument(corelDocument: CorelDocumentPayload, fileName: string): Promise<boolean> {
  if (process.platform !== "win32") return false;
  if (
    !corelDocument ||
    ![corelDocument.width, corelDocument.height].every((v) => Number.isFinite(v) && v > 0) ||
    !Array.isArray(corelDocument.layers) ||
    corelDocument.layers.length === 0
  ) {
    return false;
  }

  const jobDir = path.join(os.tmpdir(), "lms-studio-design-exports", `corel-${Date.now()}`);
  await fs.mkdir(jobDir, { recursive: true });

  const manifestLayers: { name: string; filePath: string; x: number; y: number; width: number; height: number }[] = [];
  for (let index = 0; index < corelDocument.layers.length; index++) {
    const layer = corelDocument.layers[index];
    if (
      ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) ||
      layer.width <= 0 ||
      layer.height <= 0
    ) {
      throw new Error(`Layer ${index + 1} có vị trí hoặc kích thước không hợp lệ.`);
    }
    const pngPath = path.join(jobDir, `layer-${String(index + 1).padStart(2, "0")}.png`);
    await fs.writeFile(pngPath, decodePngDataUrl(layer.dataUrl, index));
    manifestLayers.push({
      name: String(layer.title || `Layer ${index + 1}`).replace(/[\u0000-\u001f]/g, " ").trim() || `Layer ${index + 1}`,
      filePath: pngPath,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
    });
  }

  const manifestPath = path.join(jobDir, "manifest.json");
  const scriptPath = path.join(jobDir, "import-corel.ps1");
  await fs.writeFile(
    manifestPath,
    JSON.stringify({
      name: sanitizeExportBaseName(fileName),
      widthPx: Math.round(corelDocument.width),
      heightPx: Math.round(corelDocument.height),
      layers: manifestLayers,
    }),
    "utf8",
  );

  const psScript = [
    "$ErrorActionPreference = 'Stop'",
    "$manifest = Get-Content -LiteralPath $args[0] -Raw -Encoding UTF8 | ConvertFrom-Json",
    "$app = New-Object -ComObject CorelDRAW.Application",
    "$app.Visible = $true",
    "$doc = $app.CreateDocument()",
    "try { $doc.Name = [string]$manifest.name } catch {}",
    "$doc.Unit = 7",
    "$doc.ReferencePoint = 9",
    "$page = $doc.ActivePage",
    "$W = [double]$manifest.widthPx",
    "$H = [double]$manifest.heightPx",
    "$page.SetSize($W, $H)",
    "$originLeft = [double]$page.LeftX",
    "$originTop = [double]$page.TopY",
    "$defaultLayer = $page.ActiveLayer",
    "$createdLayers = @()",
    "for ($i = 0; $i -lt $manifest.layers.Count; $i++) {",
    "  $item = $manifest.layers[$i]",
    "  $layer = if ($i -eq 0) { $defaultLayer } else { $page.CreateLayer([string]$item.name) }",
    "  if ($i -eq 0) { $layer.Name = [string]$item.name }",
    "  $layer.Activate()",
    "  $before = $layer.Shapes.Count",
    "  $imp = $layer.ImportEx([string]$item.filePath, 0)",
    "  $imp.Finish()",
    "  $shape = $app.ActiveShape",
    "  if ($null -eq $shape -and $layer.Shapes.Count -gt $before) { $shape = $layer.Shapes.Item(1) }",
    "  if ($null -eq $shape) { throw ('CorelDRAW không nhận được layer ' + [string]$item.name) }",
    "  try { $shape.Name = [string]$item.name } catch {}",
    "  $w = [Math]::Max(1.0, [double]$item.width * $W)",
    "  $h = [Math]::Max(1.0, [double]$item.height * $H)",
    "  $x = $originLeft + ([double]$item.x * $W)",
    "  $y = $originTop - ([double]$item.y * $H)",
    "  $shape.SetSize($w, $h)",
    "  $shape.SetPosition($x, $y)",
    "  $createdLayers += $layer",
    "}",
    "for ($i = 1; $i -lt $createdLayers.Count; $i++) {",
    "  try { $createdLayers[$i].MoveAbove($createdLayers[$i - 1]) } catch {}",
    "}",
    "try { $app.ActiveWindow.ActiveView.ToFitPage() } catch {}",
  ].join("\r\n");

  await fs.writeFile(scriptPath, `\ufeff${psScript}`, "utf8");
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", scriptPath, manifestPath],
      { windowsHide: true, timeout: 90000 },
    );
    return true;
  } catch {
    return false;
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: false });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function openInDesignApp(
  _event: IpcMainInvokeEvent | null,
  payload: OpenInDesignAppPayload,
): Promise<{ appPath: string; filePath: string }> {
  const spec = DESIGN_APPS[payload.target];
  if (!spec) {
    throw new Error("Phần mềm thiết kế được chọn không hợp lệ.");
  }
  const appPath = await findDesignAppExecutable(payload.target);
  if (!appPath) {
    throw new Error(
      `Không tìm thấy ${spec.label} trên máy tính. Hãy kiểm tra phần mềm đã cài đặt hoặc dùng nút Xuất file để mở thủ công.`,
    );
  }

  if (payload.target === "corel" && payload.corelDocument && (await openCorelLayeredDocument(payload.corelDocument, payload.fileName))) {
    return { appPath, filePath: "corel-com-layers" };
  }

  let filePath = payload.sourcePath || "";
  if (!filePath) {
    if (!payload.bytes) {
      throw new Error("Không có dữ liệu file để gửi sang phần mềm thiết kế.");
    }
    const ext = payload.extension || spec.extension;
    const uint8 = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes);
    filePath = await writeDesignExportTempFile(payload.fileName, ext, uint8);
  } else if (!(await isFile(filePath))) {
    throw new Error("Không tìm thấy file xuất để mở trong phần mềm thiết kế.");
  }

  if (process.platform === "darwin") {
    await spawnDetached("open", ["-a", appPath, filePath]);
  } else {
    await spawnDetached(appPath, [filePath]);
  }
  return { appPath, filePath };
}
