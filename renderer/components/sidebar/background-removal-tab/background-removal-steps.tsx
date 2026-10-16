import { useAtom, useAtomValue } from "jotai";
import React, { useState } from "react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import {
  BackgroundRemovalModel,
  RemoveBackgroundPayload,
} from "@common/types/types";
import {
  progressAtom,
  savedOutputPathAtom,
} from "../../../atoms/user-settings-atom";
import { translationAtom } from "@/atoms/translations-atom";
import { useToast } from "@/components/ui/use-toast";
import useLogger from "../../hooks/use-logger";

const BACKGROUND_PRESETS = [
  { value: "transparent", key: "TRANSPARENT" },
  { value: "#ffffff", key: "WHITE" },
  { value: "#000000", key: "BLACK" },
] as const;

interface IProps {
  imagePath: string;
  selectImageHandler: () => Promise<void>;
  setUpscaledImagePath: React.Dispatch<React.SetStateAction<string>>;
}

function BackgroundRemovalSteps({
  imagePath,
  selectImageHandler,
  setUpscaledImagePath,
}: IProps) {
  const t = useAtomValue(translationAtom);
  const logit = useLogger();
  const { toast } = useToast();
  const [progress, setProgress] = useAtom(progressAtom);
  const [outputPath, setOutputPath] = useAtom(savedOutputPathAtom);

  const [model, setModel] = useState<BackgroundRemovalModel>("general");
  const [background, setBackground] = useState("transparent");
  const [customColor, setCustomColor] = useState("#22c55e");

  const outputHandler = async () => {
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FOLDER);
    if (path !== null) setOutputPath(path);
  };

  const removeBackgroundHandler = async () => {
    if (!imagePath) {
      toast({
        title: t("ERRORS.NO_IMAGE_ERROR.TITLE"),
        description: t("ERRORS.NO_IMAGE_ERROR.DESCRIPTION"),
      });
      return;
    }
    if (!outputPath) {
      toast({ description: t("APP.SCALE_SELECTION.NO_OUTPUT_FOLDER_ALERT") });
      return;
    }

    setUpscaledImagePath("");
    setProgress(t("BG_REMOVAL.PROGRESS"));
    try {
      const payload: RemoveBackgroundPayload = {
        imagePath,
        outputPath,
        model,
        background,
      };
      const result: string = await window.electron.invoke(
        ELECTRON_COMMANDS.REMOVE_BACKGROUND,
        payload,
      );
      setUpscaledImagePath(result);
      logit("✂️ Background removed: ", result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({ title: t("BG_REMOVAL.ERROR"), description: message });
      logit("🚫 Background removal failed: ", message);
    } finally {
      setProgress("");
    }
  };

  return (
    <div className="animate-step-in flex h-screen flex-col gap-7 overflow-y-auto overflow-x-hidden p-5">
      {/* STEP 1 */}
      <div className="animate-step-in">
        <p className="step-heading">{t("APP.FILE_SELECTION.TITLE")}</p>
        <button
          className="btn btn-primary"
          onClick={selectImageHandler}
          data-tooltip-id="tooltip"
          data-tooltip-content={imagePath}
        >
          {t("APP.FILE_SELECTION.SINGLE_MODE_TYPE")}
        </button>
      </div>

      {/* STEP 2 */}
      <div className="animate-step-in flex flex-col gap-2">
        <p className="step-heading">{t("BG_REMOVAL.MODEL_TITLE")}</p>
        <div className="join">
          <button
            className={`btn join-item btn-sm ${model === "general" ? "btn-primary" : ""}`}
            onClick={() => setModel("general")}
          >
            {t("BG_REMOVAL.MODEL_GENERAL")}
          </button>
          <button
            className={`btn join-item btn-sm ${model === "portrait" ? "btn-primary" : ""}`}
            onClick={() => setModel("portrait")}
          >
            {t("BG_REMOVAL.MODEL_PORTRAIT")}
          </button>
        </div>
        <p className="text-xs text-base-content/60">
          {t("BG_REMOVAL.MODEL_DESCRIPTION")}
        </p>
      </div>

      {/* STEP 3 */}
      <div className="animate-step-in flex flex-col gap-2">
        <p className="step-heading">{t("BG_REMOVAL.BACKGROUND_TITLE")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUND_PRESETS.map((preset) => (
            <button
              key={preset.value}
              className={`btn btn-sm ${background === preset.value ? "btn-primary" : ""}`}
              onClick={() => setBackground(preset.value)}
            >
              {t(`BG_REMOVAL.BACKGROUND_${preset.key}`)}
            </button>
          ))}
          <label
            className={`btn btn-sm gap-2 ${background === customColor ? "btn-primary" : ""}`}
          >
            <input
              type="color"
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setBackground(e.target.value);
              }}
            />
            {t("BG_REMOVAL.BACKGROUND_CUSTOM")}
          </label>
        </div>
      </div>

      {/* STEP 4 */}
      <div className="animate-step-in">
        <p className="step-heading">{t("APP.OUTPUT_PATH_SELECTION.TITLE")}</p>
        <p className="mb-2 text-sm">
          {t("APP.OUTPUT_PATH_SELECTION.DEFAULT_IMG_PATH")}
        </p>
        <button
          className="btn btn-primary"
          data-tooltip-content={outputPath}
          data-tooltip-id="tooltip"
          onClick={outputHandler}
        >
          {t("APP.OUTPUT_PATH_SELECTION.BUTTON_TITLE")}
        </button>
      </div>

      {/* STEP 5 */}
      <div className="animate-step-in">
        <p className="step-heading">{t("BG_REMOVAL.START_TITLE")}</p>
        <p className="mb-2 text-xs text-base-content/60">
          {t("BG_REMOVAL.FIRST_RUN_NOTE")}
        </p>
        <button
          className="btn btn-secondary"
          disabled={progress.length > 0}
          onClick={removeBackgroundHandler}
        >
          {progress.length > 0
            ? t("APP.SCALE_SELECTION.IN_PROGRESS_BUTTON_TITLE")
            : t("BG_REMOVAL.START_BUTTON")}
        </button>
      </div>
    </div>
  );
}

export default BackgroundRemovalSteps;
