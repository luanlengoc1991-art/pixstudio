// Scripts injected into the ChatGPT webview. They run in the chatgpt.com page,
// so they are plain JavaScript strings and must not reference app code.
// The approach follows pixAI 1.2.6 (AGPL-3.0): network hooks + DOM scans
// collect generated images, while uploads are blacklisted so the user's own
// pictures are never mistaken for results.

export const CHATGPT_URL = "https://chatgpt.com/";

/** Installs the capture state, fetch/XHR hooks and a MutationObserver once per page. */
export const CAPTURE_SCRIPT = String.raw`
(() => {
  const cap = (window.__PIX_CAPTURE__ = window.__PIX_CAPTURE__ || {
    inputIds: new Set(),
    inputNames: new Set(),
    seenIds: new Set(),
    seenUrls: new Set(),
    candidates: [],
  });
  if (cap.installed) return true;
  cap.installed = true;

  const fileId = (str) => {
    if (!str || typeof str !== "string") return null;
    const m = str.match(/[?&]id=((?:file|sed|user)[-_][a-zA-Z0-9_-]+)/i) || str.match(/((?:file|sed|user)[-_][a-zA-Z0-9_-]+)/i);
    if (m) return m[1].toLowerCase();
    try {
      const u = new URL(str, location.origin);
      const clean = (u.origin + u.pathname).replace(/[^\w-]/g, "_");
      if (clean.length > 10) return clean.slice(-60).toLowerCase();
    } catch (e) {}
    return null;
  };
  const normUrl = (str) => {
    try { const u = new URL(str, location.origin); return (u.origin + u.pathname).toLowerCase(); }
    catch (e) { return String(str || "").split("?")[0].split("#")[0].toLowerCase(); }
  };
  cap.fileId = fileId;
  cap.normUrl = normUrl;

  cap.emit = (item, source) => {
    const url = String((item && item.url) || "").trim();
    if (!url || url.startsWith("data:image/svg")) return;
    const status = String(item.status || "").toLowerCase();
    if (status && status !== "success" && status !== "completed") return;
    if (item.fileSize && item.fileSize < 1024) return;
    const name = String(item.fileName || "").toLowerCase();
    if (name && (name.startsWith("pix-input-") || cap.inputNames.has(name))) return;
    const n = normUrl(url);
    if (n && cap.seenUrls.has(n)) return;
    const id = item.fileId || fileId(url) || "img_" + url.slice(-32).replace(/[^\w-]/g, "_");
    if (cap.inputIds.has(id) || cap.seenIds.has(id)) return;
    cap.seenIds.add(id);
    if (n) cap.seenUrls.add(n);
    cap.candidates.push({ fileId: id, url, fileName: item.fileName || "", source });
  };

  const isUpload = (method, url) => method === "POST" && /\/files|\/upload/.test(url);
  const watched = (url) => /\/backend-api\/|estuary|\/files|oaiusercontent/.test(url);
  const handleJson = (method, url, data) => {
    if (!data) return;
    if (isUpload(method, url)) {
      const id = data.id || (data.download_url ? fileId(data.download_url) : null);
      if (id) cap.inputIds.add(String(id).toLowerCase());
      if (data.file_name) cap.inputNames.add(String(data.file_name).toLowerCase());
      return;
    }
    const list = Array.isArray(data) ? data : [data];
    for (const d of list) {
      if (d && d.download_url) {
        cap.emit({ url: d.download_url, fileId: fileId(d.download_url), fileName: d.file_name, fileSize: d.file_size_bytes, status: d.status }, "network");
      }
    }
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "";
      const method = String((args[0] && args[0].method) || (args[1] && args[1].method) || "GET").toUpperCase();
      if (watched(url)) res.clone().json().then((d) => handleJson(method, url, d)).catch(() => {});
    } catch (e) {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__pixUrl = typeof url === "string" ? url : "";
    this.__pixMethod = String(method || "GET").toUpperCase();
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("load", function () {
      try {
        if (watched(this.__pixUrl) && this.responseText && this.responseText.includes("download_url")) {
          handleJson(this.__pixMethod, this.__pixUrl, JSON.parse(this.responseText));
        }
      } catch (e) {}
    });
    return origSend.apply(this, args);
  };

  const inUserTurn = (el) => {
    if (el.closest('form, #prompt-textarea, [data-message-author-role="user"], [data-testid*="user"]')) return true;
    const turn = el.closest('article, [data-testid*="conversation-turn"]');
    if (!turn) return false;
    const role = turn.getAttribute("data-message-author-role") ||
      (turn.querySelector("[data-message-author-role]") || { getAttribute: () => "" }).getAttribute("data-message-author-role");
    return role === "user";
  };
  cap.inUserTurn = inUserTurn;

  const inspect = (img) => {
    if (!img || img.closest('nav, [class*="sidebar"], [class*="conversation-list"]')) return;
    const src = img.currentSrc || img.src || img.getAttribute("data-src") || "";
    if (!src || src.startsWith("data:image/svg") || /avatar|auth0|profile/.test(src)) return;
    if (inUserTurn(img)) {
      const id = fileId(src);
      if (id) cap.inputIds.add(id);
      cap.seenUrls.add(normUrl(src));
      return;
    }
    if (img.closest('[aria-busy="true"], [class*="loading"], [class*="shimmer"], [class*="skeleton"], [class*="generating"]')) return;
    if (!img.complete) { img.addEventListener("load", () => inspect(img), { once: true }); return; }
    if ((img.naturalWidth || 0) < 64 || (img.naturalHeight || 0) < 64) return;
    cap.emit({ url: src, fileId: fileId(src) }, "dom");
  };
  cap.inspect = inspect;

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === "IMG") inspect(node);
        else node.querySelectorAll("img").forEach(inspect);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  return true;
})()
`;

