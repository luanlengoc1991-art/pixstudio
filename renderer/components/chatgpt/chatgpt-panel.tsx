import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import type { WebviewTag } from "electron";
import { ArrowLeft, ArrowRight, ExternalLink, Loader2, LogOut, RotateCw } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { activeTabAtom } from "@/atoms/workspace-atom";
import {
  addChatGptResultAtom,
  ChatGptJob,
  chatGptConnectionAtom,
  chatGptLastToolAtom,
  chatGptQueueAtom,
  chatGptToolStateAtom,
  updateChatGptToolStateAtom,
} from "@/atoms/chatgpt-atom";
import {
  ATTACHMENT_COUNT_SCRIPT,
  CAPTURE_SCRIPT,
  CHATGPT_URL,
  FETCH_IMAGE_SCRIPT,
  FILL_AND_SEND_SCRIPT,
  FILL_ERRORS,
  LOGIN_CHECK_SCRIPT,
  POLL_SCRIPT,
  ReferenceFile,
  REGISTER_UPLOADS_SCRIPT,
  RESET_CAPTURE_SCRIPT,
} from "@/lib/chatgpt/scripts";
import { dataUrlToBytes, imageSize, looksAlike, mimeExtension, pathToDataUrl } from "@/lib/chatgpt/image-utils";
import { useToast } from "@/components/ui/use-toast";

const PARTITION = "persist:chatgpt";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Candidate = { fileId: string; url: string; fileName?: string };

/**
 * The embedded ChatGPT tab. It stays mounted once created (hidden behind the
 * workspace when another tab is active) and runs the queued tool jobs.
 */
