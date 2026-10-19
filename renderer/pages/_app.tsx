import "../styles/globals.css";
import Head from "next/head";
import { AppProps } from "next/app";
import { Provider } from "jotai";
import "react-tooltip/dist/react-tooltip.css";
import { Toaster } from "@/components/ui/toaster";
import { Tooltip } from "react-tooltip";
import { IS_WEB } from "@/lib/platform";
import { installWebRuntime } from "@/lib/web/runtime";

// On the website, the browser takes the place of the Electron main process
if (IS_WEB) installWebRuntime();

const MyApp = ({ Component, pageProps }: AppProps) => {
  return (
    <>
      <Head>
        <title>LMS (LUAN MKT STUDIO)</title>
        {IS_WEB && (
          <meta
            name="description"
            content="Bộ công cụ AI xử lý ảnh chạy ngay trên trình duyệt: kích nét, xóa nền, chuyển vector, bế file in ấn, ảnh thẻ."
          />
        )}
      </Head>
      <base href="./" />

      <Provider>
        <Component {...pageProps} data-theme="upscayl" />
        <Toaster />
        <Tooltip
          className="z-[999] max-w-sm break-words !bg-secondary"
          id="tooltip"
        />
      </Provider>
    </>
  );
};

export default MyApp;