/** True when the chat box is visible and no login button / auth page is shown. */
export const LOGIN_CHECK_SCRIPT = String.raw`
(() => {
  const input = document.querySelector("#prompt-textarea, [contenteditable='true'], textarea");
  const loginButton = Array.from(document.querySelectorAll("button, a, [role='button']")).some((el) => {
    const r = el.getBoundingClientRect();
    const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    return r.width > 0 && r.height > 0 && /^(log in|sign up|đăng nhập|đăng ký)$/i.test(text);
  });
  const authRoute = /\/(auth|login|signup)(\/|$)/i.test(location.href);
  return Boolean(input && !authRoute && !loginButton);
})()
`;

/** Marks every image already in the conversation as seen, so only new results count. */
export const RESET_CAPTURE_SCRIPT = (newChat: boolean, inputNames: string[]) => String.raw`
(() => {
  const cap = window.__PIX_CAPTURE__;
  if (!cap) return false;
  cap.candidates = [];
  if (${newChat}) { cap.seenIds.clear(); cap.seenUrls.clear(); }
  ${JSON.stringify(inputNames)}.forEach((n) => cap.inputNames.add(n.toLowerCase()));
  document.querySelectorAll("img").forEach((img) => {
    const src = img.currentSrc || img.src || "";
    if (!src) return;
    const id = cap.fileId(src);
    if (id) cap.seenIds.add(id);
    cap.seenUrls.add(cap.normUrl(src));
  });
  document.querySelectorAll('a[href*="/files/"], a[download]').forEach((a) => {
    const id = cap.fileId(a.getAttribute("href") || "");
    if (id) cap.seenIds.add(id);
  });
  return true;
})()
`;

/** Number of image thumbnails attached in the composer (compare before / after attaching). */
export const ATTACHMENT_COUNT_SCRIPT = String.raw`
(() => {
  const input = document.querySelector("#prompt-textarea");
  const composer = (input && (input.closest("form") || input.closest('[data-testid*="composer"]'))) || null;
  if (!composer) return -1;
  return Array.from(composer.querySelectorAll("img")).filter((img) => {
    const r = img.getBoundingClientRect();
    return r.width > 8 && r.height > 8;
  }).length;
})()
`;

/** Blacklists everything currently attached or posted by the user. */
export const REGISTER_UPLOADS_SCRIPT = String.raw`
(() => {
  const cap = window.__PIX_CAPTURE__;
  if (!cap) return false;
  document.querySelectorAll('form img, [data-testid*="attachment"] img, [data-message-author-role="user"] img, a[href*="backend-api/files"]').forEach((el) => {
    const src = el.currentSrc || el.src || el.getAttribute("href") || "";
    const id = cap.fileId(src);
    if (id) cap.inputIds.add(id);
    if (src) cap.seenUrls.add(cap.normUrl(src));
  });
  cap.candidates = cap.candidates.filter((c) => !cap.inputIds.has(c.fileId));
  return true;
})()
`;