export default function ChatGptPanel() {
  const ref = useRef<WebviewTag | null>(null);
  const readyRef = useRef(false);
  const runningRef = useRef<string | null>(null);
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const [connection, setConnection] = useAtom(chatGptConnectionAtom);
  const [queue, setQueue] = useAtom(chatGptQueueAtom);
  const toolStates = useAtomValue(chatGptToolStateAtom);
  const toolStatesRef = useRef(toolStates);
  toolStatesRef.current = toolStates;
  const updateState = useSetAtom(updateChatGptToolStateAtom);
  const addResult = useSetAtom(addChatGptResultAtom);
  const lastTool = useAtomValue(chatGptLastToolAtom);
  const lastToolRef = useRef(lastTool);
  lastToolRef.current = lastTool;

  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState({ back: false, forward: false });
  const visible = activeTab === "chatgpt";

  const exec = useCallback(async <T,>(code: string, gesture = false): Promise<T | null> => {
    const view = ref.current;
    if (!view || !readyRef.current) return null;
    try {
      return (await view.executeJavaScript(code, gesture)) as T;
    } catch (error) {
      console.warn("[ChatGPT] script failed", error);
      return null;
    }
  }, []);

  const checkLogin = useCallback(async () => {
    const ok = await exec<boolean>(LOGIN_CHECK_SCRIPT);
    setConnection(ok ? "connected" : "disconnected");
    return Boolean(ok);
  }, [exec, setConnection]);

  // Webview lifecycle: inject the capture hooks on every page load
  useEffect(() => {
    const view = ref.current;
    if (!view) return;
    const onReady = () => {
      readyRef.current = true;
      exec(CAPTURE_SCRIPT);
      checkLogin();
    };
    const onStart = () => setLoading(true);
    const onStop = () => {
      setLoading(false);
      try {
        setNav({ back: view.canGoBack(), forward: view.canGoForward() });
      } catch {}
      exec(CAPTURE_SCRIPT);
      checkLogin();
    };
    view.addEventListener("dom-ready", onReady);
    view.addEventListener("did-start-loading", onStart);
    view.addEventListener("did-stop-loading", onStop);
    const timer = window.setInterval(() => readyRef.current && checkLogin(), 4000);
    setConnection("checking");
    return () => {
      window.clearInterval(timer);
      view.removeEventListener("dom-ready", onReady);
      view.removeEventListener("did-start-loading", onStart);
      view.removeEventListener("did-stop-loading", onStop);
    };
  }, [exec, checkLogin, setConnection]);

  // Images downloaded by hand in the ChatGPT tab go to the last tool used
  useEffect(() => {
    window.electron.on(ELECTRON_COMMANDS.CHATGPT_DOWNLOADED, (_: unknown, path: string) => {
      const toolId = lastToolRef.current;
      if (!toolId) {
        toast({ title: "Đã tải ảnh", description: path });
        return;
      }
      addResult({ toolId, path });
      toast({ title: "Đã nhận ảnh từ ChatGPT" });
    });
  }, []);

  const loadAndWait = async (url: string) => {
    const view = ref.current!;
    const stopped = new Promise<void>((resolve) => {
      const done = () => {
        view.removeEventListener("did-stop-loading", done);
        resolve();
      };
      view.addEventListener("did-stop-loading", done);
      setTimeout(done, 30000);
    });
    try {
      await view.loadURL(url);
    } catch {}
    await stopped;
  };

  const runJob = async (job: ChatGptJob) => {
    const isCurrent = () => {
      const state = toolStatesRef.current[job.toolId];
      return state?.jobId === job.id && state.status !== "cancelled";
    };
    const update = (patch: Parameters<typeof updateState>[0]["patch"]) =>
      updateState({ toolId: job.toolId, jobId: job.id, patch });
    const fail = (message: string) => update({ status: "error", message });

    // Wait for the webview to exist
    for (let i = 0; i < 60 && !readyRef.current; i++) await sleep(250);
    if (!readyRef.current) return fail("ChatGPT chưa sẵn sàng. Hãy thử lại sau vài giây.");

    update({ status: "sending", message: "Đang mở ChatGPT..." });
    if (job.newChat) await loadAndWait(CHATGPT_URL);
    await exec(CAPTURE_SCRIPT);

    let loggedIn = false;
    for (let i = 0; i < 40 && !loggedIn; i++) {
      loggedIn = await checkLogin();
      if (!loggedIn) await sleep(500);
    }
    if (!loggedIn) {
      setActiveTab("chatgpt");
      return fail("Bạn chưa đăng nhập ChatGPT. Hãy đăng nhập ở tab ChatGPT rồi bấm tạo lại.");
    }
    if (!isCurrent()) return;

    update({ message: "Đang gửi ảnh và yêu cầu sang ChatGPT..." });
    const files: ReferenceFile[] = [];
    for (let index = 0; index < job.imagePaths.length; index++) {
      const dataUrl = await pathToDataUrl(job.imagePaths[index]);
      files.push({ name: `pix-input-${index + 1}.${mimeExtension(dataUrl)}`, dataUrl });
    }
    const fileNames = job.imagePaths.map((p) => p.split(/[\\/]/).pop()!.toLowerCase());
    await exec(RESET_CAPTURE_SCRIPT(job.newChat, [...fileNames, ...files.map((f) => f.name)]));

    // Attach the images before typing, and only send once they show in the composer
    let attachedSynthetic = false;
    if (files.length) {
      const id = ref.current!.getWebContentsId();
      const count = async () => (await exec<number>(ATTACHMENT_COUNT_SCRIPT)) ?? -1;
      const waitFor = async (target: number, ms: number) => {
        for (const end = Date.now() + ms; Date.now() < end; ) {
          if ((await count()) >= target) return true;
          await sleep(300);
        }
        return false;
      };
      const start = Math.max(0, await count());
      const target = start + files.length;

      // 1. Real files through the DevTools protocol, as a file dialog would
      await window.electron.invoke(ELECTRON_COMMANDS.CHATGPT_ATTACH_FILES, { webContentsId: id, paths: job.imagePaths });
      let attached = await waitFor(target, 15000);
      // 2. Native clipboard paste, one image at a time
      if (!attached) {
        for (const path of job.imagePaths) {
          await window.electron.invoke(ELECTRON_COMMANDS.CHATGPT_NATIVE_PASTE, { webContentsId: id, imagePath: path });
          await sleep(1200);
        }
        attached = await waitFor(target, 10000);
      }
      // 3. Synthetic file input / drop / paste events inside the page
      if (!attached) attachedSynthetic = true;
      else {
        await sleep(1500);
        await exec(REGISTER_UPLOADS_SCRIPT);
      }
    }

    const result = await exec<{ ok: boolean; reason?: string }>(
      FILL_AND_SEND_SCRIPT(job.prompt, attachedSynthetic ? files : [], !!job.nativeEdit),
      true,
    );
    if (!result?.ok) return fail(FILL_ERRORS[result?.reason ?? ""] ?? "Không gửi được yêu cầu sang ChatGPT. Hãy thử lại.");
    await sleep(1500);
    await exec(REGISTER_UPLOADS_SCRIPT);

    update({ status: "waiting", message: "ChatGPT đang tạo ảnh..." });
    const inputs = files.map((f) => f.dataUrl);
    const collected: string[] = [];
    const multi = job.expected > 1;
    const sentAt = Date.now();
    let lastImageAt = Date.now();
    let idlePolls = 0;
    const limit = multi ? 15 * 60 * 1000 : 6 * 60 * 1000;

    for (let step = 0; Date.now() - sentAt < limit; step++) {
      if (!isCurrent()) return;
      const poll = await exec<{ candidates: Candidate[]; generating: boolean; missing?: boolean }>(POLL_SCRIPT(multi, step));
      if (poll?.missing) await exec(CAPTURE_SCRIPT);
      for (const candidate of poll?.candidates ?? []) {
        const dataUrl = await exec<string>(FETCH_IMAGE_SCRIPT(candidate.url));
        if (!dataUrl) continue;
        const size = await imageSize(dataUrl);
        if (!size || size.width < 64 || size.height < 64) continue;
        let duplicate = false;
        for (const input of inputs) if (await looksAlike(dataUrl, input)) duplicate = true;
        // A gallery thumbnail and its full-size view can have different URLs: compare pixels too
        for (const done of collected) if (await looksAlike(dataUrl, done, multi ? 2 : 3)) duplicate = true;
        if (duplicate) continue;

        const path: string = await window.electron.invoke(ELECTRON_COMMANDS.SAVE_TEMP_IMAGE, {
          bytes: await dataUrlToBytes(dataUrl),
          name: `${job.toolId}.${mimeExtension(dataUrl)}`,
        });
        collected.push(dataUrl);
        lastImageAt = Date.now();
        addResult({ toolId: job.toolId, jobId: job.id, path });
        update({
          message: multi ? `Đã nhận ${collected.length}/${job.expected} ảnh...` : "Đã nhận ảnh kết quả.",
        });
      }

      if (collected.length >= job.expected) {
        return update({ status: "done", message: multi ? `Hoàn tất ${collected.length} ảnh.` : "Hoàn tất." });
      }
      const generating = Boolean(poll?.generating);
      idlePolls = generating ? 0 : idlePolls + 1;
      const quietFor = Date.now() - lastImageAt;
      if (!multi && collected.length > 0 && !generating) return update({ status: "done", message: "Hoàn tất." });
      if (multi && collected.length > 0 && idlePolls > 40 && quietFor > 30000) {
        return update({
          status: "partial",
          message: `ChatGPT đã dừng ở ${collected.length}/${job.expected} ảnh. Bấm "Tạo tiếp" để lấy phần còn lại.`,
        });
      }
      if (collected.length === 0 && idlePolls > 60 && Date.now() - sentAt > 45000) {
        return fail("ChatGPT chưa trả ảnh (có thể đang hỏi lại hoặc hết lượt tạo ảnh). Hãy xem ở tab ChatGPT.");
      }
      await sleep(700);
    }
    if (collected.length > 0) return update({ status: "partial", message: `Hết thời gian chờ, đã nhận ${collected.length} ảnh.` });
    fail("Hết thời gian chờ ChatGPT. Hãy xem ở tab ChatGPT.");
  };

  // Run queued jobs one at a time
  useEffect(() => {
    const job = queue[0];
    if (!job || runningRef.current === job.id) return;
    runningRef.current = job.id;
    runJob(job)
      .catch((error) => {
        console.error("[ChatGPT] job failed", error);
        updateState({ toolId: job.toolId, jobId: job.id, patch: { status: "error", message: "Lỗi khi làm việc với ChatGPT. Hãy thử lại." } });
      })
      .finally(() => {
        runningRef.current = null;
        setQueue((current) => current.filter((j) => j.id !== job.id));
      });
  }, [queue]);

  const logout = async () => {
    await window.electron.invoke(ELECTRON_COMMANDS.CHATGPT_LOGOUT, undefined);
    ref.current?.loadURL(CHATGPT_URL);
    toast({ title: "Đã đăng xuất ChatGPT" });
  };

  return (
    <section
      className={cn(
        "absolute inset-0 flex flex-col bg-base-300 p-3",
        // Kept rendered while hidden so ChatGPT keeps loading images during jobs
        visible ? "z-20" : "pointer-events-none -z-10 opacity-0",
      )}
      aria-hidden={!visible}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-lg">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-base-content/10 bg-base-200 px-3">
          <button className="btn btn-ghost btn-sm btn-square" disabled={!nav.back} onClick={() => ref.current?.goBack()} aria-label="Quay lại">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-sm btn-square" disabled={!nav.forward} onClick={() => ref.current?.goForward()} aria-label="Tiến">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-sm btn-square" onClick={() => ref.current?.reload()} aria-label="Tải lại">
            <RotateCw className="h-4 w-4" />
          </button>
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-base-content/10 bg-base-100 px-3 py-1.5 text-xs font-semibold">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <span className={cn("h-2 w-2 rounded-full", connection === "connected" ? "bg-emerald-500" : "bg-amber-500")} />
            )}
            <span className="truncate">
              {connection === "connected" ? "ChatGPT đã kết nối" : "ChatGPT · hãy đăng nhập để dùng các công cụ AI"}
            </span>
          </div>
          <button className="btn btn-ghost btn-sm btn-square" onClick={() => window.open(CHATGPT_URL, "_blank")} aria-label="Mở trong trình duyệt">
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={logout}
            data-tooltip-id="tooltip"
            data-tooltip-content="Đăng xuất ChatGPT"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <webview
          ref={ref as React.Ref<HTMLElement>}
          src={CHATGPT_URL}
          partition={PARTITION}
          // React needs the string form for this webview attribute
          {...({ allowpopups: "true" } as object)}
          webpreferences="backgroundThrottling=no"
          className="min-h-0 flex-1"
        />
      </div>
    </section>
  );
}

