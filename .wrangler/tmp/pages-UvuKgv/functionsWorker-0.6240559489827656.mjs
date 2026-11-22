var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
if (!("__unenv__" in performance)) {
  const proto = Performance.prototype;
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key !== "constructor" && !(key in performance)) {
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (desc) {
        Object.defineProperty(performance, key, desc);
      }
    }
  }
}
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str2, encoding, cb) {
    if (str2 instanceof Uint8Array) {
      str2 = new TextDecoder().decode(str2);
    }
    try {
      console.log(str2);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var unenvProcess = new Process({
  env: globalProcess.env,
  hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  _channel,
  _debugEnd,
  _debugProcess,
  _disconnect,
  _events,
  _eventsCount,
  _exiting,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _handleQueue,
  _kill,
  _linkedBinding,
  _maxListeners,
  _pendingMessage,
  _preload_modules,
  _rawDebug,
  _send,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  assert: assert2,
  availableMemory,
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  disconnect,
  dlopen,
  domain,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  hrtime: hrtime3,
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  mainModule,
  memoryUsage,
  moduleLoadList,
  nextTick,
  off,
  on,
  once,
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// models/[name].ts
var onRequestGet = /* @__PURE__ */ __name(async ({ params, env: env2 }) => {
  const name = String(params.name);
  if (!/^[\w.-]+\.onnx$/.test(name)) return new Response("Not found", { status: 404 });
  const object = await env2.MODELS.get(name);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}, "onRequestGet");

// api/[[path]].ts
var DAY = 864e5;
var SESSION_DAYS = 30;
var PBKDF2_ITERATIONS = 1e5;
var MAX_FAILURES = 10;
var FAILURE_WINDOW = 15 * 6e4;
var ApiError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
  static {
    __name(this, "ApiError");
  }
};
var CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400"
};
var json = /* @__PURE__ */ __name((data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS }
}), "json");
var fail = /* @__PURE__ */ __name((status, code, message) => {
  throw new ApiError(status, code, message);
}, "fail");
var enc = new TextEncoder();
var b64 = /* @__PURE__ */ __name((bytes) => btoa(String.fromCharCode(...bytes)), "b64");
var unb64 = /* @__PURE__ */ __name((s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)), "unb64");
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""), "hex");
async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}
__name(pbkdf2, "pbkdf2");
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, stored) {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}
__name(verifyPassword, "verifyPassword");
var sha256 = /* @__PURE__ */ __name(async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s))), "sha256");
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(randomToken, "randomToken");
var KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
  return `LMS-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}
__name(newLicenseKey, "newLicenseKey");
var normalizeKey = /* @__PURE__ */ __name((k) => String(k ?? "").trim().toUpperCase().replace(/\s+/g, ""), "normalizeKey");
function str(body, name, opts = {}) {
  const v = body[name];
  if (v === void 0 || v === null || v === "") {
    if (opts.required) fail(400, "BAD_INPUT", `Thi\u1EBFu ${name}`);
    return "";
  }
  if (typeof v !== "string") fail(400, "BAD_INPUT", `${name} kh\xF4ng h\u1EE3p l\u1EC7`);
  const s = v.trim();
  if (opts.min && s.length < opts.min) fail(400, "BAD_INPUT", `${name} c\u1EA7n \xEDt nh\u1EA5t ${opts.min} k\xFD t\u1EF1`);
  if (s.length > (opts.max ?? 200)) fail(400, "BAD_INPUT", `${name} qu\xE1 d\xE0i`);
  return s;
}
__name(str, "str");
function int(body, name, min, max, fallback) {
  const v = body[name];
  if (v === void 0 || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, "BAD_INPUT", `${name} ph\u1EA3i l\xE0 s\u1ED1 t\u1EEB ${min} \u0111\u1EBFn ${max}`);
  return n;
}
__name(int, "int");
var USERNAME_RE = /^[A-Za-z0-9._@-]{3,64}$/;
async function readBody(request) {
  if (request.method === "GET" || request.method === "DELETE") return {};
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch {
    return fail(400, "BAD_INPUT", "D\u1EEF li\u1EC7u g\u1EEDi l\xEAn kh\xF4ng ph\u1EA3i JSON");
  }
}
__name(readBody, "readBody");
var isLive = /* @__PURE__ */ __name((l, now) => l.status === "active" && (l.expires_at === null || l.expires_at > now), "isLive");
async function currentLicense(db, userId, now) {
  const { results } = await db.prepare("SELECT * FROM licenses WHERE user_id = ? ORDER BY expires_at IS NOT NULL, expires_at DESC").bind(userId).all();
  const live = results.find((l) => isLive(l, now));
  return { live, expired: live ? void 0 : results.find((l) => l.status === "active") };
}
__name(currentLicense, "currentLicense");
async function deviceCount(db, key) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE license_key = ?").bind(key).first();
  return r?.n ?? 0;
}
__name(deviceCount, "deviceCount");
async function licenseView(db, l) {
  return {
    key: l.key,
    expiresAt: l.expires_at,
    maxDevices: l.max_devices,
    devices: await deviceCount(db, l.key),
    activatedAt: l.activated_at
  };
}
__name(licenseView, "licenseView");
async function authenticate(request, env2, now) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) fail(401, "NO_SESSION", "Ch\u01B0a \u0111\u0103ng nh\u1EADp");
  const tokenHash = await sha256(token);
  const row = await env2.DB.prepare(
    `SELECT u.id, u.username, u.role, u.display_name, u.disabled, s.device_id, s.token_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`
  ).bind(tokenHash, now).first();
  if (!row) fail(401, "NO_SESSION", "Phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 h\u1EBFt, h\xE3y \u0111\u0103ng nh\u1EADp l\u1EA1i");
  if (row.disabled) fail(403, "DISABLED", "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kho\xE1. Li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  return row;
}
__name(authenticate, "authenticate");
var userView = /* @__PURE__ */ __name((u) => ({
  username: u.username,
  displayName: u.display_name || u.username,
  role: u.role
}), "userView");
async function login(env2, body, now) {
  const db = env2.DB;
  const username = str(body, "username", { required: true, max: 64 });
  const password = str(body, "password", { required: true, max: 200 });
  const deviceId = str(body, "deviceId", { max: 100 });
  const deviceName = str(body, "deviceName", { max: 120 }) || "Kh\xF4ng r\xF5";
  const keyInput = normalizeKey(body.key);
  const failures = await db.prepare("SELECT count, first_at FROM login_failures WHERE username = ?").bind(username).first();
  if (failures && failures.count >= MAX_FAILURES && now - failures.first_at < FAILURE_WINDOW) {
    fail(429, "TOO_MANY", "Sai m\u1EADt kh\u1EA9u qu\xE1 nhi\u1EC1u l\u1EA7n. Th\u1EED l\u1EA1i sau 15 ph\xFAt.");
  }
  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first();
  if (!user || !await verifyPassword(password, String(user.pass_hash))) {
    if (failures && now - failures.first_at < FAILURE_WINDOW) {
      await db.prepare("UPDATE login_failures SET count = count + 1 WHERE username = ?").bind(username).run();
    } else {
      await db.prepare("INSERT OR REPLACE INTO login_failures (username, count, first_at) VALUES (?, 1, ?)").bind(username, now).run();
    }
    fail(401, "BAD_LOGIN", "Sai t\xEAn \u0111\u0103ng nh\u1EADp ho\u1EB7c m\u1EADt kh\u1EA9u");
  }
  const u = user;
  if (u.disabled) fail(403, "DISABLED", "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kho\xE1. Li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  const userId = Number(u.id);
  await db.prepare("DELETE FROM login_failures WHERE username = ?").bind(username).run();
  let license;
  if (u.role !== "admin") {
    if (keyInput) {
      const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(keyInput).first();
      if (!l || l.status !== "active") fail(403, "KEY_INVALID", "Key kh\xF4ng \u0111\xFAng ho\u1EB7c \u0111\xE3 b\u1ECB thu h\u1ED3i");
      if (l.user_id !== null && l.user_id !== userId) fail(403, "KEY_USED", "Key n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c d\xF9ng cho t\xE0i kho\u1EA3n kh\xE1c");
      if (l.expires_at !== null && l.expires_at <= now) fail(403, "KEY_EXPIRED", "Key \u0111\xE3 h\u1EBFt h\u1EA1n");
      if (l.user_id === null) {
        const expires = l.expires_at ?? (l.duration_days > 0 ? now + l.duration_days * DAY : null);
        await db.prepare("UPDATE licenses SET user_id = ?, activated_at = ?, expires_at = ? WHERE key = ? AND user_id IS NULL").bind(userId, now, expires, l.key).run();
        l.user_id = userId;
        l.activated_at = now;
        l.expires_at = expires;
      }
      license = l;
    } else {
      const { live, expired } = await currentLicense(db, userId, now);
      if (!live) {
        if (expired) fail(403, "KEY_EXPIRED", "Key c\u1EE7a t\xE0i kho\u1EA3n \u0111\xE3 h\u1EBFt h\u1EA1n. Nh\u1EADp key m\u1EDBi \u0111\u1EC3 gia h\u1EA1n.");
        fail(403, "NEED_KEY", "T\xE0i kho\u1EA3n ch\u01B0a c\xF3 key. Nh\u1EADp key b\u1EA3n quy\u1EC1n \u0111\u1EC3 k\xEDch ho\u1EA1t.");
      }
      license = live;
    }
    if (deviceId.length < 8) fail(400, "BAD_INPUT", "Thi\u1EBFu m\xE3 m\xE1y");
    const known = await db.prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?").bind(license.key, deviceId).first();
    if (known) {
      await db.prepare("UPDATE devices SET last_seen = ?, device_name = ? WHERE id = ?").bind(now, deviceName, known.id).run();
    } else {
      if (await deviceCount(db, license.key) >= license.max_devices) {
        fail(
          403,
          "DEVICE_LIMIT",
          `Key n\xE0y \u0111\xE3 d\xF9ng \u0111\u1EE7 ${license.max_devices} m\xE1y. Li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn \u0111\u1EC3 g\u1EE1 m\xE1y c\u0169.`
        );
      }
      await db.prepare(
        "INSERT INTO devices (license_key, device_id, device_name, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)"
      ).bind(license.key, deviceId, deviceName, now, now).run();
    }
  }
  const token = randomToken();
  await db.batch([
    db.prepare("INSERT INTO sessions (token_hash, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)").bind(await sha256(token), userId, deviceId, now, now + SESSION_DAYS * DAY),
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now, userId),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now)
  ]);
  return {
    token,
    user: userView(u),
    license: license ? await licenseView(db, license) : null
  };
}
__name(login, "login");
async function me(request, env2, now) {
  const db = env2.DB;
  const s = await authenticate(request, env2, now);
  let license;
  if (s.role !== "admin") {
    const { live, expired } = await currentLicense(db, s.id, now);
    if (!live) {
      if (expired) fail(403, "KEY_EXPIRED", "Key c\u1EE7a t\xE0i kho\u1EA3n \u0111\xE3 h\u1EBFt h\u1EA1n. Nh\u1EADp key m\u1EDBi \u0111\u1EC3 gia h\u1EA1n.");
      fail(403, "NEED_KEY", "T\xE0i kho\u1EA3n ch\u01B0a c\xF3 key c\xF2n hi\u1EC7u l\u1EF1c.");
    }
    license = live;
    const dev = await db.prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?").bind(license.key, s.device_id).first();
    if (!dev) fail(403, "DEVICE_REMOVED", "M\xE1y n\xE0y \u0111\xE3 b\u1ECB g\u1EE1 kh\u1ECFi key. \u0110\u0103ng nh\u1EADp l\u1EA1i.");
    await db.prepare("UPDATE devices SET last_seen = ? WHERE id = ?").bind(now, dev.id).run();
  }
  await db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(now + SESSION_DAYS * DAY, s.token_hash).run();
  return { user: userView(s), license: license ? await licenseView(db, license) : null, serverTime: now };
}
__name(me, "me");
async function changePassword(request, env2, body, now) {
  const s = await authenticate(request, env2, now);
  const oldPassword = str(body, "oldPassword", { required: true });
  const newPassword = str(body, "newPassword", { required: true, min: 6 });
  const u = await env2.DB.prepare("SELECT pass_hash FROM users WHERE id = ?").bind(s.id).first();
  if (!u || !await verifyPassword(oldPassword, u.pass_hash)) fail(403, "BAD_LOGIN", "M\u1EADt kh\u1EA9u c\u0169 kh\xF4ng \u0111\xFAng");
  await env2.DB.batch([
    env2.DB.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashPassword(newPassword), s.id),
    env2.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(s.id, s.token_hash)
  ]);
  return { ok: true };
}
__name(changePassword, "changePassword");
async function createKeys(db, count3, days, maxDevices, note, now, userId) {
  const keys = [];
  const stmts = [];
  for (let i = 0; i < count3; i++) {
    const key = newLicenseKey();
    keys.push(key);
    const activated = userId !== null ? now : null;
    const expires = userId !== null && days > 0 ? now + days * DAY : null;
    stmts.push(
      db.prepare(
        `INSERT INTO licenses (key, user_id, duration_days, max_devices, note, created_at, activated_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(key, userId, days, maxDevices, note, now, activated, expires)
    );
  }
  await db.batch(stmts);
  return keys;
}
__name(createKeys, "createKeys");
async function admin(request, env2, parts, body, now) {
  const db = env2.DB;
  const s = await authenticate(request, env2, now);
  if (s.role !== "admin") fail(403, "FORBIDDEN", "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn m\u1EDBi d\xF9ng \u0111\u01B0\u1EE3c");
  const m = request.method;
  const [area, id, sub] = parts;
  if (area === "stats" && m === "GET") {
    const one = /* @__PURE__ */ __name(async (sql, ...args) => (await db.prepare(sql).bind(...args).first())?.n ?? 0, "one");
    return {
      users: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
      keys: await one("SELECT COUNT(*) AS n FROM licenses"),
      liveKeys: await one(
        "SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NOT NULL AND (expires_at IS NULL OR expires_at > ?)",
        now
      ),
      unusedKeys: await one("SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NULL"),
      devices: await one("SELECT COUNT(*) AS n FROM devices"),
      activeToday: await one("SELECT COUNT(*) AS n FROM devices WHERE last_seen > ?", now - DAY)
    };
  }
  if (area === "users") {
    if (!id && m === "GET") {
      const { results } = await db.prepare(
        `SELECT u.id, u.username, u.display_name, u.role, u.note, u.disabled, u.created_at, u.last_login_at,
                  (SELECT COUNT(*) FROM licenses l WHERE l.user_id = u.id) AS key_count,
                  (SELECT MAX(COALESCE(l.expires_at, 9e15)) FROM licenses l
                     WHERE l.user_id = u.id AND l.status = 'active') AS expires_at,
                  (SELECT COUNT(*) FROM devices d JOIN licenses l ON l.key = d.license_key WHERE l.user_id = u.id) AS devices
             FROM users u ORDER BY u.created_at DESC`
      ).all();
      return { users: results };
    }
    if (!id && m === "POST") {
      const username = str(body, "username", { required: true });
      if (!USERNAME_RE.test(username)) fail(400, "BAD_INPUT", "T\xEAn \u0111\u0103ng nh\u1EADp 3-64 k\xFD t\u1EF1: ch\u1EEF, s\u1ED1, . _ @ -");
      const password = str(body, "password", { required: true, min: 6 });
      const role = body.role === "admin" ? "admin" : "user";
      const exists = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
      if (exists) fail(409, "EXISTS", "T\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 c\xF3");
      const r = await db.prepare("INSERT INTO users (username, pass_hash, role, display_name, note, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(username, await hashPassword(password), role, str(body, "displayName", { max: 100 }), str(body, "note", { max: 500 }), now).run();
      const userId2 = Number(r.meta.last_row_id);
      let keys = [];
      if (role === "user" && body.withKey) {
        keys = await createKeys(db, 1, int(body, "days", 0, 36500, 30), int(body, "maxDevices", 1, 100, 1), str(body, "keyNote", { max: 500 }), now, userId2);
      }
      return { id: userId2, username, keys };
    }
    const userId = Number(id);
    if (!Number.isInteger(userId)) fail(404, "NOT_FOUND", "Kh\xF4ng t\xECm th\u1EA5y");
    if (m === "PATCH") {
      const stmts = [];
      if (body.password !== void 0) {
        const pw = str(body, "password", { required: true, min: 6 });
        stmts.push(db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashPassword(pw), userId));
        stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
      }
      if (body.disabled !== void 0) {
        if (userId === s.id) fail(400, "BAD_INPUT", "Kh\xF4ng th\u1EC3 t\u1EF1 kho\xE1 ch\xEDnh m\xECnh");
        stmts.push(db.prepare("UPDATE users SET disabled = ? WHERE id = ?").bind(body.disabled ? 1 : 0, userId));
        if (body.disabled) stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
      }
      if (body.displayName !== void 0)
        stmts.push(db.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(str(body, "displayName", { max: 100 }), userId));
      if (body.note !== void 0)
        stmts.push(db.prepare("UPDATE users SET note = ? WHERE id = ?").bind(str(body, "note", { max: 500 }), userId));
      if (stmts.length) await db.batch(stmts);
      return { ok: true };
    }
    if (m === "DELETE") {
      if (userId === s.id) fail(400, "BAD_INPUT", "Kh\xF4ng th\u1EC3 xo\xE1 ch\xEDnh m\xECnh");
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM devices WHERE license_key IN (SELECT key FROM licenses WHERE user_id = ?)").bind(userId),
        db.prepare("UPDATE licenses SET status = 'revoked' WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM users WHERE id = ?").bind(userId)
      ]);
      return { ok: true };
    }
  }
  if (area === "keys") {
    if (!id && m === "GET") {
      const { results } = await db.prepare(
        `SELECT l.*, u.username,
                  (SELECT COUNT(*) FROM devices d WHERE d.license_key = l.key) AS devices
             FROM licenses l LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.created_at DESC LIMIT 2000`
      ).all();
      return { keys: results, now };
    }
    if (!id && m === "POST") {
      let userId = null;
      const username = str(body, "username", { max: 64 });
      if (username) {
        const u = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
        if (!u) fail(404, "NOT_FOUND", "Kh\xF4ng c\xF3 t\xE0i kho\u1EA3n " + username);
        userId = u.id;
      }
      const keys = await createKeys(
        db,
        int(body, "count", 1, 100, 1),
        int(body, "days", 0, 36500, 30),
        int(body, "maxDevices", 1, 100, 1),
        str(body, "note", { max: 500 }),
        now,
        userId
      );
      return { keys };
    }
    const key = normalizeKey(decodeURIComponent(id ?? ""));
    const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first();
    if (!l) fail(404, "NOT_FOUND", "Kh\xF4ng t\xECm th\u1EA5y key");
    if (sub === "devices" && m === "GET") {
      const { results } = await db.prepare("SELECT id, device_name, first_seen, last_seen FROM devices WHERE license_key = ? ORDER BY last_seen DESC").bind(key).all();
      return { devices: results };
    }
    if (m === "PATCH") {
      const stmts = [];
      if (body.status !== void 0) {
        if (body.status !== "active" && body.status !== "revoked") fail(400, "BAD_INPUT", "status sai");
        stmts.push(db.prepare("UPDATE licenses SET status = ? WHERE key = ?").bind(body.status, key));
      }
      if (body.maxDevices !== void 0)
        stmts.push(db.prepare("UPDATE licenses SET max_devices = ? WHERE key = ?").bind(int(body, "maxDevices", 1, 100, 1), key));
      if (body.note !== void 0)
        stmts.push(db.prepare("UPDATE licenses SET note = ? WHERE key = ?").bind(str(body, "note", { max: 500 }), key));
      if (body.addDays !== void 0) {
        const add = int(body, "addDays", -36500, 36500, 0);
        if (l.user_id === null) {
          stmts.push(
            db.prepare("UPDATE licenses SET duration_days = MAX(1, duration_days + ?) WHERE key = ?").bind(add, key)
          );
        } else if (l.expires_at !== null) {
          const base = Math.max(l.expires_at, now);
          stmts.push(db.prepare("UPDATE licenses SET expires_at = ? WHERE key = ?").bind(base + add * DAY, key));
        }
      }
      if (body.forever === true) stmts.push(db.prepare("UPDATE licenses SET expires_at = NULL, duration_days = 0 WHERE key = ?").bind(key));
      if (body.unassign === true) {
        stmts.push(db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key));
        stmts.push(db.prepare("UPDATE licenses SET user_id = NULL, activated_at = NULL, expires_at = NULL WHERE key = ?").bind(key));
      }
      if (stmts.length) await db.batch(stmts);
      return { ok: true };
    }
    if (m === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key),
        db.prepare("DELETE FROM licenses WHERE key = ?").bind(key)
      ]);
      return { ok: true };
    }
  }
  if (area === "devices" && id && m === "DELETE") {
    const dev = await db.prepare("SELECT d.device_id, l.user_id FROM devices d JOIN licenses l ON l.key = d.license_key WHERE d.id = ?").bind(Number(id)).first();
    if (!dev) fail(404, "NOT_FOUND", "Kh\xF4ng t\xECm th\u1EA5y m\xE1y");
    await db.batch([
      db.prepare("DELETE FROM devices WHERE id = ?").bind(Number(id)),
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND device_id = ?").bind(dev.user_id, dev.device_id)
    ]);
    return { ok: true };
  }
  return fail(404, "NOT_FOUND", "Kh\xF4ng c\xF3 \u0111\u01B0\u1EDDng d\u1EABn n\xE0y");
}
__name(admin, "admin");
var onRequest = /* @__PURE__ */ __name(async ({ request, env: env2, params }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const parts = [].concat(params.path ?? []).filter(Boolean);
  const now = Date.now();
  try {
    const body = await readBody(request);
    const [group3, action, ...rest] = parts;
    const m = request.method;
    if (group3 === "auth") {
      if (action === "login" && m === "POST") return json(await login(env2, body, now));
      if (action === "me" && m === "GET") return json(await me(request, env2, now));
      if (action === "logout" && m === "POST") {
        const header = request.headers.get("authorization") ?? "";
        if (header.startsWith("Bearer ")) {
          await env2.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(header.slice(7).trim())).run();
        }
        return json({ ok: true });
      }
      if (action === "password" && m === "POST") return json(await changePassword(request, env2, body, now));
    }
    if (group3 === "admin" && action) return json(await admin(request, env2, [action, ...rest], body, now));
    if (group3 === "health") return json({ ok: true, time: now, db: !!env2.DB });
    return json({ error: { code: "NOT_FOUND", message: "Kh\xF4ng c\xF3 \u0111\u01B0\u1EDDng d\u1EABn n\xE0y" } }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
    console.error(e);
    return json({ error: { code: "SERVER", message: "L\u1ED7i m\xE1y ch\u1EE7, th\u1EED l\u1EA1i sau" } }, 500);
  }
}, "onRequest");