export type ReferenceFile = { name: string; dataUrl: string };

/**
 * Fills the composer, attaches the reference images and presses Send.
 * Returns { ok, reason } where reason is one of FILL_ERRORS' keys.
 */
export const FILL_AND_SEND_SCRIPT = (prompt: string, files: ReferenceFile[], nativeEdit: boolean) => String.raw`
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const promptText = ${JSON.stringify(prompt)};
  const refs = ${JSON.stringify(files)};
  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  };
  const findInput = () => {
    const all = Array.from(document.querySelectorAll(
      '#prompt-textarea, textarea[placeholder*="Describe edits"], textarea[placeholder*="Mô tả chỉnh sửa"], textarea, [contenteditable="true"]'
    )).filter(visible);
    return all.find((el) => /describe edits|mô tả chỉnh sửa/i.test(el.getAttribute("placeholder") || "")) ||
      all.find((el) => el.id === "prompt-textarea") || all[0] || null;
  };
  const click = (el) => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }));
    el.click();
  };
  const setText = (el, value) => {
    el.focus();
    if (el.isContentEditable) {
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false);
      document.execCommand("insertText", false, value);
    } else {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, value);
    }
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
  };

  let input = findInput();
  for (let i = 0; !input && i < 30; i++) { await sleep(300); input = findInput(); }
  if (!input) return { ok: false, reason: "input_not_found" };

  // Follow-up edits go through ChatGPT's own "Edit" on the last generated image
  if (${nativeEdit}) {
    const last = Array.from(document.querySelectorAll('[data-message-author-role="assistant"] img')).pop();
    const scope = (last && last.closest('[data-message-author-role="assistant"], article')) || document;
    const edit = Array.from(scope.querySelectorAll('button, [role="button"]'))
      .find((b) => visible(b) && /^(edit|chỉnh sửa)$/i.test((b.innerText || "").trim()));
    if (edit) { click(edit); await sleep(800); input = findInput() || input; }
  }

  setText(input, promptText);
  await sleep(400);

  if (refs.length) {
    const buildFiles = () => refs.map((ref) => {
      const [head, body] = ref.dataUrl.split(",");
      const mime = (head.match(/^data:([^;]+);/) || [])[1] || "image/png";
      const bin = atob(body || "");
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new File([bytes], ref.name, { type: mime });
    });
    const transfer = () => { const dt = new DataTransfer(); buildFiles().forEach((f) => dt.items.add(f)); return dt; };
    const attachmentCount = () => {
      const form = input.closest("form") || input.parentElement;
      return form ? form.querySelectorAll("img").length : 0;
    };
    const startCount = attachmentCount();
    const waitAttached = async (tries) => {
      for (let i = 0; i < tries; i++) { if (attachmentCount() >= startCount + refs.length) return true; await sleep(250); }
      return false;
    };
    const viaFileInput = async () => {
      let fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) {
        const add = Array.from(document.querySelectorAll("button")).find((b) =>
          /add photos|add files|attach|upload|đính kèm|tải lên|thêm ảnh/i.test((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("title") || "")));
        if (add) { click(add); await sleep(500); fileInput = document.querySelector('input[type="file"]'); }
      }
      if (!fileInput) return;
      fileInput.files = transfer().files;
      fileInput.dispatchEvent(new Event("input", { bubbles: true }));
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const viaDrop = () => {
      const target = input.closest("form") || input.parentElement || input;
      const dt = transfer();
      const opts = { bubbles: true, cancelable: true, dataTransfer: dt };
      target.dispatchEvent(new DragEvent("dragenter", opts));
      target.dispatchEvent(new DragEvent("dragover", opts));
      target.dispatchEvent(new DragEvent("drop", opts));
    };
    const viaPaste = () => input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: transfer() }));

    await viaFileInput();
    let attached = await waitAttached(30);
    if (!attached) { viaDrop(); attached = await waitAttached(20); }
    if (!attached) { viaPaste(); attached = await waitAttached(20); }
    if (!attached) return { ok: false, reason: "upload_failed" };

    // Uploaded files must never be collected as results
    const cap = window.__PIX_CAPTURE__;
    await sleep(1000);
    if (cap) {
      document.querySelectorAll('form img, [data-testid*="attachment"] img, a[href*="backend-api/files"]').forEach((el) => {
        const id = cap.fileId(el.src || el.getAttribute("href") || "");
        if (id) cap.inputIds.add(id);
      });
      cap.candidates = cap.candidates.filter((c) => !cap.inputIds.has(c.fileId));
    }
    input = findInput();
    if (!input) return { ok: false, reason: "input_lost" };
    if (!(input.innerText || input.value || "").trim()) setText(input, promptText);
  }

  const findSend = () => {
    const sel = 'button[data-testid*="send-button"], button[data-testid="composer-submit-button"], button[aria-label*="Send"], button[aria-label*="Gửi"], form button[type="submit"]';
    const usable = (b) => b && !b.disabled && visible(b);
    const form = input.closest("form");
    return (form && Array.from(form.querySelectorAll(sel)).find(usable)) || Array.from(document.querySelectorAll(sel)).find(usable) || null;
  };
  let send = null;
  for (let i = 0; i < 60; i++) {
    send = findSend();
    const uploading = document.querySelector('form [role="progressbar"], form [class*="progress"], form [class*="loading"]');
    if (send && !uploading) break;
    await sleep(300);
  }
  if (send) click(send);
  else input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
  return { ok: true };
})()
`;

