import { dialog, MessageBoxOptions } from "electron";
import { getMainWindow } from "../main-window";

/**
 * Shows an update prompt attached to the LMS window, bringing the window to
 * the front first; a parentless dialog could open behind it unnoticed.
 */
export const showUpdateDialog = async (options: MessageBoxOptions) => {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return (await dialog.showMessageBox(options)).response;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  window.flashFrame(true);
  const { response } = await dialog.showMessageBox(window, options);
  window.flashFrame(false);
  return response;
};
