import { MessageBoxOptions, dialog, shell } from "electron";
import { UpdateDownloadedEvent, autoUpdater } from "electron-updater";
import logit from "../utils/logit";

const RELEASES_URL = "https://github.com/luanlengoc1991-art/pixstudio/releases";

/** Asks to restart once a new version has been downloaded in the background. */
const autoUpdate = (event: UpdateDownloadedEvent) => {
  // Without a restart now, the update is installed when the app is closed
  autoUpdater.autoInstallOnAppQuit = true;
  const dialogOpts: MessageBoxOptions = {
    type: "info",
    buttons: ["Khởi động lại & cập nhật", "Để sau", "Xem thay đổi"],
    defaultId: 0,
    cancelId: 1,
    title: "LMS có bản cập nhật mới",
    message: `Đã tải xong LMS phiên bản ${event.version}.`,
    detail: 'Khởi động lại để dùng bản mới. Nếu chọn "Để sau", bản mới sẽ tự cài khi bạn đóng app.',
  };

  logit("✅ Update Downloaded", event.version);
  const response = dialog.showMessageBoxSync(dialogOpts);
  if (response === 0) {
    autoUpdater.quitAndInstall();
  } else if (response === 2) {
    shell.openExternal(`${RELEASES_URL}/tag/v${event.version}`);
  }
};

export default autoUpdate;