export const FILL_ERRORS: Record<string, string> = {
  input_not_found: "Không tìm thấy ô nhập của ChatGPT. Hãy mở tab ChatGPT kiểm tra đã đăng nhập chưa.",
  upload_failed: "Không tải được ảnh lên ChatGPT (đã thử chọn file, kéo thả và dán). Hãy thử lại.",
  input_lost: "Đã tải ảnh lên nhưng không tìm lại được ô nhập của ChatGPT.",
};

/**
 * Returns new image candidates and whether ChatGPT is still generating.
 * With multiple expected images it scrolls galleries and steps through
 * thumbnails so lazily rendered images load.
 */
export const POLL_SCRIPT = (multi: boolean, step: number) => String.raw`
(() => {
  const cap = window.__PIX_CAPTURE__;
  if (!cap) return { candidates: [], generating: false, missing: true };
  if (${multi}) {
    document.querySelectorAll('main div[class*="overflow"], [class*="gallery"], [class*="carousel"]').forEach((el) => {
      try {
        if (el.scrollHeight > el.clientHeight + 4) el.scrollTop = el.scrollHeight;
        if (el.scrollWidth > el.clientWidth + 4) el.scrollLeft = el.scrollWidth;
      } catch (e) {}
    });
  }
  document.querySelectorAll('main img, [data-message-author-role="assistant"] img, article img').forEach((img) => cap.inspect(img));
  document.querySelectorAll('main a[href*="backend-api/files"], main a[href*="oaiusercontent"], main a[href*="estuary"]').forEach((a) => {
    if (cap.inUserTurn(a)) return;
    cap.emit({ url: a.href, fileId: cap.fileId(a.href) }, "link");
  });
  if (${multi}) {
    const thumbs = Array.from(document.querySelectorAll('main button img, main [role="button"] img'))
      .map((img) => img.closest('button, [role="button"]'))
      .filter((el) => el && !cap.inUserTurn(el) && el.getBoundingClientRect().width <= 350);
    const thumb = thumbs.length >= 2 ? thumbs[${step} % thumbs.length] : null;
    if (thumb) { try { thumb.click(); } catch (e) {} }
  }
  const candidates = cap.candidates.splice(0);
  const generating = Array.from(document.querySelectorAll('button, [role="button"]')).some((b) => {
    const label = ((b.getAttribute("aria-label") || "") + " " + (b.getAttribute("data-testid") || "")).toLowerCase();
    return /stop generating|stop streaming|dừng|stop-button/.test(label);
  }) || Boolean(document.querySelector('.result-streaming, [class*="result-streaming"]'));
  return { candidates, generating };
})()
`;

/** Downloads an image inside the ChatGPT page (with its cookies) as a data URL. */
export const FETCH_IMAGE_SCRIPT = (url: string) => String.raw`
(async () => {
  try {
    const res = await fetch(${JSON.stringify(url)}, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size < 1000) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" && reader.result.startsWith("data:image/") ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) { return null; }
})()
`;
