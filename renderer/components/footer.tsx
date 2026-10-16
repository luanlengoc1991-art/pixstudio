import { translationAtom } from "@/atoms/translations-atom";
import { useAtomValue } from "jotai";
import React from "react";

function Footer() {
  const t = useAtomValue(translationAtom);

  return (
    <div className="p-2 text-center text-xs text-base-content/50">
      <p>
        {t("FOOTER.COPYRIGHT")} {new Date().getFullYear()} -{" "}
        <span className="font-bold">{t("TITLE")}</span>
      </p>
      {/* AGPL-3.0: keep attribution and a link to the upstream source */}
      <p>
        Based on{" "}
        <a
          href="https://github.com/upscayl/upscayl"
          className="font-bold"
          target="_blank"
        >
          Upscayl
        </a>{" "}
        · AGPL-3.0
      </p>
    </div>
  );
}

export default Footer;
