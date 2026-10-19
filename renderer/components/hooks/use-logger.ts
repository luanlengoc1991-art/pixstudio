import { logAtom } from "../../atoms/log-atom";
import log from "electron-log/renderer";
import { useSetAtom } from "jotai";
import { IS_WEB } from "@/lib/platform";

const useLogger = () => {
  const setLogData = useSetAtom(logAtom);

  const logit = (...args: any) => {
    // electron-log needs the main process; the website logs to the console
    if (IS_WEB) console.log(...args);
    else log.log(...args);

    const data = [...args].join(" ");
    setLogData((prevLogData) => [...prevLogData, data]);
  };

  return logit;
};

export default useLogger;