// ../../.wrangler/tmp/pages-UvuKgv/functionsRoutes-0.1109038557126375.mjs
var routes = [
  {
    routePath: "/models/:name",
    mountPath: "/models",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/:path*",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest]
  }
];

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str2) {
  var tokens = [];
  var i = 0;
  while (i < str2.length) {
    var char = str2[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str2[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str2[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str2[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str2[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str2.length) {
        var code = str2.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str2[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count3 = 1;
      var pattern = "";
      var j = i + 1;
      if (str2[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str2.length) {
        if (str2[j] === "\\") {
          pattern += str2[j++] + str2[j++];
          continue;
        }
        if (str2[j] === ")") {
          count3--;
          if (count3 === 0) {
            j++;
            break;
          }
        } else if (str2[j] === "(") {
          count3++;
          if (str2[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str2[j++];
      }
      if (count3)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str2[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str2, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str2);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str2, options) {
  var keys = [];
  var re = pathToRegexp(str2, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str2) {
  return str2.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function getOriginalPathPrefix(requestPath, normalizedPrefix) {
  let end = 0;
  for (let index = 0; index < normalizedPrefix.length; index++) {
    end++;
    if (normalizedPrefix[index] === "/") {
      while (requestPath[end] === "/") {
        end++;
      }
    }
  }
  return requestPath.slice(0, end);
}
__name(getOriginalPathPrefix, "getOriginalPathPrefix");
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  const normalizedRequestPath = requestPath.replace(/\/+/g, "/");
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath) || routeMatcher(normalizedRequestPath);
    const originalMountMatch = mountMatcher(requestPath);
    const mountMatchResult = originalMountMatch || mountMatcher(normalizedRequestPath);
    if (matchResult && mountMatchResult) {
      const path = originalMountMatch ? originalMountMatch.path : getOriginalPathPrefix(requestPath, mountMatchResult.path);
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env2, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context2 = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env: env2,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context2);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error3) {
      if (isFailOpen) {
        const response = await env2["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error3;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    const body = JSON.stringify(error3);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../../.wrangler/tmp/bundle-30Y7iY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// C:/Users/luan/AppData/Local/npm-cache/_npx/c943b712072b77c4/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../../.wrangler/tmp/bundle-30Y7iY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.6240559489827656.mjs.map
