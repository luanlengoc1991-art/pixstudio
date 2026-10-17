import { app, shell } from "electron";
import logit from "./logit";
import { showUpdateDialog } from "./update-dialog";

// macOS only installs updates in place for apps signed with an Apple Developer
// ID. LMS is ad-hoc signed, so on a Mac it checks GitHub itself and, once the
// new release carries the .dmg for this Mac's chip, offers to download it.

const REPO = "luanlengoc1991-art/pixstudio";

/** Numeric compare of "1.2.10" style versions; prerelease tags sort first. */
const isNewer = (latest: string, current: string) => {
  const parse = (v: string) => {
    const [core, pre] = v.replace(/^v/, "").split("-");
    return { parts: core.split(".").map((n) => Number(n) || 0), pre: !!pre };
  };
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < 3; i++) {
    if ((a.parts[i] ?? 0) !== (b.parts[i] ?? 0)) return (a.parts[i] ?? 0) > (b.parts[i] ?? 0);
  }
  return b.pre && !a.pre;
};

let offered = "";

export const checkMacUpdate = async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub ${response.status}`);
    const release = (await response.json()) as {
      tag_name: string;
      html_url: string;
      assets: { name: string; browser_download_url: string }[];
    };
    const latest = release.tag_name.replace(/^v/, "");
    if (!isNewer(latest, app.getVersion()) || offered === latest) return;

    // The Mac builds are attached a few minutes after the release is created
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    const dmg = release.assets.find((a) => a.name === `LMS-${latest}-mac-${arch}.dmg`);
    if (!dmg) return;

    offered = latest;
    logit("🆕 Mac update available", latest);
    const choice = await showUpdateDialog({
      type: "info",
      buttons: ["Tải bản mới", "Để sau"],
      defaultId: 0,
      cancelId: 1,
      title: "LMS có bản cập nhật mới",
      message: `Đã có LMS phiên bản ${latest} (bạn đang dùng ${app.getVersion()}).`,
      detail:
        "Bấm \"Tải bản mới\", mở file .dmg vừa tải rồi kéo LMS vào thư mục Applications (chọn Thay thế). Dữ liệu và đăng nhập ChatGPT được giữ nguyên.",
    });
    if (choice === 0) shell.openExternal(dmg.browser_download_url);
  } catch (error) {
    logit("🚫 Mac update check failed:", error instanceof Error ? error.message : error);
  }
};
