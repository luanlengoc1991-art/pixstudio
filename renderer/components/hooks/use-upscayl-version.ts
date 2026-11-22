import { useState, useEffect } from "react";

const useUpscaylVersion = () => {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fromUa = navigator?.userAgent?.match(/(?:LMS|Upscayl)\/([\d.]+\d+)/)?.[1] ?? null;
    if (fromUa) setVersion(fromUa);

    if (typeof window !== "undefined" && window.electron?.getAppVersion) {
      window.electron
        .getAppVersion()
        .then((raw) => {
          if (!alive || !raw) return;
          const clean = String(raw).trim().split(/\s+/)[0];
          if (clean) setVersion(clean);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, []);

  return version;
};

export default useUpscaylVersion;
