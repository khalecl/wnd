<script type="module">
'use strict';
	// Configure marked with syntax highlighting
	if (window.marked && window.hljs) {
	  marked.setOptions({
	    highlight: function (code, lang) {
	      if (lang && hljs.getLanguage(lang)) {
	        try { return hljs.highlight(code, { language: lang }).value; } catch {}
	      }
	      try { return hljs.highlightAuto(code).value; } catch { return code; }
	    },
	    breaks: true,
	    gfm: true,
	  });
	}
	
	function renderMarkdown(text) {
	  if (!text) return '';
	  if (!window.marked || !window.DOMPurify) return text;
	  try {
	    const html = marked.parse(text);
	    return DOMPurify.sanitize(html);
	  } catch {
	    return text;
	  }
	}
/* ============================================================================
 * 1. NAMESPACE + STATE
 * ==========================================================================*/
	const CodeSmith = {
	  version: '1.0.0',
	  db: null,
	  sandbox: null,
	  llm: null,
	  builder: null,
	  stageA: null,
	  stageB: null,
	  stageC: null,     // Day 6: multi-module build
	  state: {
		settings: null,
		sessions: [],
		currentId: null,
	  },
	  DB_NAME: 'codesmith_v1',
	  DB_VERSION: 2,
	  STORES: { SETTINGS: 'settings', SESSIONS: 'sessions', ARTIFACTS: 'artifacts' },
		DEFAULTS: {
				id: 'app',
				apiUrl: 'https://nvidia-proxy.khaled-mohamed-rady.workers.dev/v1',
				apiKey: '',
				modelOrchestrator: 'moonshotai/kimi-k2-thinking',
				modelWorker:       'mistralai/devstral-2-123b-instruct-2512',
				modelFast:         'meta/llama-3.1-8b-instruct',
				tokenBudgetCap: 100000,
				rateLimitRpm: 40,
				endpoints: [],  // [{name, apiUrl, apiKey, forTier: 'orchestrator'|'worker'|'fast'}]
				maxTokensOrchestrator: 20000,
				maxTokensWorker:       20000,
				maxTokensFast:         8000,
				parallelWorkers: 1,
				collabMode: 'solo',
			  },
	};
		// expose for devtools only — not for app code
			CodeSmith.PRESETS = {
			nvidia: {
				apiUrl: 'https://nvidia-proxy.khaled-mohamed-rady.workers.dev/v1',
				modelOrchestrator: 'moonshotai/kimi-k2-thinking',
				modelWorker: 'mistralai/devstral-2-123b-instruct-2512',
				modelFast: 'meta/llama-3.1-8b-instruct',
			},
			groq: {
				apiUrl: 'https://api.groq.com/openai/v1',
				modelOrchestrator: 'meta-llama/llama-4-maverick-17b-128e-instruct',
				modelWorker: 'qwen/qwen3-32b',
				modelFast: 'meta-llama/llama-4-scout-17b-16e-instruct',
			},
			custom: {
				apiUrl: '',
				modelOrchestrator: '',
				modelWorker: '',
				modelFast: '',
			},
			};
		CodeSmith.TEMPLATES = {
		python: {
				cleaner: {
				icon: '🧹', title: 'Data cleaner',
				desc: 'CSV cleaner: dedupe, fill missing, normalize columns.',
				prompt: 'Build a CSV data cleaner: reads a CSV file, removes duplicate rows, fills missing values with column mean (numeric) or mode (string), normalizes column names to snake_case, exports a clean version. Handle malformed rows gracefully.',
				},
				analyzer: {
				icon: '📊', title: 'Text analyzer',
				desc: 'Word/sentence stats, readability, top words, summary report.',
				prompt: 'Build a text analyzer: given a text string or file, compute word count, sentence count, average sentence length, Flesch-Kincaid readability grade, top 10 most frequent words, and generate a formatted summary report.',
				},
				organizer: {
				icon: '📁', title: 'File organizer',
				desc: 'CLI tool that sorts files by type, date, or rules.',
				prompt: 'Build a CLI file organizer: given a directory path, sort files into subfolders by type (images/, documents/, code/), with options for date-based organization. Handle name conflicts with numbering, support dry-run mode, produce a summary log.',
				},
				api: {
				icon: '🔌', title: 'API client',
				desc: 'CLI wrapper for a REST API with caching.',
				prompt: 'Build a Python CLI tool that fetches data from a REST API the user specifies, caches responses to disk with TTL, supports query params, formats output as JSON or table, and handles rate limiting with retries.',
				},
			},
		webapp: {
				todo: {
				icon: '✅', title: 'Todo list',
				desc: 'Tasks with categories, due dates, localStorage. Glassmorphism UI.',
				prompt: 'Build an HTML/JS todo app with: add/edit/delete tasks, categories with colored tags, due dates with overdue highlighting, filter by status/category, drag-to-reorder, localStorage persistence. STYLE: glassmorphism with frosted glass cards on a soft gradient background (deep purple → pink), Inter font from Google Fonts, smooth 200ms transitions, subtle shadows, rounded-xl corners. Mobile responsive.',
				},
				calc: {
				icon: '🔢', title: 'Calculator',
				desc: 'Scientific calculator with history. Neumorphic design.',
				prompt: 'Build an HTML/JS scientific calculator with: basic ops, scientific functions (sin/cos/log/sqrt/etc), keyboard support, expression history panel with click-to-reuse, paren matching. STYLE: neumorphic (soft 3D buttons that depress on click) on a #e0e5ec background, JetBrains Mono for the display, Inter for buttons, gentle press animations. Mobile responsive.',
				},
				dashboard: {
				icon: '📈', title: 'Stats dashboard',
				desc: 'Live charts dashboard. Dark mode with neon accents.',
				prompt: 'Build an HTML/JS analytics dashboard: 4 metric cards (with trend arrows), 2 line charts (Chart.js from CDN), 1 bar chart, date range picker, data refresh button (uses fake/random data on click). STYLE: dark mode (#0a0e1a base) with cyan/magenta neon accents, glow effects on hover, Space Grotesk font, animated number counters, grid layout. Mobile responsive (cards stack).',
				},
				notes: {
				icon: '📝', title: 'Markdown notes',
				desc: 'Live markdown editor with preview. Minimalist editorial.',
				prompt: 'Build an HTML/JS markdown notes app: split-pane editor (left) and preview (right) using marked.js from CDN, sidebar with note list, search, autosave to localStorage, export as .md. STYLE: minimalist editorial — cream background (#faf8f3), serif headings (Crimson Pro), sans-serif body (Inter), generous whitespace, hairline dividers, subtle paper texture. Toggle dark mode (#1a1a1a / #e8e3d8). Mobile collapses to single pane.',
				},
				pomodoro: {
				icon: '🍅', title: 'Pomodoro timer',
				desc: 'Focus timer with task list. Bold modern UI.',
				prompt: 'Build an HTML/JS pomodoro timer: 25/5/15 min cycles, task list (only one active at a time), session counter, browser notification on phase end, audio chime, daily stats. STYLE: bold modern — bright tomato red (#e63946) for work, deep teal (#06d6a0) for breaks, full-bleed color states, huge timer (200px+) in Bebas Neue, Inter elsewhere, smooth color transitions between states. Mobile-first.',
				},
				quiz: {
				icon: '🧠', title: 'Quiz app',
				desc: 'Interactive quiz with score tracking. Playful UI.',
				prompt: 'Build an HTML/JS quiz app: multiple choice questions (load from a JSON object in code), one question at a time, instant feedback (green/red flash), score tracker, results page with breakdown, retry. Include 10 sample questions about general knowledge. STYLE: playful — soft pastel gradients (peach/lavender/mint), rounded-3xl cards, Fredoka or Quicksand font, bouncy hover animations (scale 1.05), confetti on perfect score. Mobile responsive.',
				},
				custom: {
				icon: '✨', title: 'Custom',
				desc: 'Describe anything and AI will build it.',
				prompt: '',
				},
				},
				cli: {
					fileorg: {
					icon: '📁', title: 'File organizer',
					desc: 'Sort files by type/date with dry-run mode.',
					prompt: 'Build a Python CLI tool with argparse: organizes files in a target directory into subfolders by extension or date. Flags: --dry-run, --by-date, --target DIR. Print summary of moved files. Handle name conflicts with numeric suffix. Single .py file runnable as: python organize.py /path/to/folder',
					},
					csvtool: {
					icon: '📊', title: 'CSV toolkit',
					desc: 'Multi-command CSV utility (head, stats, filter).',
					prompt: 'Build a Python CLI with argparse subcommands: head FILE [-n N], stats FILE (count rows, numeric column means/min/max), filter FILE --col NAME --op eq|gt|lt --value V. Use stdlib csv module. Single .py file.',
					},
					backup: {
					icon: '💾', title: 'Backup tool',
					desc: 'Incremental directory backup with manifest.',
					prompt: 'Build a Python CLI: incremental backup of a source directory to a destination, computing SHA256 for each file, skipping unchanged files (compare against manifest.json). Flags: --source, --dest, --restore, --verify. Use stdlib only.',
					},
					custom: { icon: '✨', title: 'Custom', desc: 'Describe a CLI tool.', prompt: '' },
				},
				api: {
					todo: {
					icon: '✅', title: 'Todo API',
					desc: 'CRUD REST API with FastAPI + SQLite.',
					prompt: 'Build a FastAPI REST server: CRUD for todos (id, title, done, created_at) backed by SQLite. Routes: GET /todos, POST /todos, PUT /todos/{id}, DELETE /todos/{id}, GET /todos/{id}. Use sqlite3 stdlib (no SQLAlchemy). Pydantic models for request/response. Include uvicorn run instructions.',
					},
					auth: {
					icon: '🔐', title: 'Auth API',
					desc: 'JWT auth with register/login/me routes.',
					prompt: 'Build a FastAPI server with JWT auth: POST /register, POST /login (returns JWT), GET /me (requires JWT). User passwords hashed with hashlib pbkdf2. SQLite storage. JWT via PyJWT. Include OpenAPI tags and example responses.',
					},
					proxy: {
					icon: '🔌', title: 'API proxy',
					desc: 'Caching proxy for external APIs.',
					prompt: 'Build a FastAPI proxy server that forwards GET requests to a configurable upstream URL, caches responses in-memory with TTL (default 60s), exposes /stats endpoint showing cache hit rate. Use httpx for upstream calls. Configurable via env vars.',
					},
					custom: { icon: '✨', title: 'Custom', desc: 'Describe a REST API.', prompt: '' },
				},
				notebook: {
					eda: {
					icon: '📈', title: 'EDA notebook',
					desc: 'Exploratory data analysis template.',
					prompt: 'Build a Jupyter notebook (.ipynb JSON): exploratory data analysis on a CSV. Cells: load with pandas, .info() and .describe(), null counts, distribution plots for numeric columns (matplotlib), correlation heatmap, top-5 categories per object column, summary markdown. Include 2-3 markdown cells explaining findings.',
					},
					ml: {
					icon: '🤖', title: 'ML training',
					desc: 'Train/eval a classifier end-to-end.',
					prompt: 'Build a Jupyter notebook: load Iris from sklearn, train/test split, fit LogisticRegression and RandomForest, compare accuracy with classification_report and confusion_matrix, plot feature importances. Markdown cells explain each step.',
					},
					timeseries: {
					icon: '📅', title: 'Time series',
					desc: 'Time series exploration + forecast.',
					prompt: 'Build a Jupyter notebook: synthetic monthly time series (3 years), decompose with seasonal_decompose, plot trend/seasonal/residual, fit simple ARIMA(1,1,1), forecast next 12 months with confidence interval. Markdown explaining stationarity and ACF/PACF.',
					},
					custom: { icon: '✨', title: 'Custom', desc: 'Describe a notebook.', prompt: '' },
				},
			};

Object.defineProperty(window, 'CodeSmith', { value: CodeSmith, enumerable: false });

/* ============================================================================
 * 2. DB — promisified IndexedDB wrapper
 *    Every op returns a Promise. No callbacks leak past this section.
 * ==========================================================================*/
const DB = (() => {
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CodeSmith.DB_NAME, CodeSmith.DB_VERSION);
		req.onupgradeneeded = (ev) => {
			const db = ev.target.result;
			if (!db.objectStoreNames.contains(CodeSmith.STORES.SETTINGS)) {
			  db.createObjectStore(CodeSmith.STORES.SETTINGS, { keyPath: 'id' });
			}
			if (!db.objectStoreNames.contains(CodeSmith.STORES.SESSIONS)) {
			  const s = db.createObjectStore(CodeSmith.STORES.SESSIONS,
				{ keyPath: 'id', autoIncrement: true });
			  s.createIndex('updatedAt', 'updatedAt', { unique: false });
			}
			if (!db.objectStoreNames.contains(CodeSmith.STORES.ARTIFACTS)) {
			  db.createObjectStore(CodeSmith.STORES.ARTIFACTS, { keyPath: 'id' });
			}
			// Day 5: no new stores needed — stage state saved inside session objects
		  };
      req.onsuccess = () => { _db = req.result; resolve(_db); };
      req.onerror   = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB open blocked'));
    });
  }

  function tx(storeName, mode = 'readonly') {
    const t = _db.transaction(storeName, mode);
    return t.objectStore(storeName);
  }

  function pReq(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  // ---- Settings ----
  function getSettings() {
    return pReq(tx(CodeSmith.STORES.SETTINGS, 'readonly').get('app'));
  }
  function saveSettings(obj) {
    const record = { ...obj, id: 'app' };
    return pReq(tx(CodeSmith.STORES.SETTINGS, 'readwrite').put(record));
  }

  // ---- Sessions ----
  function listSessions() {
    return new Promise((resolve, reject) => {
      const store = tx(CodeSmith.STORES.SESSIONS, 'readonly');
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = req.result || [];
        arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(arr);
      };
      req.onerror = () => reject(req.error);
    });
  }
  function getSession(id) {
    return pReq(tx(CodeSmith.STORES.SESSIONS, 'readonly').get(id));
  }
	function putSession(session) {
		return pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').put(session)).catch(err => {
		if (err.name === 'QuotaExceededError') {
			console.warn('[DB] Storage quota exceeded — clearing old sessions');
			return clearOldSessions().then(() => pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').put(session)));
		}
		throw err;
		});
	}
	async function clearOldSessions() {
    const all = await listSessions();
    const keep = all.slice(0, 20);
    const remove = all.slice(20);
    for (const s of remove) {
      try { await pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').delete(s.id)); } catch {}
    }
  }
  async function createSession() {
    const now = Date.now();
    const session = {
      title: 'New session',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const id = await pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').add(session));
    return { ...session, id };
  }

	// ---- Artifacts (Day 4) ----
	  function listArtifacts() {
		return new Promise((resolve, reject) => {
		  const store = tx(CodeSmith.STORES.ARTIFACTS, 'readonly');
		  const req = store.getAll();
		  req.onsuccess = () => {
			const arr = req.result || [];
			arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
			resolve(arr);
		  };
		  req.onerror = () => reject(req.error);
		});
	  }
	  function getArtifact(id) {
		return pReq(tx(CodeSmith.STORES.ARTIFACTS, 'readonly').get(id));
	  }
	  function putArtifact(artifact) {
		return pReq(tx(CodeSmith.STORES.ARTIFACTS, 'readwrite').put(artifact));
	  }
	  function deleteArtifact(id) {
		return pReq(tx(CodeSmith.STORES.ARTIFACTS, 'readwrite').delete(id));
	  }
	return {
	    init: async () => { await open(); },
	    getSettings, saveSettings,
	    listSessions, getSession, putSession, createSession,
	    listArtifacts, getArtifact, putArtifact, deleteArtifact,
	    deleteSession: (id) => pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').delete(id)),
	    clearSessions: () => pReq(tx(CodeSmith.STORES.SESSIONS, 'readwrite').clear()),
	    clearArtifacts: () => pReq(tx(CodeSmith.STORES.ARTIFACTS, 'readwrite').clear()),
	  };
})();
CodeSmith.db = DB;

/* ============================================================================
 * 3. API — minimal chat completions client for connection testing.
 *    Day 3 replaces this with real streaming + routing.
 * ==========================================================================*/
const API = (() => {
  async function listModels({ apiUrl, apiKey }) {
    if (!apiUrl) throw new Error('API base URL is required');
    if (!apiKey) throw new Error('API key is required');
    const url = apiUrl.replace(/\/+$/, '') + '/models';
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 20000);
    try {
      const r = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        const clean = txt.slice(0, 240).replace(/Bearer\s+\S+/gi, 'Bearer ***');
        // Friendlier messages for the common NVIDIA-via-Worker failure modes
        if (r.status === 401) throw new Error('401 — API key rejected. Check that your nvapi-… key is pasted in full.');
        if (r.status === 403) throw new Error('403 — forbidden. Your tier may not allow /models listing, or the Worker is blocking this path.');
        if (r.status === 404) throw new Error('404 — /models not found. Your Worker may not forward this path; check the base URL.');
        if (r.status === 429) throw new Error('429 — rate limited. Wait a moment and try again.');
        throw new Error('HTTP ' + r.status + (clean ? ' — ' + clean : ''));
      }
      const j = await r.json();
      // OpenAI-compatible: { data: [{ id, ... }, ...] }
      const arr = Array.isArray(j?.data) ? j.data : (Array.isArray(j) ? j : []);
      const ids = arr
        .map(m => (typeof m === 'string' ? m : (m?.id || m?.name)))
        .filter(Boolean);
      // Dedup + stable alpha sort
      return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b));
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out after 20s.');
      if (err instanceof TypeError) throw new Error('Network error — CORS, offline, or Worker unreachable.');
      throw err;
    } finally {
      clearTimeout(to);
    }
  }

  async function testConnection({ apiUrl, apiKey, model }) {
    if (!apiUrl) throw new Error('API base URL is required');
    if (!apiKey) throw new Error('API key is required');
    if (!model)  throw new Error('Model is required');
    const url = apiUrl.replace(/\/+$/, '') + '/chat/completions';
    const body = {
      model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
      temperature: 0,
      stream: false,
    };
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 60000);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        const clean = txt.slice(0, 240).replace(/Bearer\s+\S+/gi, 'Bearer ***');
        if (r.status === 401) throw new Error('401 — API key rejected. Check your nvapi-… key.');
        if (r.status === 403) throw new Error('403 — forbidden. This model may not be available on your tier.');
        if (r.status === 404) throw new Error('404 — model not found on this endpoint. Try "Fetch models" to see what\'s available.');
        if (r.status === 429) throw new Error('429 — rate limited. Wait and retry.');
        throw new Error('HTTP ' + r.status + (clean ? ' — ' + clean : ''));
      }
      const j = await r.json();
      // Any well-formed response is success for Day 1.
      return { ok: true, model: j.model || model };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Request timed out after 60s.');
      if (err instanceof TypeError) throw new Error('Network error — CORS, offline, or Worker unreachable.');
      throw err;
    } finally {
      clearTimeout(to);
    }
  }
  return { testConnection, listModels };
})();
CodeSmith.api = API;

/* ============================================================================
 * 3b. PYODIDE SANDBOX — Day 2
 *     Lazy-loads Pyodide, runs Python in sandboxed namespaces, captures
 *     stdout/stderr/exceptions, manages a virtual FS at /workdir.
 *     All functions return Promises; expected errors yield ok=false results,
 *     never thrown exceptions.
 * ==========================================================================*/
const Sandbox = (() => {
  let _pyodide = null;
  let _loading = false;
  let _loadError = null;
  let _sessionGlobals = null;
  let _installedPackages = new Set();
  let _warmUpTime = null;

  const STDOUT_LIMIT = 100 * 1024; // 100KB
  const DEFAULT_TIMEOUT = 15000;

  // ---- helpers ----
  const $ = (sel) => document.querySelector(sel);

  function _updateStatus(state, text) {
    const dot = $('#st-pyodide-dot');
    const txt = $('#st-pyodide-text');
    if (!dot || !txt) return;
    dot.classList.remove('gray', 'green', 'red', 'amber');
    dot.classList.add(state);
    txt.textContent = text;
  }

  // ---- Pyodide script loader ----
	function _loadScript(url) {
	    return new Promise((resolve, reject) => {
	      if (typeof window.loadPyodide === 'function') { resolve(); return; }
	      const s = document.createElement('script');
	      s.src = url;
	      s.async = true;
	      s.onload = () => {
	        // v0.27+ exposes loadPyodide on globalThis after script load
	        if (typeof window.loadPyodide === 'function') { resolve(); return; }
	        // Fallback: try importing as module
	        import(url).then((mod) => {
	          window.loadPyodide = mod.loadPyodide;
	          resolve();
	        }).catch(reject);
	      };
	      s.onerror = () => reject(new Error('Failed to load Pyodide script from CDN'));
	      document.head.appendChild(s);
	    });
	  }

  // ---- core loader ----
	async function warmUp() {
	    if (_pyodide) return;
	    if (_loading) {
	      while (_loading) await new Promise(r => setTimeout(r, 100));
	      if (_pyodide) return;
	      if (_loadError) throw _loadError;
	      return;
	    }
	    _loading = true;
	    _loadError = null;
	    _updateStatus('amber', 'loading…');
	
	    try {
	      // Try module import first (v0.27+), fall back to script tag
	      if (typeof window.loadPyodide !== 'function') {
	        try {
	          const mod = await import('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.mjs');
	          window.loadPyodide = mod.loadPyodide;
	        } catch {
	          // Fall back to script tag for older CDN layout
	          await _loadScript('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js');
	        }
	      }
	
	      if (typeof window.loadPyodide !== 'function') {
	        throw new Error('loadPyodide not available after loading script');
	      }
	
	      _pyodide = await window.loadPyodide({
	        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
	      });
	
	      _pyodide.FS.mkdir('/workdir');
	      await _pyodide.loadPackage('micropip');
	      _pyodide.runPython('__session_globals__ = {}');
	      _sessionGlobals = _pyodide.globals.get('__session_globals__');
	
	      _warmUpTime = Date.now();
	      const pyVer = _pyodide.runPython('import sys; sys.version.split()[0]');
	      _updateStatus('green', 'Python ' + (pyVer || '3.12'));
	    } catch (err) {
	      _loadError = err;
	      _updateStatus('red', 'load failed');
	      throw err;
	    } finally {
	      _loading = false;
	    }
	  }

  async function ready() {
    return !!_pyodide;
  }

  // ---- code execution ----
  async function runPython(code, opts = {}) {
    if (typeof code !== 'string') throw new TypeError('runPython: code must be a string');

    // Ensure Pyodide is loaded
    try { if (!_pyodide) await warmUp(); } catch (err) {
      return {
        ok: false, stdout: '', stderr: '', result: null,
        error: { type: 'LoadError', message: err.message, traceback: '' },
        durationMs: 0, stdoutTruncated: false,
      };
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
    const useSession = !!opts.sessionGlobals;

    let stdoutBuf = '';
    let stderrBuf = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    // Use array buffers for O(1) append, join once at end
    const stdoutChunks = [];
    const stderrChunks = [];
    let stdoutLen = 0;
    let stderrLen = 0;
    // Capture stdout/stderr
    _pyodide.setStdout({
      batched: (text) => {
        if (stdoutLen >= STDOUT_LIMIT) return;
        stdoutChunks.push(text);
        stdoutLen += text.length + 1; // +1 for \n
        if (stdoutLen >= STDOUT_LIMIT) {
          stdoutChunks.push('[output truncated at 100KB]');
          stdoutTruncated = true;
        }
      }
    });
    _pyodide.setStderr({
      batched: (text) => {
        if (stderrLen >= STDOUT_LIMIT) return;
        stderrChunks.push(text);
        stderrLen += text.length + 1;
        if (stderrLen >= STDOUT_LIMIT) {
          stderrChunks.push('[output truncated at 100KB]');
          stderrTruncated = true;
        }
      }
    });

    const t0 = performance.now();

    // Build execution promise
    const execPromise = (async () => {
      try {
        let result;
        if (useSession) {
          // Run in persistent session namespace
          result = _pyodide.runPython(code, { globals: _sessionGlobals });
        } else {
          // Fresh namespace each time
          const ns = _pyodide.globals.get('dict')();
          try {
            result = _pyodide.runPython(code, { globals: ns });
          } finally {
            ns.destroy();
          }
        }

        // Convert result to JSON-safe
        let jsonResult = null;
        if (result !== undefined && result !== null) {
          try {
            if (result.toJs) {
              const jsVal = result.toJs({ dict_converter: Object.fromEntries });
              jsonResult = JSON.parse(JSON.stringify(jsVal));
            } else {
              jsonResult = JSON.parse(JSON.stringify(result));
            }
          } catch {
            jsonResult = String(result);
          }
          // Destroy proxy if applicable
          if (result.destroy) try { result.destroy(); } catch {}
        }

        return {
          ok: true, stdout: stdoutChunks.join('\n'), stderr: stderrChunks.join('\n'), result: jsonResult,
          error: null, durationMs: performance.now() - t0,
          stdoutTruncated,
        };
      } catch (pyErr) {
        // Extract Python exception info
        let errorType = 'Error';
        let errorMessage = '';
        let traceback = '';

        if (pyErr && pyErr.type) {
          errorType = pyErr.type;
          errorMessage = pyErr.message || String(pyErr);
          // Get clean traceback from Pyodide
          try {
            traceback = _pyodide.runPython(`
import traceback, sys
tb = ''.join(traceback.format_exception(sys.last_type, sys.last_value, sys.last_traceback))
tb
            `) || '';
          } catch {
            traceback = String(pyErr);
          }
        } else {
          errorType = (pyErr && pyErr.constructor && pyErr.constructor.name) || 'Error';
          errorMessage = (pyErr && pyErr.message) || String(pyErr);
          traceback = errorMessage;
        }

        return {
          ok: false, stdout: stdoutChunks.join('\n'), stderr: stderrChunks.join('\n'), result: null,
          error: { type: errorType, message: errorMessage, traceback },
          durationMs: performance.now() - t0,
          stdoutTruncated,
        };
      }
    })();

    // Timeout race
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        // Attempt clean stop
        try { _pyodide.runPython('raise KeyboardInterrupt'); } catch {}
        resolve({
          ok: false, stdout: stdoutChunks.join('\n'), stderr: stderrChunks.join('\n'), result: null,
          error: { type: 'TimeoutError', message: `Execution timed out after ${timeoutMs}ms`, traceback: '' },
          durationMs: timeoutMs,
          stdoutTruncated,
        });
      }, timeoutMs);
    });

    return Promise.race([execPromise, timeoutPromise]);
  }

  // ---- package installation ----
  async function installPackage(name) {
    if (typeof name !== 'string') throw new TypeError('installPackage: name must be a string');
    await warmUp();

    if (_installedPackages.has(name)) return; // already cached

    try {
      // Try pre-built first
      await _pyodide.loadPackage(name);
      _installedPackages.add(name);
      return;
    } catch {
      // Fall back to micropip
    }

    try {
      const micropip = _pyodide.pyimport('micropip');
      await micropip.install(name);
      _installedPackages.add(name);
    } catch (err) {
      throw new Error(
        `Package '${name}' is not available in Pyodide. Pure-Python packages and prebuilt WASM packages only.` +
        (err.message ? ' (' + err.message + ')' : '')
      );
    }
  }

  // ---- virtual filesystem ----
  async function listFiles(path = '/workdir') {
    await warmUp();
    try {
      return _pyodide.FS.readdir(path).filter(n => n !== '.' && n !== '..');
    } catch {
      return [];
    }
  }

  async function writeFile(path, content) {
    if (typeof path !== 'string') throw new TypeError('writeFile: path must be a string');
    await warmUp();
    _pyodide.FS.writeFile(path, content);
  }

  async function readFile(path) {
    if (typeof path !== 'string') throw new TypeError('readFile: path must be a string');
    await warmUp();
    return _pyodide.FS.readFile(path, { encoding: 'utf8' });
  }

  // ---- reset ----
  async function reset() {
    if (!_pyodide) return;
    // Wipe /workdir contents
    try {
      const files = _pyodide.FS.readdir('/workdir').filter(n => n !== '.' && n !== '..');
      for (const f of files) {
        try { _pyodide.FS.unlink('/workdir/' + f); } catch {
          try { _pyodide.FS.rmdir('/workdir/' + f); } catch {}
        }
      }
    } catch {}
    // Clear session globals
    try {
      _pyodide.runPython('__session_globals__.clear()');
    } catch {}
  }

  // ---- introspection (for debug panel) ----
  function getStats() {
    return {
      loaded: !!_pyodide,
      version: _pyodide ? (_pyodide.version || '?') : null,
      pythonVersion: _pyodide ? (function() {
        try { return _pyodide.runPython('import sys; sys.version'); } catch { return '?'; }
      })() : null,
      installedPackages: Array.from(_installedPackages),
      warmUpTime: _warmUpTime,
      uptimeMs: _warmUpTime ? Date.now() - _warmUpTime : 0,
    };
  }

  return { ready, warmUp, runPython, installPackage, reset, listFiles, writeFile, readFile, getStats };
})();
CodeSmith.sandbox = Sandbox;

  /* ============================================================================
 * 3c. LLM — OpenAI-compatible streaming chat client (Day 3)
 *     Pure module: no DOM access. Emits ChatEvents consumed by the UI layer.
 *     Handles SSE parsing, retries, rate limiting, token budget tracking.
 * ==========================================================================*/
const LLM = (() => {
  // ---- budget & call log --------------------------------------------------
  let _budget = { tokensIn: 0, tokensOut: 0, calls: 0 };
  const _recentCalls = [];          // ring buffer, max 20
  const MAX_RECENT = 20;

  // ---- rate limiter (token bucket per-model) ------------------------------
  const _buckets = {};  // { modelKey: { tokens, lastRefill, rpm, windowMs } }

  function _getBucket(model) {
    if (_buckets[model]) return _buckets[model];
    const rpm = _getSettings().rateLimitRpm || 40;
    _buckets[model] = { tokens: rpm, lastRefill: Date.now(), rpm, windowMs: 60000 };
    return _buckets[model];
  }

  function _refillBucket(b) {
    const now = Date.now();
    const elapsed = now - b.lastRefill;
    const refill = (elapsed / b.windowMs) * b.rpm;
    b.tokens = Math.min(b.rpm, b.tokens + refill);
    b.lastRefill = now;
  }

  async function _acquireToken(model, signal) {
    const b = _getBucket(model);
    _refillBucket(b);
    if (b.tokens >= 1) { b.tokens -= 1; return; }
    // Wait
    const waitMs = Math.ceil(((1 - b.tokens) / b.rpm) * b.windowMs);
    const capped = Math.min(waitMs, 30000);
    await new Promise((resolve, reject) => {
      const id = setTimeout(resolve, capped);
      if (signal) signal.addEventListener('abort', () => {
        clearTimeout(id); reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    });
    _refillBucket(b);
    b.tokens = Math.max(0, b.tokens - 1);
  }

  // ---- helpers ------------------------------------------------------------
  function _getSettings() {
    return CodeSmith.state.settings || CodeSmith.DEFAULTS;
  }
	function getMaxTokensForTier(tier) {
      const s = _getSettings();
      if (tier === 'orchestrator') return s.maxTokensOrchestrator || CodeSmith.DEFAULTS.maxTokensOrchestrator;
      if (tier === 'worker')       return s.maxTokensWorker || CodeSmith.DEFAULTS.maxTokensWorker;
      if (tier === 'fast')         return s.maxTokensFast || CodeSmith.DEFAULTS.maxTokensFast;
      return s.maxTokensOrchestrator || CodeSmith.DEFAULTS.maxTokensOrchestrator;
    }
	function getModelForTier(tier) {
	    const s = _getSettings();
	    // Check per-endpoint overrides
	    const endpoints = s.endpoints || [];
	    const ep = endpoints.find(e => e.forTier === tier && e.apiUrl && e.apiKey);
	    if (ep) return { model: ep.model || s.modelOrchestrator, apiUrl: ep.apiUrl, apiKey: ep.apiKey };
	
	    if (tier === 'orchestrator') return s.modelOrchestrator || CodeSmith.DEFAULTS.modelOrchestrator;
	    if (tier === 'worker')       return s.modelWorker || CodeSmith.DEFAULTS.modelWorker;
	    if (tier === 'fast')         return s.modelFast || CodeSmith.DEFAULTS.modelFast;
	    return s.modelOrchestrator || CodeSmith.DEFAULTS.modelOrchestrator;
	  }

  function tokenEstimate(text) {
    // ~4 chars per token, fast heuristic
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  function resetBudget() { _budget = { tokensIn: 0, tokensOut: 0, calls: 0 }; }
  function getBudget() { return { ..._budget }; }
  function getRecentCalls() { return _recentCalls.slice(); }

  function _logCall(entry) {
    // Strip auth from logged data
    _recentCalls.push({
      ts: Date.now(),
      model: entry.model || '?',
      tokensIn: entry.tokensIn || 0,
      tokensOut: entry.tokensOut || 0,
      status: entry.status || 'ok',
      durationMs: entry.durationMs || 0,
    });
    if (_recentCalls.length > MAX_RECENT) _recentCalls.shift();
  }

  // ---- SSE parser ---------------------------------------------------------
  function _isThinkingModel(model) {
    if (!model) return false;
    const m = model.toLowerCase();
    return m.includes('kimi') || m.includes('k2-thinking') ||
           m.includes('deepseek-r1') || m.includes('qwq');
  }

  // ---- core streaming chat ------------------------------------------------
  async function* chat(options) {
    const {
      messages, tier, model: explicitModel, temperature, maxTokens,
      responseFormat, timeoutMs = 180000, signal,
    } = options;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      yield { type: 'error', error: new Error('messages array is required'), recoverable: false };
      return;
    }

    const s = _getSettings();
    if (!s.apiKey) {
      yield { type: 'error', error: new Error('API key not configured — open Settings and add your key.'), recoverable: false };
      return;
    }

		let model, apiUrl, apiKey;
		    const tierResult = getModelForTier(tier || 'orchestrator');
		    if (typeof tierResult === 'object' && tierResult.apiUrl) {
		      model = explicitModel || tierResult.model;
		      apiUrl = tierResult.apiUrl.replace(/\/+$/, '');
		      apiKey = tierResult.apiKey;
		    } else {
		      model = explicitModel || tierResult;
		      apiUrl = (s.apiUrl || CodeSmith.DEFAULTS.apiUrl).replace(/\/+$/, '');
		      apiKey = s.apiKey;
		    }
		    const url = apiUrl + '/chat/completions';
		    const isThinking = _isThinkingModel(model);
			const totalCap = (_getSettings().tokenBudgetCap || 100000);
			const used = _budget.tokensIn + _budget.tokensOut;
			if (used >= totalCap) {
			yield { type: 'error', error: new Error('Token budget exhausted (' + used + '/' + totalCap + '). Raise it in Settings or click Reset budget.'), recoverable: false };
			return;
			}
			const tierCap = getMaxTokensForTier(tier || 'orchestrator');
			    const effectiveMaxTokens = maxTokens != null ? Math.min(maxTokens, tierCap) : tierCap;
			
			    const body = {
			      model,
			      messages,
			      stream: true,
			    };
			    if (temperature != null) body.temperature = temperature;
			    if (effectiveMaxTokens != null) body.max_tokens = effectiveMaxTokens;
			    if (responseFormat) body.response_format = responseFormat;

    // Rate limit
    try {
      await _acquireToken(model, signal);
    } catch (err) {
      if (err.name === 'AbortError') return; // clean abort
      yield { type: 'error', error: err, recoverable: false };
      return;
    }

    // Retry wrapper
    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal && signal.aborted) return;

      const controller = new AbortController();
      const combinedSignal = controller.signal;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Link external signal
      let onAbort;
      if (signal) {
        onAbort = () => controller.abort();
        signal.addEventListener('abort', onAbort, { once: true });
      }

      const t0 = performance.now();
      let response;

      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify(body),
          signal: combinedSignal,
        });
      } catch (err) {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onAbort);

        if (err.name === 'AbortError') {
          if (signal && signal.aborted) return; // user abort — silent
          yield { type: 'error', error: new Error('Request timed out after ' + (timeoutMs/1000) + 's'), recoverable: true };
          return;
        }
        // Network error: 1 retry
        if (attempt === 0) {
          lastError = err;
          await _sleep(1000);
          continue;
        }
        yield { type: 'error', error: new Error('Network error — check your connection and API URL. (' + (err.message || '') + ')'), recoverable: true };
        _logCall({ model, status: 'network_error', durationMs: performance.now() - t0 });
        return;
      }

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onAbort);

      // HTTP error handling
      if (!response.ok) {
        const status = response.status;
        const bodyText = await response.text().catch(() => '');
        const clean = bodyText.slice(0, 300).replace(/Bearer\s+\S+/gi, 'Bearer ***');

        // 429 — rate limit
        if (status === 429 && attempt < maxRetries) {
          const retryAfter = response.headers.get('Retry-After');
          const waitSec = retryAfter ? Math.min(parseInt(retryAfter, 10) || 2, 30) : Math.min(2 * Math.pow(2, attempt), 30);
          lastError = new Error('Rate limited (429). Retrying in ' + waitSec + 's…');
          yield { type: 'error', error: lastError, recoverable: true };
          await _sleep(waitSec * 1000);
          continue;
        }

        // 5xx — server error
        if (status >= 500 && attempt < maxRetries) {
          const waitSec = Math.min(2 * Math.pow(2, attempt), 30);
          lastError = new Error('Server error (' + status + '). Retrying in ' + waitSec + 's…');
          await _sleep(waitSec * 1000);
          continue;
        }

        // 4xx non-recoverable
        let msg = 'HTTP ' + status;
        if (status === 401) msg = 'API key rejected (401). Check Settings.';
        else if (status === 403) msg = 'Forbidden (403). Model may not be available on your tier.';
        else if (status === 404) msg = 'Model not found (404). Try Fetch Models in Settings.';
        else if (clean) msg += ' — ' + clean;

        _logCall({ model, status: 'http_' + status, durationMs: performance.now() - t0 });
        yield { type: 'error', error: new Error(msg), recoverable: status === 429 || status >= 500 };
        return;
      }

      // ---- Stream the response ----
      let fullText = '';
      let thinkingText = '';
      let usage = { promptTokens: 0, completionTokens: 0 };
      let inThinking = false;

      try {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Avoid repeated string splitting by tracking line boundaries
	          buffer += decoder.decode(value, { stream: true });
	          const lines = buffer.split('\n');
	          buffer = lines.pop() || '';
	          let lineStart = 0;
	          const len = buffer.length;

	          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue; // comment or empty
            if (!trimmed.startsWith('data:')) continue;

            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') continue;

            let parsed;
            try { parsed = JSON.parse(data); } catch { continue; }

            // Extract usage from final chunk if present
            if (parsed.usage) {
              usage.promptTokens = parsed.usage.prompt_tokens || 0;
              usage.completionTokens = parsed.usage.completion_tokens || 0;
            }

            const choices = parsed.choices;
            if (!choices || choices.length === 0) continue;
            const delta = choices[0].delta;
            if (!delta) continue;

            // Thinking / reasoning detection
            // Kimi-k2: delta.reasoning_content
            // DeepSeek-R1: delta.reasoning_content or role-based
            if (delta.reasoning_content) {
              thinkingText += delta.reasoning_content;
              yield { type: 'thinking', delta: delta.reasoning_content };
              continue;
            }

            // Content with <think> tags (some models)
            let content = delta.content;
            if (content == null) continue;

            if (isThinking) {
              // Handle inline <think>...</think> tags
              if (!inThinking && content.includes('<think>')) {
                const parts = content.split('<think>');
                if (parts[0]) {
                  fullText += parts[0];
                  yield { type: 'token', delta: parts[0] };
                }
                inThinking = true;
                const rest = parts.slice(1).join('<think>');
                if (rest) {
                  if (rest.includes('</think>')) {
                    const endParts = rest.split('</think>');
                    thinkingText += endParts[0];
                    yield { type: 'thinking', delta: endParts[0] };
                    inThinking = false;
                    const after = endParts.slice(1).join('</think>');
                    if (after) {
                      fullText += after;
                      yield { type: 'token', delta: after };
                    }
                  } else {
                    thinkingText += rest;
                    yield { type: 'thinking', delta: rest };
                  }
                }
                continue;
              }

              if (inThinking) {
                if (content.includes('</think>')) {
                  const endParts = content.split('</think>');
                  thinkingText += endParts[0];
                  yield { type: 'thinking', delta: endParts[0] };
                  inThinking = false;
                  const after = endParts.slice(1).join('</think>');
                  if (after) {
                    fullText += after;
                    yield { type: 'token', delta: after };
                  }
                } else {
                  thinkingText += content;
                  yield { type: 'thinking', delta: content };
                }
                continue;
              }
            }

            // Normal content
            fullText += content;
            yield { type: 'token', delta: content };
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          if (signal && signal.aborted) {
            // User-initiated stop — yield what we have
            if (fullText) {
              _budget.tokensIn += usage.promptTokens || tokenEstimate(messages.map(m => m.content).join(''));
              _budget.tokensOut += usage.completionTokens || tokenEstimate(fullText);
              _budget.calls++;
              _logCall({ model, tokensIn: usage.promptTokens, tokensOut: usage.completionTokens, status: 'stopped', durationMs: performance.now() - t0 });
            }
            yield { type: 'done', text: fullText, thinking: thinkingText, usage, stopped: true };
            return;
          }
          yield { type: 'error', error: new Error('Request timed out'), recoverable: true };
          _logCall({ model, status: 'timeout', durationMs: performance.now() - t0 });
          return;
        }
        // Mid-stream error
        yield { type: 'error', error: new Error('Stream interrupted: ' + (err.message || '')), recoverable: true };
        _logCall({ model, status: 'stream_error', durationMs: performance.now() - t0 });
        return;
      }

      // ---- Success ----
      // Estimate tokens if usage not provided by API
      if (!usage.promptTokens) usage.promptTokens = tokenEstimate(messages.map(m => m.content).join(''));
      if (!usage.completionTokens) usage.completionTokens = tokenEstimate(fullText);

      _budget.tokensIn += usage.promptTokens;
      _budget.tokensOut += usage.completionTokens;
      _budget.calls++;

      _logCall({ model, tokensIn: usage.promptTokens, tokensOut: usage.completionTokens, status: 'ok', durationMs: performance.now() - t0 });

      yield { type: 'done', text: fullText, thinking: thinkingText, usage, stopped: false };
      return; // success — no more retries
    }

    // Exhausted retries
    yield { type: 'error', error: lastError || new Error('Request failed after retries'), recoverable: false };
  }

  // ---- non-streaming convenience wrapper ----------------------------------
  async function chatComplete(options) {
    let text = '';
    let thinking = '';
    let usage = {};
    let error = null;

    for await (const ev of chat(options)) {
      if (ev.type === 'token') text += ev.delta;
      else if (ev.type === 'thinking') thinking += ev.delta;
      else if (ev.type === 'done') { text = ev.text; thinking = ev.thinking || ''; usage = ev.usage; }
      else if (ev.type === 'error') { error = ev.error; if (!ev.recoverable) break; }
    }

    if (error && !text) throw error;
    return { text, thinking, usage };
  }

  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

	return {
	    chat, chatComplete, tokenEstimate, getModelForTier, getMaxTokensForTier,
	    resetBudget, getBudget, getRecentCalls,
	  };
})();
CodeSmith.llm = LLM;
 
/* ============================================================================
 * 3d. BUILDER — single-block build loop (Day 4)
 *     Orchestrates: spec → worker → write FS → install → pytest → repair.
 *     Emits BuildEvents consumed by the UI. No DOM access.
 * ==========================================================================*/
const Builder = (() => {
  const REPAIR_MAX = 3;
  const ORCH_SYSTEM = `You are a software architect inside CodeSmith. Your task: analyze the user's request and produce a concrete Python module specification.

THINKING PROCESS (do not include in output):
1. Identify the core problem and desired outcome
2. Determine inputs, outputs, and key operations
3. Design public API with type hints
4. Consider edge cases and constraints

OUTPUT RULES:
- Output ONLY valid JSON
- No markdown fences, no explanation outside JSON
- Use double quotes for all strings
- No trailing commas

REQUIRED JSON SCHEMA:
{
  "module_name": "snake_case_name",
  "purpose": "one-line description",
  "public_functions": [
    {
      "name": "fn_name",
      "signature": "fn_name(arg1: type, arg2: type) -> return_type",
      "description": "what it does"
    }
  ],
  "dummy_inputs": [
    {"function": "fn_name", "args": {"arg1": "value"}}
  ],
  "acceptance_criteria": ["criterion 1", "criterion 2"],
  "assumptions": ["assumption 1"]
}

RULES:
- module_name must be a valid Python identifier
- If the request is ambiguous, make reasonable assumptions and list them
- Include at least one acceptance criterion per public function
- dummy_inputs must be valid inputs that would pass type checking`;

  const WORKER_SYSTEM = `You are a senior Python engineer implementing a Python module from a specification.

YOUR TASK:
1. Read the module spec carefully
2. Implement the module with clean, correct Python code
3. Write comprehensive pytest tests

IMPLEMENTATION RULES:
- PEP 8 compliant, type hints on all public functions
- Use only stdlib unless extra packages are genuinely needed
- Handle edge cases explicitly (empty inputs, None, invalid values)
- Do not catch exceptions you cannot handle meaningfully
- Include docstrings for all public functions

TEST RULES:
- Self-contained: runnable with \`pytest test_<module_name>.py\`
- At least one test per acceptance criterion
- Test happy path, edge cases, and error cases
- Use descriptive test names: \`test_<function>_<scenario>\`

OUTPUT RULES:
- Output ONLY valid JSON
- No markdown fences, no explanation outside JSON
- Use double quotes for all strings
- No trailing commas

REQUIRED JSON SCHEMA:
{
  "module_name": "name",
  "code": "full python source",
  "tests": "full pytest source",
  "imports_needed": ["pkg1"],
  "notes": "any notes"
}`;

  const REPAIR_ADDENDUM = `The previous attempt failed. Analyze the failure carefully before fixing.

FAILURE OUTPUT:
<pytest_output>
{PYTEST_OUTPUT}
</pytest_output>

DIAGNOSIS STEPS:
1. Is this a syntax error, logic bug, or test issue?
2. Does the implementation match the spec's signatures?
3. Are edge cases handled correctly?
4. Is the test itself correct?

REPAIR RULES:
- Fix ONLY the failing behavior
- Do NOT change public function signatures
- If a test is wrong, note it in "notes" and provide a corrected test
- Prefer minimal changes over rewrites

Return the same JSON schema.`;

  // ---- build pipeline as async generator ----------------------------------
  async function* buildBlock(userPrompt) {
    if (!userPrompt || !userPrompt.trim()) {
      yield { type: 'error', stage: 'init', error: new Error('Empty prompt') };
      return;
    }

    // ---- Stage A: Orchestrator → Spec ----
    yield { type: 'spec_start' };
    let spec;
    try {
      const specResult = await CodeSmith.llm.chatComplete({
        messages: [
          { role: 'system', content: ORCH_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        tier: 'orchestrator',
        temperature: 0.3,
        maxTokens: 20000,
      });
      spec = _parseJSON(specResult.text);
      if (!spec || !spec.module_name) {
        throw new Error('Spec JSON missing module_name. Raw:\n' + (specResult.text || '').slice(0, 500));
      }
    } catch (err) {
      yield { type: 'error', stage: 'spec', error: err };
      return;
    }
    yield { type: 'spec', spec };

    // ---- Stage B: Worker → Code + Tests ----
    let workerResult = null;
    let attempt = 0;
    let lastPytestOutput = '';

    while (attempt <= REPAIR_MAX) {
      attempt++;
      const isRepair = attempt > 1;

      if (isRepair) {
        yield { type: 'repair_start', attempt };
      } else {
        yield { type: 'worker_start' };
      }

      let workerMessages;
      if (isRepair) {
        const repairMsg = REPAIR_ADDENDUM.replace('{PYTEST_OUTPUT}', lastPytestOutput);
        workerMessages = [
          { role: 'system', content: WORKER_SYSTEM },
          { role: 'user', content: 'Module spec:\n' + JSON.stringify(spec, null, 2) },
          { role: 'assistant', content: JSON.stringify(workerResult) },
          { role: 'user', content: repairMsg },
        ];
      } else {
        workerMessages = [
          { role: 'system', content: WORKER_SYSTEM },
          { role: 'user', content: 'Module spec:\n' + JSON.stringify(spec, null, 2) },
        ];
      }

      // Stream the worker call
      let workerText = '';
      let workerError = null;
      try {
        for await (const ev of CodeSmith.llm.chat({
          messages: workerMessages,
          tier: 'worker',
          temperature: 0.2,
          maxTokens: 8000,
        })) {
          if (ev.type === 'token') {
            workerText += ev.delta;
            yield { type: 'worker_stream', delta: ev.delta };
          } else if (ev.type === 'done') {
            workerText = ev.text || workerText;
          } else if (ev.type === 'error' && !ev.recoverable) {
            workerError = ev.error;
          }
        }
      } catch (err) {
        workerError = err;
      }

      if (workerError) {
        yield { type: 'error', stage: isRepair ? 'repair' : 'worker', error: workerError };
        return;
      }

      try {
        workerResult = _parseJSON(workerText);
        if (!workerResult || !workerResult.code) {
          throw new Error('Worker JSON missing code field. Raw:\n' + workerText.slice(0, 500));
        }
      } catch (err) {
        yield { type: 'error', stage: 'worker_parse', error: err };
        return;
      }

      yield { type: 'worker_done', result: workerResult, attempt };

      // ---- Stage C: Write to FS ----
      const modName = workerResult.module_name || spec.module_name;
      try {
        await CodeSmith.sandbox.warmUp();
        await CodeSmith.sandbox.writeFile('/workdir/' + modName + '.py', workerResult.code);
        if (workerResult.tests) {
          await CodeSmith.sandbox.writeFile('/workdir/test_' + modName + '.py', workerResult.tests);
        }
      } catch (err) {
        yield { type: 'error', stage: 'write_fs', error: err };
        return;
      }

      // ---- Stage D: Install packages ----
      const imports = workerResult.imports_needed || [];
      for (const pkg of imports) {
        yield { type: 'install_package', name: pkg };
        try {
          await CodeSmith.sandbox.installPackage(pkg);
        } catch (err) {
          yield { type: 'error', stage: 'install', error: err };
          return;
        }
      }

      // ---- Stage E: Run pytest ----
      yield { type: 'tests_start', attempt };
      let testResult;
      try {
        // Install pytest if needed
        try { await CodeSmith.sandbox.installPackage('pytest'); } catch {}

        const pytestCode = `
import sys, os
sys.path.insert(0, '/workdir')
os.chdir('/workdir')
import pytest
exit_code = pytest.main(['-v', '/workdir/test_${modName}.py', '--tb=short', '--no-header'])
print('\\n__EXIT_CODE__=' + str(exit_code))
`;
        testResult = await CodeSmith.sandbox.runPython(pytestCode, {
          sessionGlobals: true,
          timeoutMs: 30000,
        });
      } catch (err) {
        yield { type: 'error', stage: 'tests_run', error: err };
        return;
      }

      const pytestOutput = (testResult.stdout || '') + (testResult.stderr || '');
      const parsed = _parsePytestOutput(pytestOutput);

      yield {
        type: 'tests_done',
        attempt,
        passed: parsed.allPassed,
        passCount: parsed.passCount,
        failCount: parsed.failCount,
        output: pytestOutput,
        errorOutput: testResult.error ? testResult.error.traceback : '',
      };

      // ---- Stage F: Check pass/fail ----
      if (parsed.allPassed && parsed.passCount > 0) {
        yield { type: 'success', attempt, moduleName: modName, spec, workerResult };
        return;
      }

      lastPytestOutput = pytestOutput.slice(-3000); // trim for context window
      if (attempt > REPAIR_MAX) {
        yield { type: 'escalated', attempt, moduleName: modName, spec, workerResult, lastOutput: pytestOutput };
        return;
      }
    }
  }

  // ---- helpers ----
  function _parseJSON(text) {
    if (!text) throw new Error('Empty response from model');
    // Strip markdown fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    // Try direct parse
    try { return JSON.parse(cleaned); } catch {}
    // Try extracting first { ... } block
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
    }
    // Log truncated JSON attempts for debugging
    console.warn('[parseJSON] All parse attempts failed. Input length:', text.length, 'First 200 chars:', text.slice(0, 200));
	throw new Error('Failed to parse JSON from model response');
  }

  function _parsePytestOutput(output) {
    let passCount = 0;
    let failCount = 0;
    let allPassed = false;

    // Match "X passed" / "X failed" from pytest summary
    const passMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const errorMatch = output.match(/(\d+)\s+error/);

    if (passMatch) passCount = parseInt(passMatch[1], 10);
    if (failMatch) failCount = parseInt(failMatch[1], 10);
    if (errorMatch) failCount += parseInt(errorMatch[1], 10);

    allPassed = failCount === 0 && passCount > 0;
    return { passCount, failCount, allPassed };
  }

  return { buildBlock };
})();
CodeSmith.builder = Builder; 
 
/* ============================================================================
 * 4. SPEC SCHEMA + STAGE A — Requirements Dialogue (Day 5)
 *    Pure module. Manages conversational requirements gathering via the
 *    orchestrator, parsing <spec_update> and <ready_for_skeleton> tags.
 * ==========================================================================*/

/**
 * @typedef {Object} CodeSmithSpec
 * @property {string} goal
 * @property {{ format: string, example: string, size_estimate: string }} inputs
 * @property {{ format: string, example: string }} outputs
 * @property {string[]} core_operations
 * @property {{ libraries_allowed: string, performance: string }} constraints
 * @property {string[]} non_goals
 * @property {string[]} acceptance_criteria
 */
		const EMPTY_SPEC = Object.freeze({
		  goal: '',
		  inputs:  { format: '', example: '', size_estimate: '' },
		  outputs: { format: '', example: '' },
		  core_operations: [],
		  constraints: { libraries_allowed: '', performance: '' },
		  non_goals: [],
		  acceptance_criteria: [],
		  // Extensible fields — _mergeSpec adds any unknown keys here
		});

			const STAGE_A_SYSTEM = `You are a senior software architect conducting a requirements interview. Your goal: efficiently gather enough information to build a correct implementation.

INTERVIEW STRATEGY:
1. First, determine target_type from context (python/webapp/cli/api/notebook)
2. Fill obvious fields aggressively from context
3. Ask ONE focused question about the most important missing information
4. After each answer, update the spec with <spec_update> JSON

TARGET_TYPE BEHAVIOR:
- "python": library with public functions, type hints
- "webapp": single-page HTML/JS, no backend, browser-only
- "cli": Python with argparse, runnable as \`python tool.py [args]\`
- "api": FastAPI with routes, runnable with \`uvicorn main:app\`
- "notebook": Jupyter .ipynb (markdown + code cells)

OUTPUT FORMAT:
After your question, include:
<spec_update>
{"field_name": "value", "another_field": ["value1", "value2"]}
</spec_update>

When ready to proceed:
<ready_for_skeleton>
{"rationale": "specific reason why we have enough info"}
</ready_for_skeleton>

RULES:
- Keep questions under 25 words
- Prefer "give me an example" over abstract questions
- Maximum 5 questions total, then proceed with best guesses
- No implementation details in questions
- All JSON must use double quotes, Superior models need explicit structure</spec_update>

Current spec:
{spec_json}`;

const StageA = (() => {
  let _spec = null;
  let _messages = [];     // Stage A conversation history (separate from main chat)
  let _assumptions = {};  // field paths marked "(assumed)"
  let _ready = false;

  function start(initialPrompt) {
    _spec = JSON.parse(JSON.stringify(EMPTY_SPEC));
    _messages = [];
    _assumptions = {};
    _ready = false;
    // Seed goal from user's initial request
    if (initialPrompt) _spec.goal = initialPrompt;
  }

  function getSpec() { return JSON.parse(JSON.stringify(_spec || EMPTY_SPEC)); }
  function getMessages() { return _messages.slice(); }
  function isReady() { return _ready; }
  function getAssumptions() { return { ..._assumptions }; }

  function setSpec(newSpec) {
    _spec = JSON.parse(JSON.stringify(newSpec));
  }

		async function* userTurn(userText) {
		    _messages.push({ role: 'user', content: userText });
		    yield { type: 'user_sent' };
		
		    const systemContent = STAGE_A_SYSTEM.replace('{spec_json}', JSON.stringify(_spec, null, 2));
		    const apiMessages = [
		      { role: 'system', content: systemContent },
		      ..._messages,
		    ];
		
		    for (let tryCount = 0; tryCount < 2; tryCount++) {
		      let fullText = '';
		      let thinkingText = '';
		      let errorHit = null;
		
		      try {
		        for await (const ev of CodeSmith.llm.chat({
		          messages: apiMessages,
		          tier: 'orchestrator',
		          temperature: 0.2,
		          maxTokens: 8000,
		        })) {
		          if (ev.type === 'thinking') {
		            thinkingText += ev.delta;
		            yield { type: 'thinking_delta', delta: ev.delta };
		          } else if (ev.type === 'token') {
		            fullText += ev.delta;
		            yield { type: 'token_delta', delta: ev.delta };
		          } else if (ev.type === 'done') {
		            fullText = ev.text || fullText;
		            thinkingText = ev.thinking || thinkingText;
		          } else if (ev.type === 'error' && !ev.recoverable) {
		            errorHit = ev.error;
		          }
		        }
		      } catch (err) { errorHit = err; }
		
		      if (errorHit) { yield { type: 'error', error: errorHit }; return; }
		
		      // Parse the completed response
			const specUpdateMatch = fullText.match(/<spec_update>\s*([\s\S]*?)\s*<\/spec_update>/i);
			const readyMatch = fullText.match(/<ready_for_skeleton>\s*([\s\S]*?)\s*<\/ready_for_skeleton>/i);
			const question = fullText
					        .replace(/<spec_update>[\s\S]*?<\/spec_update>/g, '')
					        .replace(/<ready_for_skeleton>[\s\S]*?<\/ready_for_skeleton>/g, '')
					        .replace(/```json[\s\S]*?```/g, '')
					        .trim();
		
		      if (!question && !readyMatch && !specUpdateMatch && tryCount === 0) {
		        _messages.push({ role: 'assistant', content: fullText });
		        _messages.push({
		          role: 'user',
		          content: 'Your response was malformed. Please ask ONE question and include a <spec_update> JSON block or <ready_for_skeleton>.',
		        });
		        continue;
		      }

					if (specUpdateMatch) {
			        try {
			          let raw = specUpdateMatch[1].trim();
			          raw = raw.replace(/^```(?:json)?\s*\n?/g, '').replace(/\n?```\s*$/g, '');
			          // Try direct parse first
			          let update = null;
			          try { update = JSON.parse(raw); } catch {}
			          // If failed, find outermost braces
			          if (!update) {
			            let depth = 0, jStart = -1, jEnd = -1, inStr = false, esc = false;
			            for (let ci = 0; ci < raw.length; ci++) {
			              const ch = raw[ci];
			              if (esc) { esc = false; continue; }
			              if (ch === '\\') { esc = true; continue; }
			              if (ch === '"') { inStr = !inStr; continue; }
			              if (inStr) continue;
			              if (ch === '{') { if (depth === 0) jStart = ci; depth++; }
			              else if (ch === '}') { depth--; if (depth === 0 && jStart >= 0) { jEnd = ci; break; } }
			            }
			            if (jStart >= 0 && jEnd > jStart) {
			              let jsonStr = raw.slice(jStart, jEnd + 1);
			              jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
			              try { update = JSON.parse(jsonStr); } catch {
			                jsonStr = jsonStr.replace(/[\x00-\x1f]/g, ' ');
			                try { update = JSON.parse(jsonStr); } catch(e2) {
			                  console.error('[StageA] spec_update parse failed:', e2.message);
			                }
			              }
			            }
			          }
			          if (update && typeof update === 'object' && !Array.isArray(update)) {
			            _mergeSpec(update);
			            console.log('[StageA] Spec merged, fields:', Object.keys(update).join(', '));
			            yield { type: 'spec_updated', spec: getSpec() };
			          } else {
			            console.warn('[StageA] spec_update: no valid object found. Raw:', raw.slice(0, 200));
			            yield { type: 'spec_updated', spec: getSpec() };
			          }
			        } catch (parseErr) {
					console.warn("Spec update parse failed:", parseErr);
					if (tryCount === 0) {
					_messages.push({ role: 'user', content: 'Please re-send the <spec_update> with valid JSON only. Do not add extra text outside the tags.' });
					continue;
					}
					yield { type: 'parse_error', error: parseErr };
					}
				}
		
					// Fallback: if no spec_update tag found, look for any JSON object in response
					if (!specUpdateMatch) {
						const jsonBlockMatch = fullText.match(/\{[\s\S]{50,}\}/);
						if (jsonBlockMatch) {
						try {
							let fallbackJson = jsonBlockMatch[0].replace(/,\s*([}\]])/g, '$1');
							const parsed = JSON.parse(fallbackJson);
						            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed.goal || parsed.inputs || parsed.outputs || parsed.internal_heat_gains)) {
						              _mergeSpec(parsed);
							console.log('[StageA] Spec merged from fallback JSON, fields:', Object.keys(parsed).join(', '));
							yield { type: 'spec_updated', spec: getSpec() };
							}
						} catch {}
						}
					}
					
		      _messages.push({ role: 'assistant', content: fullText });
		
		      if (question) {
		        // Clean up: remove any remaining XML-like tags the model might output
		        const cleanQuestion = question
		          .replace(/<[^>]+>/g, '')
		          .replace(/\n{3,}/g, '\n\n')
		          .trim();
		        if (cleanQuestion) yield { type: 'question_final', text: cleanQuestion };
		      }
		
		      if (readyMatch) {
		        _ready = true;
		        let rationale = '';
		        try { rationale = (JSON.parse(readyMatch[1]).rationale) || ''; } catch {}
		        yield { type: 'ready', rationale };
		      }
		      return;
		    }
		
		    yield { type: 'error', error: new Error('Failed to get valid response after retry') };
		}

  function requestAdvance() {
    _ready = true;
  }

			function _mergeSpec(update) {
			    if (!update || typeof update !== 'object' || Array.isArray(update)) return;
			    if (!_spec) _spec = JSON.parse(JSON.stringify(EMPTY_SPEC));
			    for (const key of Object.keys(update)) {
		      const val = update[key];
		      if (val === null || val === undefined) continue;
		
		      if (key in _spec) {
		        // Known field — merge normally
		        if (typeof val === 'string') {
		          const isAssumed = val.includes('(assumed)');
		          _spec[key] = val.replace(/\s*\(assumed\)\s*/g, '').trim();
		          if (isAssumed) _assumptions[key] = true;
		          else delete _assumptions[key];
		        } else if (Array.isArray(val)) {
		          _spec[key] = val.map(v => {
		            if (typeof v === 'string') {
		              const isa = v.includes('(assumed)');
		              const clean = v.replace(/\s*\(assumed\)\s*/g, '').trim();
		              if (isa) _assumptions[key + '.' + clean] = true;
		              return clean;
		            }
		            return v;
		          });
		        } else if (typeof val === 'object') {
		          if (typeof _spec[key] === 'object' && !Array.isArray(_spec[key])) {
		            for (const subKey of Object.keys(val)) {
		              if (subKey in _spec[key]) {
		                const sv = val[subKey];
		                if (typeof sv === 'string') {
		                  const isa = sv.includes('(assumed)');
		                  _spec[key][subKey] = sv.replace(/\s*\(assumed\)\s*/g, '').trim();
		                  if (isa) _assumptions[key + '.' + subKey] = true;
		                  else delete _assumptions[key + '.' + subKey];
		                } else {
		                  _spec[key][subKey] = sv;
		                }
		              } else {
		                // Accept unknown subfields
		                _spec[key][subKey] = val[subKey];
		              }
		            }
		          } else {
		            // Overwrite with object
		            _spec[key] = val;
		          }
		        }
				} else {
				        // Unknown top-level field — store it anyway
				        if (val !== null && val !== undefined) _spec[key] = val;
				      }
		    }
		  }
		function reset() {
			_spec = null;
			_messages = [];
			_assumptions = {};
			_ready = false;
		}

		return { start, reset, getSpec, setSpec, getMessages, isReady, getAssumptions, userTurn, requestAdvance };
})();
CodeSmith.stageA = StageA;
 
 /* ============================================================================
 * 5. STAGE B — Skeleton Visualization (Day 5)
 *    Generates modular architecture from approved spec, validates
 *    topology, produces Mermaid flowchart definition.
 * ==========================================================================*/


			const STAGE_B_SYSTEM = `You are a senior software architect. Design a modular Python architecture.

DESIGN PRINCIPLES:
- Prefer 2-5 modules (simpler is better)
- Each module has a single, clear responsibility
- Dependencies form a DAG (no cycles)
- Use type hints on all public function signatures

OUTPUT RULES:
- Return ONLY valid JSON
- No markdown fences, no explanation
- Use double quotes for all strings
- No trailing commas

REQUIRED JSON SCHEMA:
{
  "summary": "one-line description",
  "modules": [
    {
      "id": "snake_case",
      "name": "snake_case",
      "purpose": "what this module does",
      "public_functions": [
        {
          "name": "fn_name",
          "signature": "fn_name(arg1: type, arg2: type) -> return_type",
          "description": "what it does",
          "raises": ["ExceptionName"]
        }
      ],
      "depends_on": ["other_module_id"],
      "notes": "any notes"
    }
  ],
  "shared_types": {"TypeName": "definition"},
  "data_flow": [{"from": "id", "to": "id", "data": "description"}],
  "build_order": ["id1", "id2"]
}

Specification:
{spec_json}`;

			const STAGE_B_WEBAPP = `You are a senior frontend architect. Design a modular HTML/JavaScript web app.

DESIGN PRINCIPLES:
- Keep it simple: 3-6 files typical
- No build step (no JSX, no TypeScript, no bundler)
- Use traditional script tags, no ES modules
- Each JS module registers on window.App namespace

OUTPUT RULES:
- Return ONLY valid JSON
- No markdown fences, no explanation
- Use double quotes for all strings
- No trailing commas

REQUIRED JSON SCHEMA:
{
  "summary": "one-line description",
  "modules": [
    {
      "id": "snake_case_id",
      "name": "actual_filename.ext",
      "kind": "html|js|css",
      "purpose": "what this file does",
      "public_api": [
        {
          "name": "functionOrSelector",
          "signature": "description",
          "description": "what it does"
        }
      ],
      "depends_on": ["other_module_id"],
      "notes": "any notes"
    }
  ],
  "entry_point": "index.html",
  "cdn_libraries": [{"name": "library_name", "url": "https://cdn.example/path.js"}],
  "shared_state": {"key": "description"},
  "data_flow": [{"from": "id", "to": "id", "data": "event/state name"}],
  "build_order": ["id1", "id2"]
}

RULES:
- name field is the actual filename (e.g. "index.html", "app.js", "styles.css")
- entry_point must be "index.html"
- build_order: CSS first, then JS dependencies, then HTML last

Specification:
{spec_json}`;

const StageB = (() => {
  let _skeleton = null;
  let _approvedSpec = null;
  let _mermaidDef = '';

async function generate(spec, onStream) {
	_approvedSpec = JSON.parse(JSON.stringify(spec));
    _skeleton = null;
    _mermaidDef = '';

    const isWebapp = spec.target_type === 'webapp';
    const promptTemplate = isWebapp ? STAGE_B_WEBAPP : STAGE_B_SYSTEM;
    const systemContent = promptTemplate.replace('{spec_json}', JSON.stringify(spec, null, 2));
    let fullText = '';

    // Stream so UI can show progress
    for await (const ev of CodeSmith.llm.chat({
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: 'Design the architecture.' },
      ],
      tier: 'orchestrator',
      temperature: 0.2,
      maxTokens: 8000,
    })) {
      if (ev.type === 'token') {
        fullText += ev.delta;
        if (onStream) onStream(fullText);
      } else if (ev.type === 'done') {
        fullText = ev.text || fullText;
      } else if (ev.type === 'error' && !ev.recoverable) {
        throw ev.error || new Error('Skeleton generation failed');
      }
    }

    // Robust JSON extraction
    let parsed = _extractJSON(fullText);
    if (!parsed || !parsed.modules || !Array.isArray(parsed.modules)) {
      throw new Error('Skeleton JSON missing modules array.\n\nRaw response (first 800 chars):\n' + fullText.slice(0, 800));
    }

    _skeleton = parsed;
    _mermaidDef = _buildMermaid(parsed);
    return parsed;
  }

	function _extractJSON(text) {
	    if (!text) return null;
	    let cleaned = text.trim();
	
	    // Strip markdown fences
	    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/g, '').replace(/\n?```\s*$/g, '');
	
	    // Try direct parse
	    try { return JSON.parse(cleaned); } catch {}
	
	    // Find the first { and track braces to find matching }
	    let depth = 0, start = -1, end = -1;
	    for (let i = 0; i < cleaned.length; i++) {
	      if (cleaned[i] === '{') { if (depth === 0) start = i; depth++; }
	      else if (cleaned[i] === '}') {
	        depth--;
	        if (depth === 0 && start >= 0) { end = i; break; }
	      }
	    }
	
	    if (start >= 0 && end > start) {
	      try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
	      // Fix trailing commas
	      let attempt = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
	      try { return JSON.parse(attempt); } catch {}
	    }
	
	    // If truncated (no matching close), try to repair
	    if (start >= 0 && end === -1) {
	      let truncated = cleaned.slice(start);
	      // Close any open strings, arrays, objects
	      // Count unclosed braces/brackets
	      let ob = 0, os = 0;
	      let inStr = false, escape = false;
	      for (const ch of truncated) {
	        if (escape) { escape = false; continue; }
	        if (ch === '\\') { escape = true; continue; }
	        if (ch === '"') { inStr = !inStr; continue; }
	        if (inStr) continue;
	        if (ch === '{') ob++;
	        else if (ch === '}') ob--;
	        else if (ch === '[') os++;
	        else if (ch === ']') os--;
	      }
	      // Close open string if needed
	      if (inStr) truncated += '"';
	      // Remove trailing comma or partial value
	      truncated = truncated.replace(/,\s*"[^"]*$/, '');
	      truncated = truncated.replace(/,\s*$/, '');
	      // Close open brackets and braces
	      for (let i = 0; i < os; i++) truncated += ']';
	      for (let i = 0; i < ob; i++) truncated += '}';
	      truncated = truncated.replace(/,\s*([}\]])/g, '$1');
	      try { return JSON.parse(truncated); } catch {}
	    }
	
	    return null;
	  }
		
  function getSkeleton() { return _skeleton ? JSON.parse(JSON.stringify(_skeleton)) : null; }
  function getApprovedSpec() { return _approvedSpec ? JSON.parse(JSON.stringify(_approvedSpec)) : null; }
  function getMermaidDef() { return _mermaidDef; }

  function approve() {
    // Returns the skeleton for the builder to consume
    return getSkeleton();
  }

  function _buildMermaid(skel) {
    const lines = ['flowchart TD'];

    for (const mod of skel.modules) {
      const fnNames = (mod.public_functions || []).map(f => f.name).join('\\n');
      const label = mod.name + (fnNames ? '\\n---\\n' + fnNames : '');
      lines.push(`  subgraph ${mod.id} ["${mod.name}"]`);
      lines.push(`    direction TB`);
      if (mod.public_functions) {
        for (const fn of mod.public_functions) {
          const nodeId = mod.id + '_' + fn.name;
          lines.push(`    ${nodeId}["${fn.name}"]`);
        }
      }
      lines.push(`  end`);
    }

    // Data flow edges
    if (skel.data_flow) {
      for (const df of skel.data_flow) {
        const label = df.data || '';
        lines.push(`  ${df.from} -- "${label}" --> ${df.to}`);
      }
    }

    // Style
    lines.push('');
    lines.push('  classDef default fill:#1a1f2a,stroke:#4f8cff,stroke-width:1px,color:#e8ecf1');

    return lines.join('\n');
  }
		function setSkeleton(skel, spec, mermaidDef) {
			_skeleton = skel ? JSON.parse(JSON.stringify(skel)) : null;
			_approvedSpec = spec ? JSON.parse(JSON.stringify(spec)) : null;
			_mermaidDef = (mermaidDef && mermaidDef.length > 0) ? mermaidDef : (skel ? _buildMermaid(skel) : '');
			}

		return { generate, getSkeleton, getApprovedSpec, getMermaidDef, approve, setSkeleton };
})();
CodeSmith.stageB = StageB;


/* ============================================================================
 * 5b. SYMBOL TABLE — orchestrator-owned shared symbol registry (Day 6)
 *     Tracks types, functions, constants, exceptions across modules.
 *     apply() validates and emits diff events.
 * ==========================================================================*/
const SymbolTable = (() => {
  let _table = { version: 1, types: {}, functions: {}, constants: {}, exceptions: {} };
  let _listeners = [];

  function get() { return JSON.parse(JSON.stringify(_table)); }

  function initFromSkeleton(skeleton) {
    _table = { version: 1, types: {}, functions: {}, constants: {}, exceptions: {} };

    // shared_types → types
    if (skeleton.shared_types) {
      for (const [name, def] of Object.entries(skeleton.shared_types)) {
        _table.types[name] = {
          definition: typeof def === 'string' ? def : JSON.stringify(def),
          origin_module: '_shared',
          description: '',
        };
        _emit({ op: 'add', section: 'types', name, value: _table.types[name] });
      }
    }

    // modules → functions + exceptions
    for (const mod of (skeleton.modules || [])) {
      const apiList = mod.public_functions || mod.public_api || [];
      for (const fn of apiList) {
        _table.functions[mod.id + '.' + fn.name] = {
          signature: fn.signature || fn.name,
          module: mod.id,
          status: 'declared',
          description: fn.description || '',
          kind: mod.kind || 'python',
        };
        _emit({ op: 'add', section: 'functions', name: mod.id + '.' + fn.name });
        for (const exc of (fn.raises || [])) {
          if (!_table.exceptions[exc]) {
            _table.exceptions[exc] = { module: mod.id, description: 'from ' + fn.name };
            _emit({ op: 'add', section: 'exceptions', name: exc });
          }
        }
      }
    }
  }

  function apply(operation) {
    // operation: { op: 'add'|'update'|'remove', section, name, value?, field?, fieldValue? }
    const { op, section, name } = operation;
    if (!_table[section]) return { ok: false, error: 'Unknown section: ' + section };

    if (op === 'add') {
      _table[section][name] = operation.value || {};
      _emit(operation);
      return { ok: true };
    }
    if (op === 'update') {
      if (!_table[section][name]) return { ok: false, error: name + ' not found in ' + section };
      if (operation.field) {
        _table[section][name][operation.field] = operation.fieldValue;
      } else if (operation.value) {
        Object.assign(_table[section][name], operation.value);
      }
      _emit(operation);
      return { ok: true };
    }
    if (op === 'remove') {
      if (!_table[section][name]) return { ok: false, error: name + ' not found' };
      delete _table[section][name];
      _emit(operation);
      return { ok: true };
    }
    return { ok: false, error: 'Unknown op: ' + op };
  }

  function markImplemented(moduleId) {
    for (const [name, fn] of Object.entries(_table.functions)) {
      if (fn.module === moduleId && fn.status === 'declared') {
        fn.status = 'implemented';
        _emit({ op: 'update', section: 'functions', name, field: 'status', fieldValue: 'implemented' });
      }
    }
  }

  function getDependencyCode(moduleId, skeleton, artifacts) {
    // Collect source code of implemented dependencies
    const mod = (skeleton.modules || []).find(m => m.id === moduleId);
    if (!mod) return '';
    const deps = mod.depends_on || [];
    const parts = [];
    for (const depId of deps) {
      const art = artifacts.find(a => a.moduleName === depId && a.status === 'passed');
      if (art && art.code) {
        parts.push('# IMPLEMENTED — do not modify\n# Module: ' + depId + '\n' + art.code);
      }
    }
    return parts.join('\n\n');
  }

  function onDiff(listener) { _listeners.push(listener); }
  function offDiff(listener) { _listeners = _listeners.filter(l => l !== listener); }
  function _emit(diff) { for (const l of _listeners) try { l(diff); } catch {} }

  function reset() {
    _table = { version: 1, types: {}, functions: {}, constants: {}, exceptions: {} };
    _listeners = [];
  }

  return { get, initFromSkeleton, apply, markImplemented, getDependencyCode, onDiff, offDiff, reset };
})();

/* ============================================================================
 * 5c. STAGE C — multi-module build engine (Day 6)
 *     Walks build_order, sends work orders to worker, manages repair
 *     loops, symbol negotiation, integration tests.
 * ==========================================================================*/
	const STAGE_C_WEBAPP_WORKER_SYSTEM = `You implement ONE file in an HTML/JavaScript web app.

		The skeleton has already been agreed. Your module spec tells you exactly what to build.

		If module.kind === "html":
		- Output a complete valid HTML5 document with <!DOCTYPE html>
		- Reference all CSS via <link> in <head>
		- Reference all JS via <script src="..."> at end of <body> in dependency order
		- Include any CDN libraries listed in cdn_libraries
		- Set <meta name="viewport" content="width=device-width,initial-scale=1">

		If module.kind === "js":
		- Output a single .js file
		- ALWAYS start with this exact bootstrap line: window.App = window.App || { _modules: {}, _ready: [], registerModule(n,m){this._modules[n]=m;}, getModule(n){return this._modules[n];}, onReady(fn){this._ready.push(fn);} };
		- Wrap your entire module in an IIFE: (function() { ... })();
		- Inside the IIFE, define your functions then call: window.App.registerModule('<module_id>', { publicFn1, publicFn2 });
		- DO NOT auto-execute setup code at module load. Instead: window.App.onReady(() => { /* setup */ });
		- Reference other modules SAFELY: const other = window.App.getModule('other_id'); if (other) other.fn(); — never assume order
		- Do NOT touch the DOM at module load. Always defer to onReady.
		- No ES module syntax (no import/export, no require)

		If module.kind === "css":
		- Output a single .css file
		- Use CSS custom properties (--var-name) for theme colors
		- Mobile-first media queries
		- Apply the STYLE BRIEF below verbatim

		STYLE BRIEF (from spec.style_brief): {style_brief}
			Apply this style consistently across all files. For HTML files, include Google Fonts <link> in <head>. For CSS, use the colors/fonts/effects specified. For JS-driven UI updates, preserve transitions and animations.

		CRITICAL — Browser sandbox rules:
		- No Node.js APIs (no require, no fs, no process, no __dirname)
		- No build steps (no JSX, no TypeScript, no SCSS, no PostCSS)
		- LocalStorage / IndexedDB / sessionStorage OK
		- fetch() to public APIs OK; no auth headers expected
		- All paths relative (no leading /)

		For tests: write JS test functions that get loaded into a sandboxed iframe with the module code. Format:
		function test_<scenario>() {
		// Setup: create DOM elements as needed via createTestDOM()
		// Exercise: call the public API
		// Assert: return { passed: bool, message: 'description' }
		}
		window.tests = window.tests || [];
		window.tests.push(test_basic_render);
		window.tests.push(test_user_interaction);
		// ... register every test function

		createTestDOM() is a helper provided by the harness; it returns a fresh container div appended to document.body and clears it between tests.

		Output ONLY valid JSON:
		{"code":"full file content","tests":"test JS code (empty string for HTML/CSS modules)","imports_needed":[],"requested_symbols":[],"notes":"optional"}`;
			const STAGE_C_CRITIC_SYSTEM = `You are a senior code reviewer. Find real problems in the draft implementation.

REVIEW CHECKLIST:
1. Correctness: Do function signatures match the spec? Are return types correct?
2. Edge cases: Empty inputs, None, boundary values, invalid inputs
3. Security: No real network calls, no subprocess, no fs writes outside /workdir
4. Test coverage: Does each acceptance criterion have a test?

OUTPUT RULES:
- Output ONLY valid JSON
- No markdown fences, no explanation outside JSON

REQUIRED JSON SCHEMA:
{
  "verdict": "accept|revise",
  "critical_issues": ["specific issue 1", "..."],
  "suggestions": ["non-blocking suggestion", "..."]
}

If verdict="accept", critical_issues must be empty.`;

			const STAGE_C_REVISER_SYSTEM = `You are the original author. Fix the critical issues found by the reviewer.

REPAIR RULES:
- Fix ALL critical issues
- Keep what works (don't rewrite everything)
- Maintain public function signatures
- Add tests for fixed issues

Output the same JSON schema as your original draft.`;

			const STAGE_C_JUDGE_SYSTEM = `You are an orchestrator picking the best of 3 candidate implementations.

SCORING CRITERIA (0-10 each):
1. Correctness: matches the spec
2. Tests: verify acceptance criteria
3. Safety: no sandbox violations
4. Robustness: handles edge cases

OUTPUT RULES:
- Output ONLY valid JSON
- No markdown fences, no explanation outside JSON

REQUIRED JSON SCHEMA:
{
  "winner": 0|1|2,
  "scores": [
    {"correctness": 0-10, "tests": 0-10, "safety": 0-10, "robustness": 0-10, "notes": "..."}
  ],
  "rationale": "why winner is best"
}`;

	const STAGE_C_WORKER_SYSTEM = `You are a senior Python engineer implementing ONE module. Rules:
	1. Only define public names listed in your module spec.
	0. SANDBOX: Code runs in Pyodide (browser WASM Python). Do NOT use: real network calls (requests/urllib/socket), subprocess, threading, multiprocessing, GUI libraries (tkinter/PyQt), or C extensions. For tests, use local data/fixtures, never live HTTP.
	2. Use exact signatures from the symbol table for dependency calls.
	3. If you genuinely need a symbol not in the table, list it in requested_symbols. Do not use it until approved.
	4. pytest tests: happy path, 1 edge case, 1 error case if spec declares raises.
	5. PEP 8; type hints on public functions.
	6. Do not catch exceptions you cannot handle meaningfully.
	7. If the user provides REFERENCE DOCS, use the latest API signatures from those docs — not outdated patterns.
	Output ONLY valid JSON:
	{"code":"full source","tests":"full pytest source","imports_needed":["pkg"],"requested_symbols":[{"kind":"function|type|constant","name":"symbol_name","why":"reason"}],"notes":"optional"}`;

const STAGE_C_REPAIR_ADDENDUM = `The previous attempt failed. Pytest output:
<pytest_output>
{PYTEST_OUTPUT}
</pytest_output>
Must not change public signatures in the symbol table. If a test itself is wrong, note it and propose a correction — the user must approve test changes. Return the same JSON schema.`;

const STAGE_C_SYMBOL_PROMPT = `A worker module requested new symbols not in the current symbol table.
Current symbol table:
{SYMBOL_TABLE}
Requested symbols:
{REQUESTED}
For each requested symbol decide:
- APPROVE: add it to the table (provide definition)
- REJECT: worker must find another approach
- MODIFY_SKELETON: this changes architecture (warn user)
Output ONLY valid JSON:
{"decisions":[{"name":"symbol_name","action":"approve|reject|modify_skeleton","definition":"if approved","reason":"why"}]}`;

const STAGE_C_INTEGRATION_PROMPT = `Generate a pytest integration test file that exercises the FULL package end-to-end.
Modules (all implemented):
{MODULES_JSON}
Data flow:
{DATA_FLOW_JSON}
Dummy inputs:
{DUMMY_INPUTS}
Acceptance criteria:
{CRITERIA}

Requirements:
- Import every module listed above
- Write at least 3 tests: (1) end-to-end happy path through the data_flow, (2) cross-module integration testing the main use case, (3) one criterion-based test per acceptance_criterion
- Verify outputs match acceptance_criteria
- Use realistic dummy data, not just None/empty values

Output ONLY valid Python pytest code (no JSON wrapper, no markdown fences). Runnable with: pytest test_integration.py -v`;

const StageC = (() => {
	function _isWebapp(spec) {
		const t = spec && spec.target_type;
		return t === 'webapp' || t === 'single_page_webapp';
		}
	function _isPython(spec) {
		const t = spec && spec.target_type;
		return !t || t === 'python' || t === 'cli' || t === 'api';
		}
	let _state = 'idle';
	let _skeleton = null;
	let _spec = null;
	let _moduleStates = {};
	let _moduleDecisions = {};  // { moduleId: 'pending'|'building'|'testing'|'passed'|'failed'|'escalated' }
	let _moduleArtifacts = []; // accumulated artifacts
	let _currentModuleId = null;
	let _aborted = false;
	let _paused = false;

  const REPAIR_MAX = 3;
  const INTEGRATION_REPAIR_MAX = 2;

  function getState() { return _state; }
  function getModuleStates() { return { ..._moduleStates }; }
  function getModuleArtifacts() { return _moduleArtifacts.slice(); }
  function getCurrentModuleId() { return _currentModuleId; }

  async function* run(skeleton, spec) {
    _skeleton = JSON.parse(JSON.stringify(skeleton));
    _spec = JSON.parse(JSON.stringify(spec));
    _state = 'running';
    _aborted = false;
    _paused = false;
    _moduleArtifacts = [];
    _currentModuleId = null;

    // Init module states
    _moduleStates = {};
		const parallelN = (CodeSmith.state.settings && CodeSmith.state.settings.parallelWorkers) || 1;
		if (parallelN > 1) {
		// Parallel mode: build modules in waves where deps are satisfied
		const built = new Set();
		const remaining = new Set(_skeleton.build_order);
		while (remaining.size > 0 && !_aborted) {
			// Find modules whose deps are all built
			const ready = [];
			for (const modId of remaining) {
			const mod = _skeleton.modules.find(m => m.id === modId);
			if (!mod) { remaining.delete(modId); continue; }
			const deps = mod.depends_on || [];
			if (deps.every(d => built.has(d))) ready.push(modId);
			if (ready.length >= parallelN) break;
			}
			if (ready.length === 0) {
			yield { type: 'error', stage: 'parallel_deadlock', error: new Error('Parallel build stuck — circular deps or unbuildable modules: ' + [...remaining].join(', ')) };
			return;
			}
			yield { type: 'parallel_wave', modules: ready };
			// Build all `ready` in parallel
			const promises = ready.map(modId => _buildOneModule(modId, _skeleton, _spec, _moduleArtifacts));
			const results = await Promise.all(promises);
			for (let i = 0; i < ready.length; i++) {
			const modId = ready[i];
			const result = results[i];
			// _scModuleData is initialized before use in _scStartBuild
			if (result.error) {
				yield { type: 'error', stage: 'worker', moduleId: modId, error: result.error };
				_moduleStates[modId] = 'failed';
			} else if (result.artifact) {
				_moduleArtifacts.push(result.artifact);
				_moduleStates[modId] = 'built';
				SymbolTable.markImplemented(modId);
				built.add(modId);
				yield { type: 'worker_done', moduleId: modId, result: { code: result.artifact.code, tests: result.artifact.tests, imports_needed: result.artifact._imports || [] }, attempt: 1 };
				yield { type: 'module_built', moduleId: modId, table: SymbolTable.get() };
			}
			remaining.delete(modId);
			}
		}
		yield { type: 'all_built', count: _moduleArtifacts.length };
		// Skip the sequential loop below
		_state = 'paused';
		_paused = true;
		yield { type: 'phase_checkpoint', message: 'All modules built. Download untested package or continue to testing.' };
		while (_paused && !_aborted) await _sleep(200);
		if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
		_state = 'running';
		} else {
    for (const modId of _skeleton.build_order) {
      _moduleStates[modId] = 'pending';
    }

    // Init symbol table from skeleton
    SymbolTable.initFromSkeleton(_skeleton);
    yield { type: 'symbols_init', table: SymbolTable.get() };

    // Ensure Pyodide is ready
    try { await CodeSmith.sandbox.warmUp(); } catch (err) {
      yield { type: 'error', stage: 'sandbox', error: err };
      _state = 'stopped';
      return;
    }
    try { await CodeSmith.sandbox.installPackage('pytest'); } catch {}

    const totalModules = _skeleton.build_order.length;
    let completedModules = 0;

    // ---- Build each module ----
    // ---- PHASE 1: Build all modules (no testing) ----
		for (const modId of _skeleton.build_order) {
		if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
		if (_paused) {
			_state = 'paused';
			yield { type: 'build_paused', moduleId: modId };
			while (_paused && !_aborted) await _sleep(200);
			if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
			_state = 'running';
		}

		const mod = _skeleton.modules.find(m => m.id === modId);
		if (!mod) continue;
		_currentModuleId = modId;
		_moduleStates[modId] = 'building';
		yield { type: 'module_start', moduleId: modId, progress: completedModules + '/' + totalModules, phase: 'build' };

			const isWebapp = _spec.target_type === 'webapp';
			const depCode = SymbolTable.getDependencyCode(modId, _skeleton, _moduleArtifacts);
			const dummyInputs = (_spec.inputs && _spec.inputs.example) ? _spec.inputs.example : '';
			const workOrder = {
				module_spec: mod,
				symbol_table: SymbolTable.get(),
				dependency_code: depCode,
				dummy_inputs: dummyInputs,
				cdn_libraries: _skeleton.cdn_libraries || [],
				shared_state: _skeleton.shared_state || {},
			};
			const workerSystem = isWebapp
				? STAGE_C_WEBAPP_WORKER_SYSTEM.replace('{style_brief}', _spec.style_brief || 'No specific style — use clean, modern defaults.')
				: STAGE_C_WORKER_SYSTEM;

			let workerResult = null;
			let workerError = null;
			let workerText = '';
			try {
				for await (const ev of CodeSmith.llm.chat({
				messages: [
					{ role: 'system', content: workerSystem },
					{ role: 'user', content: 'Work order:\n' + JSON.stringify(workOrder, null, 2) },
				],
				tier: 'worker', temperature: 0.2, maxTokens: 20000,
				})) {
				
			if (ev.type === 'token') {
				workerText += ev.delta;
				yield { type: 'worker_stream', moduleId: modId, delta: ev.delta };
			} else if (ev.type === 'done') { workerText = ev.text || workerText; }
			else if (ev.type === 'error' && !ev.recoverable) workerError = ev.error;
			}
		} catch (err) { workerError = err; }

		if (workerError) {
			yield { type: 'error', stage: 'worker', moduleId: modId, error: workerError };
			_moduleStates[modId] = 'failed';
			continue;
		}

		try {
			workerResult = _parseJSON(workerText);
			if (!workerResult || !workerResult.code) throw new Error('Missing code');
			if (workerResult.code.trim().length < 20) {
					throw new Error('Module code too short (length=' + workerResult.code.length + ')');
					}
					// Webapp: validate HTML structure
					if ((_spec.target_type === 'webapp' || _spec.target_type === 'single_page_webapp') && mod.kind === 'html') {
					const c = workerResult.code;
					const issues = [];
					if (!/<!DOCTYPE html>/i.test(c)) issues.push('missing <!DOCTYPE html>');
					if (!/<html[\s>]/i.test(c) || !/<\/html>/i.test(c)) issues.push('missing <html> tags');
					if (!/<body[\s>]/i.test(c) || !/<\/body>/i.test(c)) issues.push('missing <body> tags');
					if (!/<script\s+src=/i.test(c)) issues.push('no <script src> tags — modules will not load');
					if (issues.length > 0) throw new Error('Generated HTML is malformed: ' + issues.join('; '));
					}
					if ((_spec.target_type === 'webapp' || _spec.target_type === 'single_page_webapp') && mod.kind === 'js') {
					if (!/window\.App/i.test(workerResult.code)) {
						throw new Error('JS module does not reference window.App — will break collaboration');
					}
					}
		} catch (err) {
			yield { type: 'error', stage: 'worker_parse', moduleId: modId, error: err };
			_moduleStates[modId] = 'failed';
			continue;
		}

		const collabMode = (CodeSmith.state.settings && CodeSmith.state.settings.collabMode) || 'solo';
			if (collabMode === 'critic' && workerResult.code) {
				yield { type: 'critic_start', moduleId: modId };
				try {
				const critiqueResult = await CodeSmith.llm.chatComplete({
					messages: [
					{ role: 'system', content: STAGE_C_CRITIC_SYSTEM },
					{ role: 'user', content: 'Module spec:\n' + JSON.stringify(mod, null, 2) + '\n\nDraft code:\n' + workerResult.code + '\n\nDraft tests:\n' + (workerResult.tests || '(none)') },
					],
					tier: 'orchestrator', temperature: 0.1, maxTokens: 6000,
				});
				const critique = _parseJSON(critiqueResult.text);
				yield { type: 'critic_verdict', moduleId: modId, verdict: critique.verdict, issues: critique.critical_issues || [] };

				if (critique.verdict === 'revise' && (critique.critical_issues || []).length > 0) {
					yield { type: 'reviser_start', moduleId: modId };
					const revisionResult = await CodeSmith.llm.chatComplete({
					messages: [
						{ role: 'system', content: STAGE_C_REVISER_SYSTEM },
						{ role: 'user', content: 'Original spec:\n' + JSON.stringify(mod, null, 2) },
						{ role: 'assistant', content: JSON.stringify({ code: workerResult.code, tests: workerResult.tests }) },
						{ role: 'user', content: 'Critical issues to fix:\n' + critique.critical_issues.map((s, i) => (i + 1) + '. ' + s).join('\n') },
					],
					tier: 'worker', temperature: 0.2, maxTokens: 20000,
					});
					const revised = _parseJSON(revisionResult.text);
					if (revised && revised.code && revised.code.trim().length >= 20) {
					workerResult = revised;
					yield { type: 'reviser_done', moduleId: modId, result: revised };
					} else {
					yield { type: 'reviser_failed', moduleId: modId, reason: 'Revision returned empty/invalid code; keeping original draft' };
					}
				}
				} catch (err) {
				yield { type: 'reviser_failed', moduleId: modId, reason: err.message || String(err) };
				}
			} else if (collabMode === 'vote3' && workerResult.code) {
				yield { type: 'vote_start', moduleId: modId };
				const candidates = [workerResult];
				// Generate 2 more candidates with higher temperature for diversity
				for (let c = 0; c < 2; c++) {
				try {
					const altResult = await CodeSmith.llm.chatComplete({
					messages: [
						{ role: 'system', content: workerSystem },
						{ role: 'user', content: 'Work order (alternative approach #' + (c + 2) + ' — be creative):\n' + JSON.stringify(workOrder, null, 2) },
					],
					tier: 'worker', temperature: 0.5 + c * 0.2, maxTokens: 20000,
					});
					const altParsed = _parseJSON(altResult.text);
					if (altParsed && altParsed.code && altParsed.code.trim().length >= 20) candidates.push(altParsed);
				} catch {}
				}
				if (candidates.length >= 2) {
				try {
					const judgeResult = await CodeSmith.llm.chatComplete({
					messages: [
						{ role: 'system', content: STAGE_C_JUDGE_SYSTEM },
						{ role: 'user', content: 'Module spec:\n' + JSON.stringify(mod, null, 2) + '\n\nCandidates:\n' + candidates.map((c, i) => '\n=== CANDIDATE ' + i + ' ===\nCode:\n' + c.code + '\n\nTests:\n' + (c.tests || '(none)')).join('\n') },
					],
					tier: 'orchestrator', temperature: 0.1, maxTokens: 4000,
					});
					const verdict = _parseJSON(judgeResult.text);
					const winner = (verdict && typeof verdict.winner === 'number') ? verdict.winner : 0;
					workerResult = candidates[Math.min(winner, candidates.length - 1)];
					yield { type: 'vote_done', moduleId: modId, winner, totalCandidates: candidates.length, rationale: verdict.rationale || '' };
				} catch (err) {
					yield { type: 'vote_failed', moduleId: modId, reason: err.message || String(err) };
				}
				}
			}
			
		yield { type: 'worker_done', moduleId: modId, result: workerResult, attempt: 1 };

		if (workerResult.requested_symbols && workerResult.requested_symbols.length > 0) {
			yield { type: 'symbols_requested', moduleId: modId, symbols: workerResult.requested_symbols };
			const decisions = await _negotiateSymbols(workerResult.requested_symbols);
			yield { type: 'symbols_decision', moduleId: modId, decisions };
			for (const dec of (decisions || [])) {
			if (dec.action === 'approve') {
				SymbolTable.apply({
				op: 'add', section: dec.kind === 'function' ? 'functions' : dec.kind === 'type' ? 'types' : 'constants',
				name: dec.name,
				value: { definition: dec.definition || '', module: modId, status: 'declared', description: dec.reason || '' },
				});
			}
			}
		}

		let outputFilename;
			if (isWebapp) {
				// For webapp, use the actual filename from the skeleton
				outputFilename = mod.name || (mod.id + (mod.kind === 'html' ? '.html' : mod.kind === 'css' ? '.css' : '.js'));
			} else {
				const safeName = _sanitizeModuleName(mod.name || mod.id);
				mod.name = safeName;
				outputFilename = safeName + '.py';
			}
			try {
				await CodeSmith.sandbox.writeFile('/workdir/' + outputFilename, workerResult.code);
				if (workerResult.tests && !isWebapp) {
				await CodeSmith.sandbox.writeFile('/workdir/test_' + (mod.name) + '.py', workerResult.tests);
				}
				// For webapp, store tests in artifact instead of FS (run via iframe later)
			} catch (err) {
				yield { type: 'error', stage: 'write_fs', moduleId: modId, error: err };
				continue;
			}
		for (const pkg of (workerResult.imports_needed || [])) {
			try { await CodeSmith.sandbox.installPackage(pkg); } catch (err) {
			yield { type: 'error', stage: 'install', moduleId: modId, error: err };
			}
			}

		_moduleStates[modId] = 'built';
		const artifact = {
			id: modId + '_' + Date.now(),
			sessionId: CodeSmith.state.currentId,
			moduleName: modId,
			code: workerResult.code,
			tests: workerResult.tests || '',
			spec: mod,
			createdAt: Date.now(),
			status: 'built',
			_imports: workerResult.imports_needed || [],
		};
		_moduleArtifacts.push(artifact);
		SymbolTable.markImplemented(modId);
			yield { type: 'module_built', moduleId: modId, table: SymbolTable.get() };
			}
			} // end serial else

			if (parallelN <= 1) {
			yield { type: 'all_built', count: _moduleArtifacts.length };

			_state = 'paused';
			_paused = true;
			yield { type: 'phase_checkpoint', message: 'All modules built. Download untested package or continue to testing.' };
			while (_paused && !_aborted) await _sleep(200);
			if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
			_state = 'running';
			} // end if parallelN <= 1

			// ---- PHASE 2: Test each module with patch-based repair ----
		for (const artifact of _moduleArtifacts) {
		if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
		if (_paused) {
			_state = 'paused';
			yield { type: 'build_paused', moduleId: artifact.moduleName };
			while (_paused && !_aborted) await _sleep(200);
			if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
			_state = 'running';
		}

		const modId = artifact.moduleName;
		const mod = _skeleton.modules.find(m => m.id === modId);
		if (!mod) continue;
		_currentModuleId = modId;
		_moduleStates[modId] = 'testing';
		yield { type: 'module_start', moduleId: modId, progress: completedModules + '/' + totalModules, phase: 'test' };

		let passed = false;
		let lastOutput = '';

		const isWebapp = _spec.target_type === 'webapp';

			// Skip tests for HTML and CSS modules in webapp builds — they have no executable logic
			if (isWebapp && (mod.kind === 'html' || mod.kind === 'css' || !artifact.tests)) {
				artifact.status = 'passed';
				try { await CodeSmith.db.putArtifact(artifact); } catch {}
				completedModules++;
				yield { type: 'module_passed', moduleId: modId, progress: completedModules + '/' + totalModules, table: SymbolTable.get() };
				continue;
			}

			for (let attempt = 1; attempt <= REPAIR_MAX + 1; attempt++) {
				if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
				yield { type: 'tests_start', moduleId: modId, attempt };

				let testResult;
				let pytestOutput;
				let parsedTest;

				if (isWebapp) {
				// Run JS tests in sandboxed iframe
				try {
					const result = await _runWebappTests(artifact.code, artifact.tests, _moduleArtifacts.filter(a => a.moduleName !== modId && a.moduleName.endsWith('.js')));
					pytestOutput = result.output;
					parsedTest = { passCount: result.passCount, failCount: result.failCount, allPassed: result.allPassed };
				} catch (err) {
					yield { type: 'error', stage: 'tests_run', moduleId: modId, error: err };
					break;
				}
				} else {
				const safeName = mod.name;
				const pytestCode = `
					import sys, os
					sys.path.insert(0, '/workdir')
					os.chdir('/workdir')
					for mn in list(sys.modules):
						if mn == '${safeName}' or mn.startswith('${safeName}.'):
							del sys.modules[mn]
					import pytest
					exit_code = pytest.main(['-v', '/workdir/test_${safeName}.py', '--tb=short', '--no-header'])
					`;
							try {
								testResult = await CodeSmith.sandbox.runPython(pytestCode, { sessionGlobals: true, timeoutMs: 30000 });
							} catch (err) {
								yield { type: 'error', stage: 'tests_run', moduleId: modId, error: err };
								break;
							}
							pytestOutput = (testResult.stdout || '') + (testResult.stderr || '');
							parsedTest = _parsePytest(pytestOutput);
							}
			lastOutput = pytestOutput;

			yield {
			type: 'tests_result', moduleId: modId, attempt,
			passed: parsedTest.allPassed, passCount: parsedTest.passCount,
			failCount: parsedTest.failCount, output: pytestOutput,
			};

			if (parsedTest.allPassed && parsedTest.passCount > 0) {
					passed = true;
					artifact.status = 'passed';
					try { await CodeSmith.db.putArtifact(artifact); } catch {}
					break;
					}
					if (_moduleDecisions[modId] === 'bypass') {
					passed = true;
					artifact.status = 'bypassed';
					try { await CodeSmith.db.putArtifact(artifact); } catch {}
					delete _moduleDecisions[modId];
					break;
					}
					if (_moduleDecisions[modId] === 'skip') {
					artifact.status = 'skipped';
					delete _moduleDecisions[modId];
					break;
					}
					if (attempt > REPAIR_MAX) break;

			// ---- PATCH-BASED REPAIR ----
			yield { type: 'repair_start', moduleId: modId, attempt: attempt + 1 };
			const currentCode = await CodeSmith.sandbox.readFile('/workdir/' + safeName + '.py').catch(() => artifact.code);
			const currentTests = await CodeSmith.sandbox.readFile('/workdir/test_' + safeName + '.py').catch(() => artifact.tests);

			const patch = await _diagnoseAndPatch(modId, mod, currentCode, currentTests, pytestOutput);
			yield { type: 'repair_diagnosis', moduleId: modId, attempt: attempt + 1, patch };

			if (!patch || !patch.edits || patch.edits.length === 0) {
			yield { type: 'repair_failed', moduleId: modId, reason: 'No patches generated' };
			continue;
			}

			let newCode = currentCode;
			let newTests = currentTests;
			for (const edit of patch.edits) {
			const target = edit.target === 'tests' ? newTests : newCode;
			const result = _applyPatchEdit(target, edit);
			if (!result.ok) {
				yield { type: 'repair_failed', moduleId: modId, reason: 'Patch apply failed: ' + result.error };
				continue;
			}
			if (edit.target === 'tests') newTests = result.newContent;
			else newCode = result.newContent;
			}

			try {
			await CodeSmith.sandbox.writeFile('/workdir/' + safeName + '.py', newCode);
			await CodeSmith.sandbox.writeFile('/workdir/test_' + safeName + '.py', newTests);
			artifact.code = newCode;
			artifact.tests = newTests;
			} catch (err) {
			yield { type: 'error', stage: 'patch_write', moduleId: modId, error: err };
			break;
			}
		}

		if (passed) {
			completedModules++;
			yield { type: 'module_passed', moduleId: modId, progress: completedModules + '/' + totalModules, table: SymbolTable.get() };
			} else if (artifact.status === 'skipped') {
					_moduleStates[modId] = 'failed';
					yield { type: 'module_skipped', moduleId: modId };
				} else {
					_moduleStates[modId] = 'escalated';
					yield {
					type: 'module_escalated', moduleId: modId,
					code: artifact.code, tests: artifact.tests, output: lastOutput,
					table: SymbolTable.get(),
					};
					_state = 'paused';
					_paused = true;
					while (_paused && !_aborted) await _sleep(200);
					if (_aborted) { _state = 'stopped'; yield { type: 'build_stopped' }; return; }
					_state = 'running';
					// Re-check decision after resume
					if (_moduleDecisions[modId] === 'bypass') {
					artifact.status = 'bypassed';
					_moduleStates[modId] = 'passed';
					try { await CodeSmith.db.putArtifact(artifact); } catch {}
					completedModules++;
					delete _moduleDecisions[modId];
					yield { type: 'module_passed', moduleId: modId, progress: completedModules + '/' + totalModules, table: SymbolTable.get() };
					} else if (_moduleDecisions[modId] === 'skip') {
					artifact.status = 'skipped';
					_moduleStates[modId] = 'failed';
					delete _moduleDecisions[modId];
					yield { type: 'module_skipped', moduleId: modId };
					} else {
					return; // user did not decide; halt
					}
				}
		}

// ---- Smoke test (Python only) ----
  		  	if (_spec.target_type !== 'webapp' && _spec.target_type !== 'single_page_webapp') {

			yield { type: 'smoke_start' };
			const importNames = _moduleArtifacts.map(a => a.moduleName).join(', ');
			const smokeCode = `
				import sys
				sys.path.insert(0, '/workdir')
				errors = []
				for mod in [${_moduleArtifacts.map(a => "'" + a.moduleName + "'").join(', ')}]:
					try:
						__import__(mod)
						print('OK:', mod)
					except Exception as e:
						errors.append(mod + ': ' + type(e).__name__ + ': ' + str(e))
						print('FAIL:', mod, '-', e)
				if errors:
					print('\\nSMOKE_FAILED')
				else:
					print('\\nSMOKE_OK')
				`;
					try {
					const smokeResult = await CodeSmith.sandbox.runPython(smokeCode, { sessionGlobals: false, timeoutMs: 15000 });
					const out = (smokeResult.stdout || '') + (smokeResult.stderr || '');
					const smokeOk = out.includes('SMOKE_OK');
					yield { type: 'smoke_result', passed: smokeOk, output: out };
					if (!smokeOk) {
						yield { type: 'error', stage: 'smoke_test', error: new Error('Modules built but cannot import together. ' + out.slice(-500)) };
					}
					} catch (err) {
						yield { type: 'error', stage: 'smoke_test', error: err };
						}
				} else {
				// Webapp smoke test: load the bundle in an iframe and check for runtime errors
				yield { type: 'smoke_start' };
				const skel = _skeleton;
				const cdnTags = (skel.cdn_libraries || []).map(c => '<script src="' + c.url + '"><\/script>').join('\n');
				const cssLinks = (skel.modules || []).filter(m => m.kind === 'css').map(m => {
					const art = _moduleArtifacts.find(a => a.moduleName === m.id);
					return art ? '<style>' + (art.code || '') + '</style>' : '';
				}).join('\n');
				const jsScripts = (skel.modules || []).filter(m => m.kind === 'js').map(m => {
					const art = _moduleArtifacts.find(a => a.moduleName === m.id);
					return art ? '<script>\n' + (art.code || '') + '\n<\/script>' : '';
				}).join('\n');
				const bootstrap = '<script>window.App = window.App || { _modules: {}, _ready: [], registerModule(n,m){this._modules[n]=m;}, getModule(n){return this._modules[n];}, onReady(fn){this._ready.push(fn);} };<\/script>';
				const errCatcher = '<script>window._smokeErrors = []; window.addEventListener("error", e => window._smokeErrors.push(e.message)); window.addEventListener("unhandledrejection", e => window._smokeErrors.push(String(e.reason)));<\/script>';
				const finalCheck = '<script>setTimeout(() => { parent.postMessage({type:"smoke_check",errors:window._smokeErrors,modules:Object.keys(window.App._modules||{}),booted:!!window.App._booted}, "*"); }, 1500);<\/script>';
				const html = '<!DOCTYPE html><html><head>' + errCatcher + bootstrap + cssLinks + cdnTags + '</head><body><div id="app"></div>' + jsScripts + '<script>document.dispatchEvent(new Event("DOMContentLoaded"));for(const fn of (window.App._ready||[])){try{fn();}catch(e){window._smokeErrors.push(e.message);}}window.App._booted=true;<\/script>' + finalCheck + '</body></html>';

				const smokeResult = await new Promise((resolve) => {
					const iframe = document.createElement('iframe');
					iframe.sandbox = 'allow-scripts';
					iframe.style.cssText = 'position:absolute;left:-10000px;width:800px;height:600px;';
					iframe.srcdoc = html;
					document.body.appendChild(iframe);
					let resolved = false;
					const handler = (ev) => {
					if (resolved || ev.data?.type !== 'smoke_check') return;
					resolved = true;
					window.removeEventListener('message', handler);
					iframe.remove();
					resolve(ev.data);
					};
					window.addEventListener('message', handler);
					setTimeout(() => { if (!resolved) { resolved = true; window.removeEventListener('message', handler); iframe.remove(); resolve({ errors: ['Smoke timeout'], modules: [], booted: false }); } }, 8000);
				});

				const expectedJs = (skel.modules || []).filter(m => m.kind === 'js').map(m => m.id);
				const missing = expectedJs.filter(id => !smokeResult.modules.includes(id));
				const passed = smokeResult.errors.length === 0 && missing.length === 0 && smokeResult.booted;
				yield { type: 'smoke_result', passed, output: 'Errors: ' + JSON.stringify(smokeResult.errors) + '\nRegistered: ' + smokeResult.modules.join(', ') + '\nMissing: ' + missing.join(', ') + '\nBooted: ' + smokeResult.booted };
				if (!passed) {
					yield { type: 'error', stage: 'smoke_test', error: new Error('Webapp smoke test failed. Errors: ' + smokeResult.errors.slice(0, 3).join('; ') + (missing.length ? '. Missing modules: ' + missing.join(', ') : '')) };
				}
				}
    // ---- Integration test ----
    yield { type: 'integration_start' };

    let integrationPassed = false;
    for (let intAttempt = 1; intAttempt <= INTEGRATION_REPAIR_MAX + 1; intAttempt++) {
      const integCode = await _generateIntegrationTest(intAttempt > 1);
      if (!integCode) {
        yield { type: 'error', stage: 'integration_gen', error: new Error('Failed to generate integration test') };
        break;
      }

      try {
        await CodeSmith.sandbox.writeFile('/workdir/test_integration.py', integCode);
      } catch {}

      const integPytest = `
import sys, os
sys.path.insert(0, '/workdir')
os.chdir('/workdir')
import pytest
exit_code = pytest.main(['-v', '/workdir/test_integration.py', '--tb=short', '--no-header'])
`;
      let integResult;
      try {
        integResult = await CodeSmith.sandbox.runPython(integPytest, { sessionGlobals: true, timeoutMs: 45000 });
      } catch (err) {
        yield { type: 'error', stage: 'integration_run', error: err };
        break;
      }

      const integOutput = (integResult.stdout || '') + (integResult.stderr || '');
      const integParsed = _parsePytest(integOutput);

      yield {
        type: 'integration_result', attempt: intAttempt,
        passed: integParsed.allPassed, passCount: integParsed.passCount,
        failCount: integParsed.failCount, output: integOutput,
      };

      if (integParsed.allPassed && integParsed.passCount > 0) {
        integrationPassed = true;
        break;
      }

      if (intAttempt > INTEGRATION_REPAIR_MAX) break;

      // Targeted repair: let orchestrator pick culprit
      // (simplified: just retry with error context)
    }

    if (integrationPassed) {
      _state = 'complete';
      yield { type: 'build_complete', modules: _moduleArtifacts.length, table: SymbolTable.get() };
    } else {
      _state = 'stopped';
      yield { type: 'error', stage: 'integration', error: new Error('Integration tests failed after retries') };
    }
  }

  async function _generateIntegrationTest(isRetry) {
    const modsJson = JSON.stringify(_skeleton.modules.map(m => ({
      id: m.id, name: m.name, public_functions: (m.public_functions || []).map(f => f.signature),
    })), null, 2);
    const dataFlowJson = JSON.stringify(_skeleton.data_flow || [], null, 2);
    const dummyInputs = _spec.inputs ? JSON.stringify(_spec.inputs) : '{}';
    const criteria = JSON.stringify(_spec.acceptance_criteria || []);

    const prompt = STAGE_C_INTEGRATION_PROMPT
      .replace('{MODULES_JSON}', modsJson)
      .replace('{DATA_FLOW_JSON}', dataFlowJson)
      .replace('{DUMMY_INPUTS}', dummyInputs)
      .replace('{CRITERIA}', criteria);

    try {
      const result = await CodeSmith.llm.chatComplete({
        messages: [
          { role: 'system', content: 'You are a senior Python test engineer. Output ONLY valid Python code.' },
          { role: 'user', content: prompt },
        ],
        tier: 'orchestrator',
        temperature: 0.2,
        maxTokens: 8000,
		timeoutMs: 120000,
      });
      let code = (result.text || '').trim();
      if (code.startsWith('```')) code = code.replace(/^```(?:python)?\s*\n?/, '').replace(/\n?```\s*$/, '');
      return code;
    } catch { return null; }
  }
//------------------

		async function _diagnoseAndPatch(moduleId, mod, code, tests, pytestOutput) {
			const numberedCode = code.split('\n').map((l, i) => (i + 1) + '\t' + l).join('\n');
			const numberedTests = tests.split('\n').map((l, i) => (i + 1) + '\t' + l).join('\n');
			const trimmedOutput = pytestOutput.slice(-2500);

			const prompt = `Module ${moduleId} failed pytest. Diagnose the failure and produce MINIMAL line-level patches.

		CURRENT CODE (${moduleId}.py, line-numbered):
		${numberedCode}

		CURRENT TESTS (test_${moduleId}.py, line-numbered):
		${numberedTests}

		PYTEST OUTPUT:
		${trimmedOutput}

		ANALYSIS STEPS:
		1. Identify root cause: syntax error, logic bug, wrong return type, off-by-one, exception not handled, signature mismatch, missing import, etc.
		2. Decide if the fix is in CODE or TESTS (tests can be wrong too).
		3. Produce the SMALLEST set of edits. NEVER rewrite whole functions if a 1-line fix works.

		Output ONLY valid JSON (no markdown):
		{
		"diagnosis": "one-line root cause",
		"category": "syntax|logic|signature|import|exception|test_wrong|other",
		"edits": [
			{
			"target": "code|tests",
			"type": "replace|add|delete",
			"startLine": 5,
			"endLine": 5,
			"afterLine": null,
			"oldCode": "exact text being replaced (must match line" ${'startLine'} + "to" + ${'endLine'} "verbatim)",
			"newCode": "replacement text (omit for delete)",
			"reason": "why this edit"
			}
		]
		}

		Rules:
		- For "replace": oldCode must match the joined source of lines startLine..endLine EXACTLY (including indentation).
		- For "add": use afterLine; newCode is inserted after that line.
		- For "delete": startLine..endLine; no newCode.
		- Public function signatures CANNOT change. If the test wants a different signature, fix the test instead.
		- If the bug requires >5 line changes, return {"edits":[],"diagnosis":"too complex for patch"}.`;

			try {
			const result = await CodeSmith.llm.chatComplete({
				messages: [
				{ role: 'system', content: 'You are a Python debugger producing line-level patches. Output only valid JSON.' },
				{ role: 'user', content: prompt },
				],
				tier: 'orchestrator',
				temperature: 0.1,
				maxTokens: 8000,
			});
			return _parseJSON(result.text);
			} catch (err) {
			return { diagnosis: 'Patch generation failed: ' + (err.message || err), edits: [] };
			}
		}

		function _applyPatchEdit(content, edit) {
			const lines = content.split('\n');
			if (edit.type === 'replace') {
			const start = Math.max(0, (edit.startLine || 1) - 1);
			const end = Math.min(lines.length, edit.endLine || edit.startLine);
			if (edit.oldCode) {
				const actualOld = lines.slice(start, end).join('\n');
				if (actualOld.trim() !== edit.oldCode.trim()) {
				return { ok: false, error: 'oldCode mismatch at line ' + edit.startLine };
				}
			}
			const newLines = (edit.newCode || '').split('\n');
			lines.splice(start, end - start, ...newLines);
			} else if (edit.type === 'add') {
			const insertAt = Math.min(lines.length, edit.afterLine || lines.length);
			const newLines = (edit.newCode || '').split('\n');
			lines.splice(insertAt, 0, ...newLines);
			} else if (edit.type === 'delete') {
			const start = Math.max(0, (edit.startLine || 1) - 1);
			const end = Math.min(lines.length, edit.endLine || edit.startLine);
			lines.splice(start, end - start);
			} else {
			return { ok: false, error: 'Unknown edit type: ' + edit.type };
			}
			return { ok: true, newContent: lines.join('\n') };
		}

			async function _buildOneModule(modId, skeleton, spec, currentArtifacts) {
				const mod = skeleton.modules.find(m => m.id === modId);
				if (!mod) return { error: new Error('Module not found: ' + modId) };
				const isWebapp = spec.target_type === 'webapp' || spec.target_type === 'single_page_webapp';
				const depCode = SymbolTable.getDependencyCode(modId, skeleton, currentArtifacts);
				const dummyInputs = (spec.inputs && spec.inputs.example) ? spec.inputs.example : '';
				const workOrder = {
				module_spec: mod, symbol_table: SymbolTable.get(),
				dependency_code: depCode, dummy_inputs: dummyInputs,
				cdn_libraries: skeleton.cdn_libraries || [], shared_state: skeleton.shared_state || {},
				};
				const workerSystem = isWebapp
				? STAGE_C_WEBAPP_WORKER_SYSTEM.replace('{style_brief}', spec.style_brief || 'Clean modern defaults.')
				: STAGE_C_WORKER_SYSTEM;
				try {
				const result = await CodeSmith.llm.chatComplete({
					messages: [
					{ role: 'system', content: workerSystem },
					{ role: 'user', content: 'Work order:\n' + JSON.stringify(workOrder, null, 2) },
					],
					tier: 'worker', temperature: 0.2, maxTokens: 20000,
				});
				const parsed = _parseJSON(result.text);
						if (!parsed || !parsed.code || parsed.code.trim().length < 20) {
							return { error: new Error('Empty/short code from worker') };
						}
						// Validate webapp HTML structure
						if (isWebapp && mod.kind === 'html') {
							const c = parsed.code;
							const issues = [];
							if (!/<!DOCTYPE html>/i.test(c)) issues.push('missing <!DOCTYPE html>');
							if (!/<html[\s>]/i.test(c) || !/<\/html>/i.test(c)) issues.push('missing <html> tags');
							if (!/<body[\s>]/i.test(c) || !/<\/body>/i.test(c)) issues.push('missing <body> tags');
							if (!/<script\s+src=/i.test(c)) issues.push('no <script src> tags — modules will not load');
							if (issues.length > 0) return { error: new Error('Generated HTML is malformed: ' + issues.join('; ')) };
						}
						if (isWebapp && mod.kind === 'js') {
							if (!/window\.App/i.test(parsed.code)) {
								return { error: new Error('JS module does not reference window.App — will break collaboration') };
							}
						}
						let outputFilename;
						if (isWebapp) {
							outputFilename = mod.name || (mod.id + (mod.kind === 'html' ? '.html' : mod.kind === 'css' ? '.css' : '.js'));
						} else {
							const safeName = _sanitizeModuleName(mod.name || mod.id);
							mod.name = safeName;
							outputFilename = safeName + '.py';
						}
				try {
					await CodeSmith.sandbox.writeFile('/workdir/' + outputFilename, parsed.code);
					if (parsed.tests && !isWebapp) {
					await CodeSmith.sandbox.writeFile('/workdir/test_' + mod.name + '.py', parsed.tests);
					}
				} catch {}
				for (const pkg of (parsed.imports_needed || [])) {
					try { await CodeSmith.sandbox.installPackage(pkg); } catch {}
				}
				const artifact = {
					id: modId + '_' + Date.now(),
					sessionId: CodeSmith.state.currentId,
					moduleName: modId,
					code: parsed.code, tests: parsed.tests || '',
					spec: mod, createdAt: Date.now(), status: 'built',
					_imports: parsed.imports_needed || [],
				};
				try { await CodeSmith.db.putArtifact(artifact); } catch {}
				return { artifact };
				} catch (err) {
				return { error: err };
				}
			}
//-------------------
  async function _negotiateSymbols(requested) {
    const prompt = STAGE_C_SYMBOL_PROMPT
      .replace('{SYMBOL_TABLE}', JSON.stringify(SymbolTable.get(), null, 2))
      .replace('{REQUESTED}', JSON.stringify(requested, null, 2));

    try {
      const result = await CodeSmith.llm.chatComplete({
        messages: [
          { role: 'system', content: 'You are the orchestrator managing a shared symbol table.' },
          { role: 'user', content: prompt },
        ],
        tier: 'orchestrator',
        temperature: 0.1,
        maxTokens: 10000,
      });
      const parsed = _parseJSON(result.text);
      return parsed.decisions || [];
    } catch { return []; }
  }

	function pause() { _paused = true; }
	function resume() { _paused = false; }
	function stop() { _aborted = true; _paused = false; }
	function setModuleDecision(modId, decision) { _moduleDecisions[modId] = decision; }

  function resumeAfterEscalation(moduleId, editedCode, editedTests) {
    // Returns data needed to re-attempt the escalated module
    return { moduleId, code: editedCode, tests: editedTests };
  }

	function _sanitizeModuleName(name) {
		if (!name) return 'module';
		let clean = String(name).trim().toLowerCase()
		.replace(/[\s-]+/g, '_')
		.replace(/[^a-z0-9_]/g, '')
		.replace(/^[0-9]/, '_$&');
		if (!clean || !/^[a-z_]/.test(clean)) clean = 'mod_' + clean;
		// Prevent path traversal
		clean = clean.replace(/\.\./g, '').replace(/[\/\\]/g, '');
		if (clean.length > 60) clean = clean.slice(0, 60);
		return clean || 'module';
	}
	
  function _parseJSON(text) {
    if (!text) throw new Error('Empty response');
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    try { return JSON.parse(cleaned); } catch {}
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      try { return JSON.parse(cleaned.slice(s, e + 1)); } catch {}
    }
    throw new Error('Failed to parse JSON');
  }

  function _parsePytest(output) {
    let passCount = 0, failCount = 0;
    const pm = output.match(/(\d+)\s+passed/);
    const fm = output.match(/(\d+)\s+failed/);
    const em = output.match(/(\d+)\s+error/);
    if (pm) passCount = parseInt(pm[1], 10);
    if (fm) failCount = parseInt(fm[1], 10);
    if (em) failCount += parseInt(em[1], 10);
    return { passCount, failCount, allPassed: failCount === 0 && passCount > 0 };
  }
	async function _runWebappTests(moduleCode, testCode, dependencyArtifacts) {
		return new Promise((resolve) => {
		const iframe = document.createElement('iframe');
		iframe.sandbox = 'allow-scripts';
		iframe.style.cssText = 'position:absolute;left:-10000px;width:800px;height:600px;';

		const deps = (dependencyArtifacts || []).map(a => '// === ' + a.moduleName + ' ===\n' + (a.code || '')).join('\n\n');

		const html = '<!DOCTYPE html><html><body><div id="harness"></div><script>\n' +
			'window.App = window.App || {};\n' +
			'window.tests = [];\n' +
			'function createTestDOM() {\n' +
			'  const c = document.getElementById("harness");\n' +
			'  c.innerHTML = "";\n' +
			'  return c;\n' +
			'}\n' +
			'try {\n' +
			deps + '\n' +
			moduleCode + '\n' +
			testCode + '\n' +
			'} catch(e) {\n' +
			'  parent.postMessage({type:"webapp_test_results",results:[{name:"_load",passed:false,message:"Load error: "+e.message}]},"*");\n' +
			'}\n' +
			'const results = [];\n' +
			'for (const t of (window.tests || [])) {\n' +
			'  try { results.push({name: t.name || "anon", ...t()}); }\n' +
			'  catch(e) { results.push({name: t.name || "anon", passed: false, message: e.message}); }\n' +
			'}\n' +
			'parent.postMessage({type:"webapp_test_results",results},"*");\n' +
			'<' + '/script></body></html>';

		iframe.srcdoc = html;
		document.body.appendChild(iframe);

		let resolved = false;
		const handler = (ev) => {
			if (resolved || ev.data?.type !== 'webapp_test_results') return;
			resolved = true;
			window.removeEventListener('message', handler);
			iframe.remove();
			const results = ev.data.results || [];
			const passed = results.length > 0 && results.every(r => r.passed);
			const passCount = results.filter(r => r.passed).length;
			const failCount = results.filter(r => !r.passed).length;
			const output = results.map(r => (r.passed ? '✓' : '✗') + ' ' + r.name + (r.message ? ' — ' + r.message : '')).join('\n');
			resolve({ allPassed: passed, passCount, failCount, output });
		};
		window.addEventListener('message', handler);
		setTimeout(() => {
			if (resolved) return;
			resolved = true;
			window.removeEventListener('message', handler);
			iframe.remove();
			resolve({ allPassed: false, passCount: 0, failCount: 1, output: 'Test timeout (10s)' });
		}, 10000);
		});
	}
  function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { run, getState, getModuleStates, getModuleArtifacts, getCurrentModuleId, pause, resume, stop, resumeAfterEscalation, setModuleDecision };
})();
CodeSmith.stageC = StageC;

// === CODE EXPLORER MODULE ===================================================
	const Explorer = (() => {
	let _files = {};       // { filename: { content, language, modified } }
	let _activeFile = null;
	let _openTabs = [];    // [filename, ...]
	let _editMode = false;
	let _editHistory = [];

	function addFile(name, content) {
		const lang = _detectLang(name);
		_files[name] = { content, language: lang, modified: false, original: content };
		return { name, language: lang, lines: content.split('\n').length };
	}

	function getFile(name) { return _files[name] || null; }
	function getAllFiles() { return { ..._files }; }
	function getFileList() {
		return Object.entries(_files).map(([name, f]) => ({
		name, language: f.language, lines: f.content.split('\n').length, modified: f.modified,
		}));
	}
	function getActiveFile() { return _activeFile; }
	function setActiveFile(name) { _activeFile = name; }
	function getOpenTabs() { return _openTabs.slice(); }

	function openTab(name) {
		if (!_openTabs.includes(name)) _openTabs.push(name);
		_activeFile = name;
	}
	function closeTab(name) {
		_openTabs = _openTabs.filter(n => n !== name);
		if (_activeFile === name) _activeFile = _openTabs[_openTabs.length - 1] || null;
	}

	function updateFileContent(name, newContent) {
		if (!_files[name]) return;
		_files[name].content = newContent;
		_files[name].modified = newContent !== _files[name].original;
	}

				function applyEdit(filename, edit) {
						const file = _files[filename];
						if (!file) return { ok: false, error: 'File not found' };
						const before = file.content;
						const lines = file.content.split('\n');

						if (edit.type === 'replace') {
						const start = Math.max(0, (edit.startLine || 1) - 1);
						const end = Math.min(lines.length, edit.endLine || edit.startLine);
						// Validate oldCode matches if provided
						if (edit.oldCode) {
							const actualOld = lines.slice(start, end).join('\n');
							if (actualOld.trim() !== edit.oldCode.trim()) {
								// Try to find the oldCode by searching
								let foundIndex = -1;
								const oldLines = edit.oldCode.split('\n');
								for (let i = 0; i <= lines.length - oldLines.length; i++) {
									let match = true;
									for (let j = 0; j < oldLines.length && match; j++) {
										if (lines[i + j].trim() !== oldLines[j].trim()) match = false;
									}
									if (match) { foundIndex = i; break; }
								}
								if (foundIndex >= 0) {
									lines.splice(foundIndex, oldLines.length, ...(edit.newCode || '').split('\n'));
								} else {
									return { ok: false, error: 'oldCode mismatch at line ' + (edit.startLine || 1) + ' — content may have shifted from previous edits' };
								}
							} else {
								const newLines = (edit.newCode || '').split('\n');
								lines.splice(start, end - start, ...newLines);
							}
						} else {
							const newLines = (edit.newCode || '').split('\n');
							lines.splice(start, end - start, ...newLines);
						}
						} else if (edit.type === 'add') {
						const insertAt = Math.min(lines.length, edit.afterLine || lines.length);
						const newLines = (edit.newCode || '').split('\n');
						lines.splice(insertAt, 0, ...newLines);
						} else if (edit.type === 'delete') {
						const start = Math.max(0, (edit.startLine || 1) - 1);
						const end = Math.min(lines.length, edit.endLine || edit.startLine);
						lines.splice(start, end - start);
						} else {
						return { ok: false, error: 'Unknown edit type: ' + edit.type };
						}

						file.content = lines.join('\n');
						file.modified = true;
						_editHistory.push({
						filename, before, after: file.content,
						label: (edit.reason || edit.type), timestamp: Date.now(), edit,
						});
						if (_editHistory.length > 50) _editHistory.shift();
						return { ok: true, newContent: file.content };
					}

		function getEditHistory() { return _editHistory.slice(); }

			function undoLastEdit() {
					const last = _editHistory.pop();
					if (!last) return null;
					const f = _files[last.filename];
					if (!f) return null;
					f.content = last.before;
					f.modified = f.content !== f.original;
					// Mark as undone for potential reapply
					last.undone = true;
					last.undoneAt = Date.now();
					// Keep in history for reapply
					_editHistory.push(last);
					if (_editHistory.length > 50) _editHistory.shift();
					return last;
			}
		function deleteFile(name) {
			delete _files[name];
			_openTabs = _openTabs.filter(n => n !== name);
			if (_activeFile === name) _activeFile = _openTabs[_openTabs.length - 1] || null;
		}
	function clearAll() {
		_files = {};
		_activeFile = null;
		_openTabs = [];
	}

	function analyzeCode(content, language) {
		const lines = content.split('\n');
		const totalLines = lines.length;
		const blankLines = lines.filter(l => l.trim() === '').length;
		const commentLines = lines.filter(l => {
		const t = l.trim();
		return t.startsWith('#') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
		}).length;
		const codeLines = totalLines - blankLines - commentLines;

		// Extract functions/classes
		const symbols = [];
		const fnRegex = language === 'python'
		? /^(\s*)(def|class|async\s+def)\s+(\w+)/gm
		: /^(\s*)(function|class|const|let|var|export\s+(?:default\s+)?(?:function|class|const))\s+(\w+)/gm;

		let match;
		while ((match = fnRegex.exec(content)) !== null) {
		const lineNum = content.substring(0, match.index).split('\n').length;
		const indent = match[1].length;
		const kind = match[2].replace(/async\s+/, '').replace(/export\s+(?:default\s+)?/, '');
		symbols.push({ name: match[3], kind, line: lineNum, indent });
		}

		// Complexity estimate
		const branchKeywords = language === 'python'
		? ['if ', 'elif ', 'for ', 'while ', 'except ', 'with ']
		: ['if ', 'else if', 'for ', 'while ', 'catch ', 'switch ', '? ', '&&', '||'];
		let branchCount = 0;
		for (const line of lines) {
		const t = line.trim();
		for (const kw of branchKeywords) {
			if (t.startsWith(kw) || t.includes(kw)) { branchCount++; break; }
		}
		}
		const complexityScore = Math.min(100, Math.round((branchCount / Math.max(codeLines, 1)) * 200));

		// Imports
		const imports = [];
		const importRegex = language === 'python'
		? /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm
		: /^import\s+.*?from\s+['"]([^'"]+)['"]/gm;
		while ((match = importRegex.exec(content)) !== null) {
		imports.push(match[1] || match[2] || match[3]);
		}

		return {
		totalLines, blankLines, commentLines, codeLines,
		symbols, imports, branchCount, complexityScore,
		commentRatio: totalLines > 0 ? Math.round((commentLines / totalLines) * 100) : 0,
		};
	}

	function _detectLang(filename) {
		const ext = filename.split('.').pop().toLowerCase();
		const map = {
		py: 'python', js: 'javascript', ts: 'typescript', jsx: 'javascript',
		tsx: 'typescript', vue: 'vue', html: 'html', css: 'css',
		json: 'json', md: 'markdown', txt: 'text', sh: 'bash',
		sql: 'sql', yaml: 'yaml', yml: 'yaml', toml: 'toml',
		};
		return map[ext] || 'text';
	}

			return {
				addFile, getFile, getAllFiles, getFileList, getActiveFile, setActiveFile,
				getOpenTabs, openTab, closeTab, updateFileContent, applyEdit,
				getEditHistory, undoLastEdit, reapplyEdit,
				clearAll, deleteFile, analyzeCode,
			};

		function reapplyEdit(historyIndex) {
				const entry = _editHistory[historyIndex];
				if (!entry || !entry.undone) return { ok: false, error: 'Edit not available for reapply' };
				const result = applyEdit(entry.filename, entry.edit);
				if (result.ok) {
					entry.undone = false;
					delete entry.undoneAt;
				}
				return result;
			}
	})();
CodeSmith.explorer = Explorer;


		// === PAIR PROGRAMMER MODULE =================================================
		const PairProgrammer = (() => {

		 const PAIR_SYSTEM = `You are an expert pair programmer inside CodeSmith. The user shows you code and asks for changes.

				YOUR RESPONSE FORMAT:
				1. Brief explanation (1-2 sentences max)
				2. One or more EDIT BLOCKS using this exact format:

				<edit type="replace" file="{filename}" start="{line}" end="{line}">
				<old>
				exact old code
				</old>
				<new>
				replacement code
				</new>
				<reason>Why this change</reason>
				</edit>

				<edit type="add" file="{filename}" after="{line}">
				<new>
				code to insert
				</new>
				<reason>Why adding this</reason>
				</edit>

				<edit type="delete" file="{filename}" start="{line}" end="{line}">
				<reason>Why deleting</reason>
				</edit>

				CRITICAL RULES:
				- Use type="add" for INSERTING new code without removing anything. Never use "replace" with the original content embedded in newCode — that's a bug.
				- For type="replace", <old> must be the EXACT verbatim text at lines start..end (including indentation). Do NOT include surrounding context lines that aren't being changed.
				- For type="add" with after="N", code is inserted on a new line AFTER line N. Existing line N stays untouched.
				- When making multiple edits, check for variable redeclaration. If edit 1 declares "var x", edit 2 must not also declare "var x" in the same scope — use existing names or rename.
				- When inserting code into an IIFE/function/scope, ensure the insertion point is INSIDE that scope's braces. Verify by checking that surrounding lines (in the numbered code) are within the same function.
				- Multiple edits to the same file: list them top-to-bottom by line number. They will be applied bottom-up so line numbers stay valid.
				- Keep edits minimal — change only what's needed.
				- For Python: maintain PEP 8, type hints on public functions
				- For JS: use modern ES6+, const/let, arrow functions where appropriate

				WRONG EXAMPLE (do not do this):
				<edit type="replace" start="100" end="100">
				<old>console.log('hi');</old>
				<new>console.log('before');
				console.log('hi');
				console.log('after');</new>
				</edit>
				This is wrong because it should be TWO add edits (before line 100 and after line 100), not a replace that embeds the original.

				CORRECT EXAMPLE:
				<edit type="add" after="99"><new>console.log('before');</new></edit>
				<edit type="add" after="100"><new>console.log('after');</new></edit>`;

		  const ANALYSIS_SYSTEM = `You are a code analyst. Analyze the provided code and output ONLY valid JSON:
		{
		  "summary": "one-line description of what this code does",
		  "quality_score": 0-100,
		  "issues": [
			{"severity": "high|medium|low", "line": N, "message": "description", "category": "bug|performance|style|security|maintainability"}
		  ],
		  "suggestions": ["suggestion 1", "suggestion 2"],
		  "architecture_notes": "brief architecture observation",
		  "dependencies_analysis": "what this code depends on and potential concerns"
		}
		Be specific about line numbers. Focus on real issues, not style nitpicks.`;

		const ALGO_SYSTEM = `You are a code visualizer. Generate a Mermaid flowchart for the given code.
		
		STRICT SYNTAX RULES — violations cause parse errors:
		- Start with: flowchart TD
		- Nodes: A["Label text"]  (use quotes around labels)
		- Edges: A --> B  or  A -->|"label"| B
		- NEVER use -->|text|> (the > after | is INVALID)
		- NEVER use special characters in node IDs (only letters/numbers/underscores)
		- Subgraphs: subgraph name["Title"] ... end
		- Max 12 nodes per function. Summarize, don't trace every line.
		- Show: entry points, major branches (if/else), loops, returns, error paths
		- Skip: variable assignments, imports, trivial operations
		
		VALID EXAMPLE:
		flowchart TD
		  A["Start: parse_input"] --> B{"Valid format?"}
		  B -->|"Yes"| C["Process data"]
		  B -->|"No"| D["Raise ValueError"]
		  C --> E["Return result"]
		
		classDef default fill:#1a1f2a,stroke:#4f8cff,stroke-width:1px,color:#e8ecf1
		
		Output ONLY the mermaid definition. No markdown fences. No explanation.`;

		  async function analyzeWithAI(code, filename, language) {
			const result = await CodeSmith.llm.chatComplete({
			  messages: [
				{ role: 'system', content: ANALYSIS_SYSTEM },
				{ role: 'user', content: `File: ${filename} (${language})\nLines: ${code.split('\n').length}\n\n${code}` },
			  ],
			  tier: 'orchestrator',
			  temperature: 0.2,
			  maxTokens: 4000,
			});
			// Parse JSON from response
			let text = result.text.trim();
			if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
			try { return JSON.parse(text); }
			catch {
			  const s = text.indexOf('{'), e = text.lastIndexOf('}');
			  if (s >= 0 && e > s) try { return JSON.parse(text.slice(s, e + 1)); } catch {}
			  return null;
			}
		  }

		  async function* askPair(code, filename, language, question) {
			const numberedCode = code.split('\n').map((l, i) => `${i + 1}\t${l}`).join('\n');
			let docsContext = '';
			    if (language === 'python') {
			      try { docsContext = await CodeSmith.pydocs.gatherContext(code); } catch {}
			    }
			    const docsSection = docsContext ? `\n\nREFERENCE DOCS (use latest APIs from these):\n${docsContext.slice(0, 6000)}` : '';
					 // Smart routing
						const userModelChoice = document.getElementById('explorer-model-select')?.value || 'auto';
							let routing;
							try {
								routing = CodeSmith.router.route(question, userModelChoice);
							} catch (e) {
								routing = { tier: 'orchestrator', temperature: 0.2, maxTokens: 6000, reason: 'router fallback' };
							}					
						// Project context from knowledge graph
						let projectContext = '';
						try { projectContext = CodeSmith.knowledge.getProjectContext(); } catch {}
						const projectSection = projectContext ? `\n\nPROJECT CONTEXT (other files in this project):\n${projectContext.slice(0, 3000)}` : '';
					
						// Show routing decision
						const routeEl = document.getElementById('route-indicator');
						if (routeEl) {
						const modelName = CodeSmith.llm.getModelForTier(routing.tier);
						const displayName = typeof modelName === 'string' ? modelName.split('/').pop() : routing.tier;
						routeEl.innerHTML = `<span class="route-model">${displayName}</span> <span class="route-reason">— ${routing.reason}</span>`;
						routeEl.hidden = false;
						}
					
						const messages = [
						{ role: 'system', content: PAIR_SYSTEM },
						{ role: 'user', content: `File: ${filename} (${language})\n\n\`\`\`${language}\n${numberedCode}\n\`\`\`${docsSection}${projectSection}\n\nRequest: ${question}` },
						];
					
						for await (const ev of CodeSmith.llm.chat({
						messages,
						tier: routing.tier,
						temperature: routing.temperature,
						maxTokens: routing.maxTokens,
						})) {
					
			  if (ev.type === 'token') yield { type: 'token', delta: ev.delta };
			  else if (ev.type === 'thinking') yield { type: 'thinking', delta: ev.delta };
			  else if (ev.type === 'done') yield { type: 'done', text: ev.text, thinking: ev.thinking };
			  else if (ev.type === 'error') yield { type: 'error', error: ev.error };
			}
		  }

			function parseEdits(responseText) {
				const edits = [];
				const editRegex = /<edit\s+type="(\w+)"\s+file="([^"]+)"(?:\s+start="(\d+)")?(?:\s+end="(\d+)")?(?:\s+after="(\d+)")?\s*>([\s\S]*?)<\/edit>/g;
				let match;
				while ((match = editRegex.exec(responseText)) !== null) {
				const edit = {
					type: match[1],
					file: match[2],
					startLine: match[3] ? parseInt(match[3]) : null,
					endLine: match[4] ? parseInt(match[4]) : null,
					afterLine: match[5] ? parseInt(match[5]) : null,
				};
				const inner = match[6];

				const oldMatch = inner.match(/<old>\n?([\s\S]*?)\n?<\/old>/);
				const newMatch = inner.match(/<new>\n?([\s\S]*?)\n?<\/new>/);
				const reasonMatch = inner.match(/<reason>([\s\S]*?)<\/reason>/);

				if (oldMatch) edit.oldCode = oldMatch[1];
				if (newMatch) edit.newCode = newMatch[1];
				if (reasonMatch) edit.reason = reasonMatch[1].trim();

				// Pre-flight validation
				edit.warnings = [];
				if (edit.type === 'replace' && edit.oldCode && edit.newCode) {
					if (edit.newCode.includes(edit.oldCode.trim()) && edit.newCode.length > edit.oldCode.length * 1.5) {
					edit.warnings.push('newCode embeds oldCode — likely should be type="add" instead of "replace"');
					edit.suspicious = true;
					}
				}
				if (edit.type === 'add' && !edit.afterLine) {
					edit.warnings.push('add edit missing after= attribute');
					edit.suspicious = true;
				}

				edits.push(edit);
				}

				// Cross-edit validation: detect var redeclaration
				const varDecls = {};
				edits.forEach((e, i) => {
				if (!e.newCode) return;
				const decls = [...e.newCode.matchAll(/^\s*var\s+(\w+)/gm)].map(m => m[1]);
				for (const v of decls) {
					if (varDecls[v] != null) {
					e.warnings = e.warnings || [];
					e.warnings.push('var "' + v + '" already declared in edit ' + (varDecls[v] + 1));
					e.suspicious = true;
					} else {
					varDecls[v] = i;
					}
				}
				});

				return edits;
			}
		  async function generateFlowchart(code, filename, language) {
			const result = await CodeSmith.llm.chatComplete({
			  messages: [
				{ role: 'system', content: ALGO_SYSTEM },
				{ role: 'user', content: `File: ${filename} (${language})\n\n${code}` },
			  ],
			      tier: 'worker',
			      temperature: 0.1,
			      maxTokens: 3000,
			      timeoutMs: 120000,
			});
			let text = result.text.trim();
			if (text.startsWith('```')) text = text.replace(/^```(?:mermaid)?\s*\n?/, '').replace(/\n?```\s*$/, '');
			return text;
		  }

		  return { analyzeWithAI, askPair, parseEdits, generateFlowchart };
		})();
		CodeSmith.pair = PairProgrammer;
			// === PYTHON DOCS FETCHER ====================================================
		const PyDocs = (() => {
		  const _cache = {};
		
		  async function fetchPackageInfo(packageName) {
		    if (_cache[packageName]) return _cache[packageName];
		    try {
		      const resp = await fetch(`https://pypi.org/pypi/${packageName}/json`);
		      if (!resp.ok) return null;
		      const data = await resp.json();
		      const info = {
		        name: data.info.name,
		        version: data.info.version,
		        summary: data.info.summary,
		        description: (data.info.description || '').slice(0, 3000),
		        requires_python: data.info.requires_python,
		        homepage: data.info.home_page || data.info.project_url,
		      };
		      _cache[packageName] = info;
		      return info;
		    } catch { return null; }
		  }
		
		  async function getStdlibHelp(moduleName) {
		    if (_cache['stdlib_' + moduleName]) return _cache['stdlib_' + moduleName];
		    try {
		      const resp = await fetch(`https://docs.python.org/3/library/${moduleName}.html`);
		      if (!resp.ok) return null;
		      const html = await resp.text();
		      // Extract text content, strip tags, limit size
		      const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
		        .replace(/<style[\s\S]*?<\/style>/gi, '')
		        .replace(/<[^>]+>/g, ' ')
		        .replace(/\s+/g, ' ')
		        .trim()
		        .slice(0, 4000);
		      const result = { module: moduleName, docs: text };
		      _cache['stdlib_' + moduleName] = result;
		      return result;
		    } catch { return null; }
		  }
		
		  function extractImports(code) {
		    const imports = new Set();
		    const re = /^(?:from\s+(\S+)|import\s+(\S+))/gm;
		    let m;
		    while ((m = re.exec(code)) !== null) {
		      const pkg = (m[1] || m[2]).split('.')[0];
		      imports.add(pkg);
		    }
		    return Array.from(imports);
		  }
		
		  async function gatherContext(code) {
		    const imports = extractImports(code);
		    const stdlib = ['sys','os','json','re','math','datetime','collections','itertools',
		      'functools','pathlib','typing','dataclasses','enum','abc','io','csv','string',
		      'textwrap','unittest','copy','operator','contextlib','warnings','argparse',
		      'logging','hashlib','http','urllib','socket','struct','array','bisect',
		      'heapq','statistics','decimal','fractions','random','secrets','subprocess',
		      'shutil','glob','tempfile','pickle','shelve','sqlite3','xml','configparser',
		      'asyncio','threading','multiprocessing','queue','signal','time','calendar'];
		    const results = [];
		    for (const pkg of imports) {
		      if (stdlib.includes(pkg)) {
		        const doc = await getStdlibHelp(pkg);
		        if (doc) results.push(`[stdlib ${pkg}] ${doc.docs.slice(0, 2000)}`);
		      } else {
		        const info = await fetchPackageInfo(pkg);
		        if (info) results.push(`[pypi ${info.name} v${info.version}] ${info.summary}\n${info.description.slice(0, 1500)}`);
		      }
		    }
		    return results.join('\n\n---\n\n');
		  }
		
		  return { fetchPackageInfo, getStdlibHelp, extractImports, gatherContext };
		})();
		CodeSmith.pydocs = PyDocs;

			// === SMART ROUTER — picks best model per task =============================
				const SmartRouter = (() => {
				const TASK_PROFILES = {
					// Task → { tier, reason, maxTokens, temperature }
					'analyze':      { tier: 'orchestrator', reason: 'deep reasoning needed for quality analysis', maxTokens: 4000, temperature: 0.2 },
					'fix':          { tier: 'orchestrator', reason: 'bug fixing needs careful reasoning', maxTokens: 6000, temperature: 0.15 },
					'optimize':     { tier: 'orchestrator', reason: 'optimization needs architectural thinking', maxTokens: 6000, temperature: 0.2 },
					'refactor':     { tier: 'worker',       reason: 'refactoring is code transformation — worker strength', maxTokens: 8000, temperature: 0.2 },
					'tests':        { tier: 'worker',       reason: 'test generation is routine code — worker is fast', maxTokens: 8000, temperature: 0.2 },
					'docs':         { tier: 'fast',         reason: 'docstrings are formulaic — fast model is enough', maxTokens: 4000, temperature: 0.3 },
					'types':        { tier: 'fast',         reason: 'type hints follow patterns — fast model handles it', maxTokens: 4000, temperature: 0.1 },
					'explain':      { tier: 'fast',         reason: 'explanation is straightforward', maxTokens: 3000, temperature: 0.3 },
					'flowchart':    { tier: 'worker',       reason: 'Mermaid generation needs code understanding', maxTokens: 3000, temperature: 0.1 },
					'security':     { tier: 'orchestrator', reason: 'security review needs careful analysis', maxTokens: 4000, temperature: 0.1 },
					'general':      { tier: 'orchestrator', reason: 'complex query — using strongest model', maxTokens: 6000, temperature: 0.2 },
				};
				
				function classify(query) {
					const q = query.toLowerCase();
					if (/\b(bug|fix|error|crash|fail|broken|wrong|issue)\b/.test(q)) return 'fix';
					if (/\b(optimi[zs]e|perf|fast|slow|speed|efficien|bottleneck)\b/.test(q)) return 'optimize';
					if (/\b(refactor|clean|restructure|reorgani[zs]e|simplif)\b/.test(q)) return 'refactor';
					if (/\b(test|spec|assert|coverage|pytest|unittest)\b/.test(q)) return 'tests';
					if (/\b(doc|comment|docstring|jsdoc|explain|what does)\b/.test(q)) return 'docs';
					if (/\b(type|hint|annotation|typing|mypy)\b/.test(q)) return 'types';
					if (/\b(explain|how|why|what|describe|walk through)\b/.test(q)) return 'explain';
					if (/\b(flow|chart|diagram|visual|algorithm|mermaid)\b/.test(q)) return 'flowchart';
					if (/\b(secur|vulnerab|inject|xss|csrf|auth|exploit|sanitiz)\b/.test(q)) return 'security';
					if (/\b(analy[zs]e|review|audit|assess|evaluat)\b/.test(q)) return 'analyze';
					return 'general';
				}
				
				function route(query, userOverride) {
					const taskType = classify(query);
					const profile = TASK_PROFILES[taskType] || TASK_PROFILES.general;
				
					if (userOverride && userOverride !== 'auto') {
					return {
						tier: userOverride,
						taskType,
						reason: 'user selected ' + userOverride,
						maxTokens: profile.maxTokens,
						temperature: profile.temperature,
						wasOverridden: true,
					};
					}
				
					return {
					tier: profile.tier,
					taskType,
					reason: profile.reason,
					maxTokens: profile.maxTokens,
					temperature: profile.temperature,
					wasOverridden: false,
					};
				}
				
				function getTaskProfiles() { return { ...TASK_PROFILES }; }
				
				return { classify, route, getTaskProfiles };
				})();
				CodeSmith.router = SmartRouter;
				
				
				// === PROJECT KNOWLEDGE GRAPH — accumulates understanding ==================
				const ProjectKnowledge = (() => {
				let _knowledge = {
					files: {},          // { filename: { summary, language, symbols, imports, lastAnalyzed } }
					callGraph: {},      // { 'module.func': ['module2.func2', ...] }
					patterns: [],       // detected design patterns
					issues: [],         // known issues across project
					dependencies: {},   // external deps with versions
					conventions: {},    // detected coding conventions (indent, naming, etc.)
				};
				
				function learnFromFile(filename, content, language, analysisResult) {
					const symbols = [];
					const fnRegex = language === 'python'
					? /^(\s*)(def|class|async\s+def)\s+(\w+)\s*\(([^)]*)\)/gm
					: /^(\s*)(function|class|const|let|var|async\s+function)\s+(\w+)/gm;
				
					let match;
					while ((match = fnRegex.exec(content)) !== null) {
					const lineNum = content.substring(0, match.index).split('\n').length;
					const kind = match[2].replace(/async\s+/, '');
					const name = match[3];
					const params = match[4] || '';
					symbols.push({ name, kind, line: lineNum, params });
					}
				
					// Extract imports
					const imports = [];
					const importRegex = language === 'python'
					? /^(?:from\s+(\S+)\s+import\s+(.*)|import\s+(\S+))/gm
					: /^import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/gm;
					while ((match = importRegex.exec(content)) !== null) {
					imports.push({ module: match[1] || match[3] || match[6], names: match[2] || match[4] || match[5] || '' });
					}
				
					// Detect conventions
					const lines = content.split('\n');
					const indentCounts = { tab: 0, space2: 0, space4: 0 };
					for (const line of lines) {
					if (line.startsWith('\t')) indentCounts.tab++;
					else if (line.startsWith('    ')) indentCounts.space4++;
					else if (line.startsWith('  ') && !line.startsWith('    ')) indentCounts.space2++;
					}
					const indent = indentCounts.tab > indentCounts.space4 ? 'tabs' : indentCounts.space2 > indentCounts.space4 ? '2 spaces' : '4 spaces';
				
					_knowledge.files[filename] = {
					language,
					symbols,
					imports,
					lineCount: lines.length,
					indent,
					lastAnalyzed: Date.now(),
					summary: analysisResult?.summary || '',
					};
				
					// Update external dependencies
					for (const imp of imports) {
					const pkg = (imp.module || '').split('.')[0];
					if (pkg && !_isStdlib(pkg, language)) {
						_knowledge.dependencies[pkg] = _knowledge.dependencies[pkg] || { files: [] };
						if (!_knowledge.dependencies[pkg].files.includes(filename)) {
						_knowledge.dependencies[pkg].files.push(filename);
						}
					}
					}
				
					// Store AI-detected issues
					if (analysisResult?.issues) {
					_knowledge.issues = _knowledge.issues.filter(i => i.file !== filename);
					for (const issue of analysisResult.issues) {
						_knowledge.issues.push({ ...issue, file: filename });
					}
					}
				}
				
				function getProjectContext() {
					const fileCount = Object.keys(_knowledge.files).length;
					if (fileCount === 0) return '';
				
					const parts = [`Project: ${fileCount} files analyzed`];
				
					// File summaries
					for (const [name, info] of Object.entries(_knowledge.files)) {
					const symNames = info.symbols.map(s => s.kind + ' ' + s.name).join(', ');
					parts.push(`${name} (${info.language}, ${info.lineCount}L): ${info.summary || 'no summary'} — defines: ${symNames || 'none'}`);
					}
				
					// Cross-file dependencies
					const crossDeps = [];
					for (const [name, info] of Object.entries(_knowledge.files)) {
					for (const imp of info.imports) {
						const target = Object.keys(_knowledge.files).find(f => f.replace(/\.\w+$/, '') === imp.module);
						if (target) crossDeps.push(`${name} imports from ${target}: ${imp.names}`);
					}
					}
					if (crossDeps.length > 0) {
					parts.push('Cross-file imports: ' + crossDeps.join('; '));
					}
				
					// Known issues
					const highIssues = _knowledge.issues.filter(i => i.severity === 'high');
					if (highIssues.length > 0) {
					parts.push('Known high-severity issues: ' + highIssues.map(i => `${i.file}:${i.line} ${i.message}`).join('; '));
					}
				
					// Conventions
					const conventions = Object.values(_knowledge.files).map(f => f.indent);
					const commonIndent = conventions.sort((a, b) => conventions.filter(v => v === a).length - conventions.filter(v => v === b).length).pop();
					if (commonIndent) parts.push('Convention: ' + commonIndent + ' indentation');
				
					return parts.join('\n');
				}
				
				function getFileKnowledge(filename) {
					return _knowledge.files[filename] || null;
				}
				
				function getSymbolsAcrossProject() {
					const all = [];
					for (const [file, info] of Object.entries(_knowledge.files)) {
					for (const sym of info.symbols) {
						all.push({ ...sym, file });
					}
					}
					return all;
				}
				
				function getKnownIssues(filename) {
					if (filename) return _knowledge.issues.filter(i => i.file === filename);
					return _knowledge.issues.slice();
				}
				
				function getDependencies() { return { ..._knowledge.dependencies }; }
				
				function _isStdlib(pkg, language) {
					if (language !== 'python') return false;
					const stdlib = ['sys','os','json','re','math','datetime','collections','itertools',
					'functools','pathlib','typing','dataclasses','enum','abc','io','csv','string',
					'textwrap','unittest','copy','operator','contextlib','warnings','argparse',
					'logging','hashlib','http','urllib','socket','struct','array','bisect',
					'heapq','statistics','decimal','fractions','random','secrets','subprocess',
					'shutil','glob','tempfile','pickle','shelve','sqlite3','xml','configparser',
					'asyncio','threading','multiprocessing','queue','signal','time','calendar',
					'pytest','setuptools','pip'];
					return stdlib.includes(pkg);
				}
				
				function reset() {
					_knowledge = { files: {}, callGraph: {}, patterns: [], issues: [], dependencies: {}, conventions: {} };
				}
				
				return { learnFromFile, getProjectContext, getFileKnowledge, getSymbolsAcrossProject, getKnownIssues, getDependencies, reset };
				})();
				CodeSmith.knowledge = ProjectKnowledge;
	// === MONACO EDITOR MANAGER ==================================================
		const MonacoMgr = (() => {
		  let _editor = null;
		  let _diffEditor = null;
		  let _models = {};       // { filename: monaco.editor.ITextModel }
		  let _viewStates = {};   // { filename: editor.saveViewState() }
		  let _onChangeCallbacks = [];
		  let _initialized = false;
		 
		  const LANG_MAP = {
		    python: 'python', javascript: 'javascript', typescript: 'typescript',
		    html: 'html', css: 'css', json: 'json', markdown: 'markdown',
		    text: 'plaintext', bash: 'shell', sql: 'sql', yaml: 'yaml',
		    vue: 'html', jsx: 'javascript', tsx: 'typescript', toml: 'ini',
		    xml: 'xml', ini: 'ini',
		  };
		 
		  async function init(containerEl) {
		    if (_initialized && _editor) return;
			if (typeof monaco === 'undefined') {
		      // Wait for Monaco to load
			      await new Promise((resolve) => {
			        const check = setInterval(() => {
			          if (typeof monaco !== 'undefined') { clearInterval(check); resolve(); }
			        }, 100);
			        setTimeout(() => { clearInterval(check); resolve(); }, 10000);
			      });
			      if (typeof monaco === 'undefined') {
			        console.warn('[MonacoMgr] Monaco failed to load');
			        return;
			      }
			    }
		 
		    // Define CodeSmith dark theme
		    monaco.editor.defineTheme('codesmith-dark', {
		      base: 'vs-dark',
		      inherit: true,
		      rules: [
		        { token: 'comment', foreground: '5b6474', fontStyle: 'italic' },
		        { token: 'keyword', foreground: '4f8cff' },
		        { token: 'string', foreground: '4ade80' },
		        { token: 'number', foreground: 'ffb86c' },
		        { token: 'type', foreground: 'a855f7' },
		        { token: 'function', foreground: '4f8cff' },
		        { token: 'variable', foreground: 'e8ecf1' },
		        { token: 'operator', foreground: 'f59e0b' },
		        { token: 'delimiter', foreground: '8b92a1' },
		      ],
		      colors: {
		        'editor.background': '#0b0d10',
		        'editor.foreground': '#e8ecf1',
		        'editor.lineHighlightBackground': '#141820',
		        'editor.selectionBackground': '#264f78',
		        'editor.inactiveSelectionBackground': '#1a2332',
		        'editorCursor.foreground': '#4f8cff',
		        'editorLineNumber.foreground': '#3a3f4a',
		        'editorLineNumber.activeForeground': '#8b92a1',
		        'editor.selectionHighlightBackground': '#264f7833',
		        'editorIndentGuide.background': '#1a1f2a',
		        'editorIndentGuide.activeBackground': '#2a3040',
		        'editorBracketMatch.background': '#264f7844',
		        'editorBracketMatch.border': '#4f8cff55',
		        'editorGutter.background': '#0f1319',
		        'minimap.background': '#0b0d10',
		        'scrollbar.shadow': '#00000000',
		        'editorOverviewRuler.border': '#00000000',
		        'editorWidget.background': '#141820',
		        'editorWidget.border': '#1a1f2a',
		        'input.background': '#0f1319',
		        'input.border': '#1a1f2a',
		        'input.foreground': '#e8ecf1',
		        'focusBorder': '#4f8cff',
		      },
		    });
		 
		    _editor = monaco.editor.create(containerEl, {
		      value: '',
		      language: 'plaintext',
		      theme: 'codesmith-dark',
		      fontSize: 13,
		      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
		      fontLigatures: true,
		      minimap: { enabled: true, maxColumn: 80, renderCharacters: false },
		      scrollBeyondLastLine: false,
		      renderWhitespace: 'selection',
		      bracketPairColorization: { enabled: true },
		      guides: { bracketPairs: true, indentation: true },
		      folding: true,
		      foldingStrategy: 'indentation',
		      showFoldingControls: 'always',
		      lineNumbers: 'on',
		      glyphMargin: true,
		      wordWrap: 'off',
		      automaticLayout: true,
		      suggestOnTriggerCharacters: true,
		      quickSuggestions: true,
		      parameterHints: { enabled: true },
		      tabSize: 4,
		      insertSpaces: true,
		      smoothScrolling: true,
		      cursorBlinking: 'smooth',
		      cursorSmoothCaretAnimation: 'on',
		      renderLineHighlight: 'all',
		      contextmenu: true,
				mouseWheelZoom: !('ontouchstart' in window),
					padding: { top: 8 },
		    });
		 
		    // Track cursor position
		    _editor.onDidChangeCursorPosition((e) => {
		      const pos = e.position;
		      const el = document.getElementById('explorer-cursor-pos');
		      if (el) el.textContent = `Ln ${pos.lineNumber}, Col ${pos.column}`;
		    });
		 
		    // Track content changes
		    _editor.onDidChangeModelContent(() => {
		      const model = _editor.getModel();
		      if (!model) return;
		      const filename = _getFilenameForModel(model);
		      if (filename) {
		        CodeSmith.explorer.updateFileContent(filename, model.getValue());
		        for (const cb of _onChangeCallbacks) cb(filename, model.getValue());
		      }
		    });
		 
				window.addEventListener('resize', () => {
					if (_editor) _editor.layout();
					if (_diffEditor) _diffEditor.layout();
					});
				_initialized = true;
			}
		 
		  function openFile(filename, content, language) {
		    if (!_editor) return;
		    const monacoLang = LANG_MAP[language] || 'plaintext';
		 
		    // Save current view state
		    const currentModel = _editor.getModel();
		    if (currentModel) {
		      const currentFile = _getFilenameForModel(currentModel);
		      if (currentFile) _viewStates[currentFile] = _editor.saveViewState();
		    }
		 
		    // Get or create model
		    if (!_models[filename]) {
		      const uri = monaco.Uri.parse('file:///' + filename);
		      _models[filename] = monaco.editor.createModel(content, monacoLang, uri);
		    } else {
		      // Update content if changed externally
		      const model = _models[filename];
		      if (model.getValue() !== content) {
		        model.setValue(content);
		      }
		    }
		 
		    // Set model and restore view state
		    _editor.setModel(_models[filename]);
		    if (_viewStates[filename]) {
		      _editor.restoreViewState(_viewStates[filename]);
		    }
		    _editor.focus();
		 
		    // Update UI
		    const el = document.getElementById('explorer-lang-label');
		    if (el) el.textContent = monacoLang;
		    const bcEl = document.getElementById('bc-filename');
		    if (bcEl) bcEl.textContent = filename;
		    const bcParent = document.getElementById('editor-breadcrumb');
		    if (bcParent) bcParent.hidden = false;
		  }
		 
		  function updateContent(filename, newContent) {
		    if (_models[filename]) {
		      const model = _models[filename];
		      if (model.getValue() !== newContent) {
		        model.setValue(newContent);
		      }
		    }
		  }
		 
		  function closeFile(filename) {
		    if (_models[filename]) {
		      _models[filename].dispose();
		      delete _models[filename];
		      delete _viewStates[filename];
		    }
		  }
		 
		  function getEditor() { return _editor; }
		  function isInitialized() { return _initialized; }
		 
		  function setDiagnostics(filename, markers) {
		    if (!_models[filename]) return;
		    monaco.editor.setModelMarkers(_models[filename], 'codesmith', markers);
		  }
		 
		  function clearDiagnostics(filename) {
		    if (!_models[filename]) return;
		    monaco.editor.setModelMarkers(_models[filename], 'codesmith', []);
		  }
		 
		  function showDiffView(containerEl, originalContent, modifiedContent, language) {
		    if (_diffEditor) _diffEditor.dispose();
		    const monacoLang = LANG_MAP[language] || 'plaintext';
		    _diffEditor = monaco.editor.createDiffEditor(containerEl, {
		      theme: 'codesmith-dark',
		      fontSize: 12,
		      fontFamily: '"JetBrains Mono", monospace',
		      readOnly: true,
		      renderSideBySide: true,
		      automaticLayout: true,
		    });
		    _diffEditor.setModel({
		      original: monaco.editor.createModel(originalContent, monacoLang),
		      modified: monaco.editor.createModel(modifiedContent, monacoLang),
		    });
		  }
		 
		  function disposeDiff() {
		    if (_diffEditor) { _diffEditor.dispose(); _diffEditor = null; }
		  }
		 
		  function onChange(cb) { _onChangeCallbacks.push(cb); }
		 
		  function _getFilenameForModel(model) {
		    for (const [name, m] of Object.entries(_models)) {
		      if (m === model) return name;
		    }
		    return null;
		  }
		 
		  function dispose() {
		    for (const m of Object.values(_models)) m.dispose();
		    _models = {};
		    _viewStates = {};
		    if (_editor) _editor.dispose();
		    if (_diffEditor) _diffEditor.dispose();
		    _editor = null;
		    _diffEditor = null;
		    _initialized = false;
		  }
		 
		  return { init, openFile, updateContent, closeFile, getEditor, isInitialized, setDiagnostics, clearDiagnostics, showDiffView, disposeDiff, onChange, dispose };
		})();
		CodeSmith.monaco = MonacoMgr;
		 
		 
		// === INTEGRATED TERMINAL (xterm.js + Pyodide) ===============================
		const TerminalMgr = (() => {
		  let _term = null;
		  let _fitAddon = null;
		  let _initialized = false;
		  let _inputBuffer = '';
		  let _busy = false;
		 
		  async function init(containerEl) {
		    if (_initialized) return;
		    if (typeof Terminal === 'undefined') {
		      console.warn('[TerminalMgr] xterm.js not loaded');
		      return;
		    }
		 
		    _term = new Terminal({
		      theme: {
		        background: '#0b0d10',
		        foreground: '#e8ecf1',
		        cursor: '#4f8cff',
		        cursorAccent: '#0b0d10',
		        selectionBackground: '#264f78',
		        black: '#0b0d10',
		        red: '#ff6b6b',
		        green: '#4ade80',
		        yellow: '#f59e0b',
		        blue: '#4f8cff',
		        magenta: '#a855f7',
		        cyan: '#22d3ee',
		        white: '#e8ecf1',
		      },
		      fontSize: 12,
		      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
		      cursorBlink: true,
		      scrollback: 2000,
		      allowProposedApi: true,
		    });
		 
		    if (typeof FitAddon !== 'undefined') {
		      _fitAddon = new FitAddon.FitAddon();
		      _term.loadAddon(_fitAddon);
		    }
		 
		    _term.open(containerEl);
		    if (_fitAddon) _fitAddon.fit();
		 
		    _term.writeln('\x1b[34m╭─────────────────────────────────╮\x1b[0m');
		    _term.writeln('\x1b[34m│\x1b[0m  \x1b[1mCodeSmith Python Terminal\x1b[0m       \x1b[34m│\x1b[0m');
		    _term.writeln('\x1b[34m╰─────────────────────────────────╯\x1b[0m');
		    _term.writeln('');
		    _prompt();
		 
		    _term.onData((data) => {
		      if (_busy) return;
		      if (data === '\r') {
		        _term.writeln('');
		        _runCommand(_inputBuffer);
		        _inputBuffer = '';
		      } else if (data === '\x7f') {
		        if (_inputBuffer.length > 0) {
		          _inputBuffer = _inputBuffer.slice(0, -1);
		          _term.write('\b \b');
		        }
		      } else if (data === '\x03') {
		        _inputBuffer = '';
		        _term.writeln('^C');
		        _prompt();
		      } else if (data >= ' ') {
		        _inputBuffer += data;
		        _term.write(data);
		      }
		    });
		 
		    _initialized = true;
		  }
		 
		  function _prompt() {
		    _term.write('\x1b[32m>>> \x1b[0m');
		  }
		 
		  async function _runCommand(cmd) {
		    if (!cmd.trim()) { _prompt(); return; }
		    _busy = true;
		 
		    // Special commands
		    if (cmd.trim() === 'clear') {
		      _term.clear();
		      _busy = false;
		      _prompt();
		      return;
		    }
		    if (cmd.trim() === 'help') {
		      _term.writeln('\x1b[34mCommands:\x1b[0m');
		      _term.writeln('  clear     — clear terminal');
		      _term.writeln('  ls        — list files in /workdir');
		      _term.writeln('  cat FILE  — show file contents');
		      _term.writeln('  help      — show this help');
		      _term.writeln('  Any Python expression or statement');
		      _term.writeln('');
		      _busy = false;
		      _prompt();
		      return;
		    }
		    if (cmd.trim() === 'ls') {
		      try {
		        const files = await CodeSmith.sandbox.listFiles();
		        for (const f of files) _term.writeln('  ' + f);
		        if (files.length === 0) _term.writeln('  (empty)');
		      } catch (e) { _term.writeln('\x1b[31m' + e.message + '\x1b[0m'); }
		      _term.writeln('');
		      _busy = false;
		      _prompt();
		      return;
		    }
		    if (cmd.trim().startsWith('cat ')) {
		      const fname = cmd.trim().slice(4).trim();
		      try {
		        const content = await CodeSmith.sandbox.readFile('/workdir/' + fname);
		        _term.writeln(content);
		      } catch (e) { _term.writeln('\x1b[31m' + e.message + '\x1b[0m'); }
		      _term.writeln('');
		      _busy = false;
		      _prompt();
		      return;
		    }
		 
		    // Python execution
		    try {
		      await CodeSmith.sandbox.warmUp();
		      const result = await CodeSmith.sandbox.runPython(cmd, { sessionGlobals: true, timeoutMs: 15000 });
		      if (result.stdout) _term.writeln(result.stdout.replace(/\n$/, ''));
		      if (result.stderr) _term.writeln('\x1b[33m' + result.stderr.replace(/\n$/, '') + '\x1b[0m');
		      if (result.error) _term.writeln('\x1b[31m' + result.error.type + ': ' + result.error.message + '\x1b[0m');
		      if (result.result !== null && result.result !== undefined && !result.stdout) {
		        _term.writeln('\x1b[32m' + String(result.result) + '\x1b[0m');
		      }
		    } catch (e) {
		      _term.writeln('\x1b[31m' + e.message + '\x1b[0m');
		    }
		    _term.writeln('');
		    _busy = false;
		    _prompt();
		  }
		 
		  function write(text) { if (_term) _term.writeln(text); }
		  function clear() { if (_term) _term.clear(); }
		  function fit() { if (_fitAddon) _fitAddon.fit(); }
		  function isInitialized() { return _initialized; }
		 
		  return { init, write, clear, fit, isInitialized };
		})();
		CodeSmith.terminal = TerminalMgr;
		 
		 
		// === SNAPSHOT MANAGER (Version Control) =====================================
		const Snapshots = (() => {
		  let _snaps = [];  // [{ id, filename, content, label, timestamp }]
		 
		  function take(filename, content, label) {
		    const snap = {
		      id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
		      filename, content, label: label || 'Snapshot',
		      timestamp: Date.now(),
		    };
		    _snaps.push(snap);
		    return snap;
		  }
		 
		  function list(filename) {
		    if (filename) return _snaps.filter(s => s.filename === filename);
		    return _snaps.slice();
		  }
		 
		  function get(id) { return _snaps.find(s => s.id === id) || null; }
		 
		  function restore(id) {
		    const snap = get(id);
		    if (!snap) return null;
		    return { filename: snap.filename, content: snap.content };
		  }
		 
		  function diff(id1, id2) {
		    const s1 = get(id1);
		    const s2 = get(id2);
		    if (!s1 || !s2) return null;
		    return { original: s1.content, modified: s2.content, filename: s1.filename };
		  }
		 
		  function clear() { _snaps = []; }
		 
		  return { take, list, get, restore, diff, clear };
		})();
		CodeSmith.snapshots = Snapshots;
/* ============================================================================
 * 4. UI — rendering, events, modal, composer, status strip.
 *    No innerHTML with user content — textContent or element builders only.
 * ==========================================================================*/
const UI = (() => {
  // ---- tiny DOM helpers ---------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  // Clear DOM query cache on dynamic content changes
		document.addEventListener('DOMContentLoaded', () => {
			const observer = new MutationObserver(() => {
			if (typeof $ !== 'undefined' && $.clear) $.clear();
			});
			observer.observe(document.body, { childList: true, subtree: true });
		});
	function approveTestsModal(moduleId, testsCode) {
		return new Promise((resolve) => {
		const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
		const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:720px;width:90vw;' });
		modal.appendChild(el('div', { class: 'text-[14px] font-semibold mb-2' }, 'Review tests for ' + moduleId));
		modal.appendChild(el('div', { class: 'text-[11px] text-muted mb-2' }, 'Edit or accept the test cases. Tests will run after you approve.'));
		const ta = el('textarea', { class: 'escalated-editor', style: 'min-height:300px;' });
		ta.value = testsCode || '';
		modal.appendChild(ta);
		const actions = el('div', { class: 'flex items-center justify-end gap-2 mt-3' });
		const skipBtn = el('button', { class: 'btn' }, 'Skip tests');
		const cancelBtn = el('button', { class: 'btn' }, 'Cancel build');
		const approveBtn = el('button', { class: 'btn btn-primary' }, 'Approve & run');
		actions.appendChild(skipBtn);
		actions.appendChild(cancelBtn);
		actions.appendChild(approveBtn);
		modal.appendChild(actions);
		const close = (result) => { backdrop.remove(); modal.remove(); resolve(result); };
		skipBtn.addEventListener('click', () => close({ action: 'skip' }));
		cancelBtn.addEventListener('click', () => close({ action: 'cancel' }));
		approveBtn.addEventListener('click', () => close({ action: 'approve', tests: ta.value }));
		document.body.appendChild(backdrop);
		document.body.appendChild(modal);
		});
	}
  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') n.className = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k === 'aria')    for (const [ak, av] of Object.entries(v)) n.setAttribute('aria-' + ak, av);
      else if (k in n)          n[k] = v;
      else                      n.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const dayDiff = Math.floor((now - d) / 86400000);
    if (dayDiff < 7) return d.toLocaleDateString([], { weekday: 'short' }) + ' ' +
                            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  }
  function deriveTitle(messages) {
    const first = messages.find(m => m.role === 'user');
    if (!first) return 'New session';
    const t = first.content.trim().replace(/\s+/g, ' ');
    return t.length > 48 ? t.slice(0, 47) + '…' : t;
  }

  // ---- rendering ----------------------------------------------------------
  function renderSessionList() {
    const list = $('#session-list');
    list.replaceChildren();
    if (CodeSmith.state.sessions.length === 0) {
      const empty = el('div', { class: 'text-muted text-[12px] px-2 py-4 text-center' },
                       'No sessions yet');
      list.appendChild(empty);
      return;
    }
    for (const s of CodeSmith.state.sessions) {
      const active = s.id === CodeSmith.state.currentId;
      const item = el('div', {
        class: 'sess-item' + (active ? ' active' : ''),
        role: 'option',
        tabindex: '0',
        dataset: { id: String(s.id) },
        aria: { selected: active ? 'true' : 'false', label: (s.title || 'Untitled session') },
      }, [
        el('div', { class: 'sess-title' }, s.title || 'Untitled'),
        el('div', { class: 'sess-time' }, fmtTime(s.updatedAt)),
      ]);
      item.addEventListener('click', () => selectSession(s.id));
      item.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectSession(s.id); }
      });
      list.appendChild(item);
    }
  }

function renderChat() {
    const list = $('#chat-list');
    const empty = $('#chat-empty');
    if (!list) return;
    list.replaceChildren();
    const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
    if (!sess) {
      list.style.display = 'none';
      if (empty) empty.hidden = false;
      // Only disable if NOT in build mode (build mode uses Stage A input)
      if (_buildMode !== 'build') {
        $('#composer').disabled = false;
        $('#btn-send').disabled = false;
      }
      $('#st-session-id').textContent = '—';
      updatePageTitle();
      return;
    }
    list.style.display = '';
    if (empty) empty.hidden = true;
    $('#composer').disabled = false;
    $('#btn-send').disabled = false;
    $('#st-session-id').textContent = 'session #' + sess.id;

    for (const m of sess.messages) {
      const row = el('div', {
        class: 'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start'),
      });
      const col = el('div', { class: 'flex flex-col', style: 'max-width:760px;width:100%;' });

      // Thinking block (collapsible)
      if (m.thinking) {
        const tb = el('div', { class: 'thinking-block' });
        const toggle = el('button', { class: 'thinking-toggle' });
        toggle.innerHTML = '<span class="arrow" aria-hidden="true">▶</span> Reasoning';
        const body = el('div', { class: 'thinking-body' });
        body.textContent = m.thinking;
        toggle.addEventListener('click', () => {
          toggle.classList.toggle('open');
        });
        tb.appendChild(toggle);
        tb.appendChild(body);
        col.appendChild(tb);
      }

	// Bubble
		const isError = m.isError;
		      const bubbleCls = m.role === 'user' ? 'bubble bubble-user'
		                      : isError ? 'bubble bubble-error'
		                      : 'bubble bubble-assistant';
		      const bubble = el('div', { class: bubbleCls });
		      bubble.textContent = m.content;
		      col.appendChild(bubble);
		
		      // Detect code blocks in assistant messages and add Copy/Run buttons
		      if (m.role === 'assistant' && !isError && m.content && m.content.includes('```')) {
		        const codeMatch = m.content.match(/```(?:python)?\s*\n([\s\S]*?)```/);
		        if (codeMatch) {
		          const codeStr = codeMatch[1].trim();
		          const btnRow = el('div', { style: 'display:flex;gap:4px;margin-top:4px;' });
		          const copyBtn = el('button', { class: 'btn btn-ghost', style: 'font-size:10px;padding:2px 8px;' }, 'Copy code');
		          copyBtn.addEventListener('click', () => {
		            navigator.clipboard.writeText(codeStr).then(() => { copyBtn.textContent = 'Copied!'; setTimeout(() => { copyBtn.textContent = 'Copy code'; }, 1500); });
		          });
		          btnRow.appendChild(copyBtn);
		          // Run button for Python
		          const isPython = m.content.includes('```python') || !m.content.includes('```js');
		          if (isPython) {
		            const runBtn = el('button', { class: 'btn btn-ghost', style: 'font-size:10px;padding:2px 8px;' }, '▶ Run');
					runBtn.addEventListener('click', async () => {
		              runBtn.disabled = true;
		              runBtn.textContent = 'Running…';
		              try {
		                // Wrap code to handle common patterns that fail in Pyodide
		                let runCode = codeStr;
		                // Remove if __name__ == "__main__" block — just define functions
		                // and add a simple test call
		                const hasMain = runCode.includes('if __name__');
		                const hasArgv = runCode.includes('sys.argv');
		                const hasFileIO = runCode.includes('open(') && (runCode.includes('input_file') || runCode.includes('sys.argv'));
		
		                if (hasArgv || hasFileIO) {
		                  // Can't run file I/O or CLI scripts in Pyodide
		                  let outEl = btnRow.parentElement.querySelector('.inline-run-output');
		                  if (!outEl) {
		                    outEl = el('pre', { class: 'inline-run-output', style: 'font-size:11px;background:#0b0d10;padding:6px 8px;border-radius:4px;margin-top:4px;color:#f59e0b;max-height:150px;overflow:auto;white-space:pre-wrap;' });
		                    col.appendChild(outEl);
		                  }
		                  outEl.textContent = 'This code uses file I/O or sys.argv which cannot run in the browser sandbox.\nUse the Build mode to create a testable version, or copy the code to run locally.';
		                  runBtn.disabled = false;
		                  runBtn.textContent = '▶ Run';
		                  return;
		                }
		
		                const result = await CodeSmith.sandbox.runPython(runCode);
		                const out = (result.stdout || '') + (result.error ? '\n' + result.error.type + ': ' + result.error.message : '');
		                let outEl = btnRow.parentElement.querySelector('.inline-run-output');
		                if (!outEl) {
		                  outEl = el('pre', { class: 'inline-run-output', style: 'font-size:11px;background:#0b0d10;padding:6px 8px;border-radius:4px;margin-top:4px;color:#8b92a1;max-height:150px;overflow:auto;white-space:pre-wrap;' });
		                  col.appendChild(outEl);
		                }
		                outEl.textContent = out || '(no output)';
		                if (result.error) outEl.style.color = '#ff6b6b';
		                else outEl.style.color = '#4ade80';
		              } catch (err) {
		                let outEl = btnRow.parentElement.querySelector('.inline-run-output');
		                if (!outEl) {
		                  outEl = el('pre', { class: 'inline-run-output', style: 'font-size:11px;background:#0b0d10;padding:6px 8px;border-radius:4px;margin-top:4px;color:#ff6b6b;max-height:150px;overflow:auto;white-space:pre-wrap;' });
		                  col.appendChild(outEl);
		                }
		                outEl.textContent = 'Error: ' + (err.message || err);
		              } finally {
		                runBtn.disabled = false;
		                runBtn.textContent = '▶ Run';
		              }
		            });
					  
		            btnRow.appendChild(runBtn);
		          }
		          col.appendChild(btnRow);
		        }
		      }

      // Usage line
      if (m.usage && m.role === 'assistant' && !isError) {
        const uLine = el('div', { class: 'usage-line' });
        const dur = m.durationMs ? (m.durationMs / 1000).toFixed(1) + 's' : '';
        uLine.textContent = '↑ ' + (m.usage.promptTokens || 0) + '  ↓ ' + (m.usage.completionTokens || 0) + (dur ? '  ' + dur : '');
        uLine.title = 'Click for raw response details';
        uLine.addEventListener('click', () => showRawModal(m));
        col.appendChild(uLine);
      }

      // Retry button for errors
      if (isError && m.recoverable) {
        const retryBtn = el('button', { class: 'btn', style: 'margin-top:6px;font-size:12px;align-self:flex-start;' }, 'Retry');
        retryBtn.addEventListener('click', () => retryLastMessage());
        col.appendChild(retryBtn);
      }

      row.appendChild(col);
      list.appendChild(row);
    }
    // Scroll to bottom
    requestAnimationFrame(() => {
      const scroll = $('#chat-scroll');
      scroll.scrollTop = scroll.scrollHeight;
    });
	updatePageTitle();
  }

	function renderStatusStrip() {
	    const orchDot  = $('#st-orch-dot');
	    const orchText = $('#st-orch-text');
		const orchModel = CodeSmith.llm.getModelForTier('orchestrator');
		const orchDisplay = typeof orchModel === 'object' ? orchModel.model + ' (custom)' : orchModel;
		$('#st-orch-text').title = orchDisplay;
		const hasKey = !!(CodeSmith.state.settings && CodeSmith.state.settings.apiKey);
	    orchDot.classList.remove('red','green','gray','amber');
	    if (hasKey) { orchDot.classList.add('green'); orchText.textContent = 'ready'; }
	    else        { orchDot.classList.add('red');   orchText.textContent = 'no key'; }

	    // Token budget (Day 3)
	    const budget = CodeSmith.llm ? CodeSmith.llm.getBudget() : { tokensIn: 0, tokensOut: 0 };
	    const total = budget.tokensIn + budget.tokensOut;
	    const cap = (CodeSmith.state.settings && CodeSmith.state.settings.tokenBudgetCap) || 100000;
	    $('#st-tokens').textContent = total.toLocaleString() + ' / ' + cap.toLocaleString();
		
		// Update mobile indicator
		const mobOrch = document.getElementById('mob-st-orch');
		const mobPy = document.getElementById('mob-st-py');
		if (mobOrch) mobOrch.style.color = hasKey ? '#4ade80' : '#ff6b6b';
		if (mobPy) {
		  const pyLoaded = $('#st-pyodide-dot')?.classList.contains('green');
		  mobPy.style.color = pyLoaded ? '#4ade80' : '#5b6474';
		}
	  }

  function renderComposerHelp() {
    const s = CodeSmith.state.settings || {};
    $('#help-model').textContent = s.modelOrchestrator || '—';
    $('#help-api').textContent   = s.apiUrl || '—';
  }

  // ---- session actions ----------------------------------------------------
  async function refreshSessions() {
    CodeSmith.state.sessions = await CodeSmith.db.listSessions();
    renderSessionList();
  }
		async function newSession() {
			resetBuildUI();
			const sess = await CodeSmith.db.createSession();
			CodeSmith.state.sessions.unshift(sess);
			CodeSmith.state.currentId = sess.id;
			renderSessionList();
			renderChat();
			$('#composer').focus();
		}
	async function selectSession(id) {
		CodeSmith.state.currentId = id;
		const fresh = await CodeSmith.db.getSession(id);
		if (fresh) {
		const idx = CodeSmith.state.sessions.findIndex(s => s.id === id);
		if (idx >= 0) CodeSmith.state.sessions[idx] = fresh;
		// Rehydrate Stage A & B from persisted state
		if (fresh.stageA && fresh.stageA.spec) {
			CodeSmith.stageA.start(fresh.stageA.spec.goal || '');
			CodeSmith.stageA.setSpec(fresh.stageA.spec);
		}
		if (fresh.stageB && fresh.stageB.skeleton) {
			CodeSmith.stageB.setSkeleton(
			fresh.stageB.skeleton,
			fresh.stageB.approvedSpec,
			fresh.stageB.mermaidDef
			);
		}
		}
		renderSessionList();
		renderChat();
		$('#composer').focus();
	}

  async function sendMessage(text) {
    const t = text.trim();
    if (!t) return;
		// Day 4/5: Build mode routing
		    const isBuildRequest = _buildMode === 'build' || t.startsWith('/build ');
		    if (isBuildRequest) {
		      const prompt = t.startsWith('/build ') ? t.slice(7) : t;
		      if (CodeSmith.state.currentId == null) { await newSession(); }
		      const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		      if (sess) {
		        sess.messages.push({ role: 'user', content: t, ts: Date.now() });
		        sess.updatedAt = Date.now();
		        if (!sess.title || sess.title === 'New session') sess.title = deriveTitle(sess.messages);
		        await CodeSmith.db.putSession(sess);
		        renderChat();
		        renderSessionList();
		      }
		      // Re-enable composer before routing to build
		      $('#composer').disabled = false;
		      $('#btn-send').disabled = false;
		      if (_quickBuildMode) {
		        _quickBuildMode = false;
		        runBuildPipeline(prompt);
		      } else {
		        startBuildMode(prompt);
		      }
		      return;
		    }
    if (CodeSmith.state.currentId == null) { await newSession(); }
    const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
    if (!sess) return;
    const now = Date.now();

    // Push user message
    sess.messages.push({ role: 'user', content: t, ts: now });
    sess.updatedAt = now;
    if (!sess.title || sess.title === 'New session') {
      sess.title = deriveTitle(sess.messages);
    }
    renderChat();
    renderSessionList();

    // ---- Stream AI response ----
    const sendBtn = $('#btn-send');
    const composer = $('#composer');
    const abortCtrl = new AbortController();

    // Switch Send → Stop
    sendBtn.textContent = 'Stop';
    sendBtn.classList.remove('btn-primary');
    sendBtn.classList.add('btn-stop');
    composer.disabled = true;
    _currentAbort = abortCtrl;

    // Typing indicator
    const chatList = $('#chat-list');
    const typingRow = el('div', { class: 'flex justify-start', id: 'typing-row' });
    const typingEl = el('div', { class: 'typing-indicator' });
    typingEl.innerHTML = '<span></span><span></span><span></span>';
    typingRow.appendChild(typingEl);
    chatList.appendChild(typingRow);
    _scrollBottom();

    // Build messages array with system prompt
    const systemPrompt = 'You are a helpful AI assistant embedded in CodeSmith, a browser-based code-generation tool. The user has not yet started a build — answer general questions and help them think about what they want to build.';
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...sess.messages.filter(m => !m.isError).map(m => ({ role: m.role, content: m.content })),
    ];

    let fullText = '';
    let thinkingText = '';
    let usage = {};
    let stopped = false;
    let hasError = false;
    let lastError = null;
    let recoverable = false;
    const t0 = performance.now();

    // Replace typing indicator with live bubble
	let _renderPending = false;
    let _scrollPending = false;
    let liveBubble = null;
    let liveThinking = null;
    let liveRow = null;
    let liveCol = null;

    function ensureLiveBubble() {
      if (liveRow) return;
      const tr = document.getElementById('typing-row');
      if (tr) tr.remove();
      liveRow = el('div', { class: 'flex justify-start' });
      liveCol = el('div', { class: 'flex flex-col', style: 'max-width:760px;width:100%;' });
      liveBubble = el('div', { class: 'bubble bubble-assistant' });
      liveCol.appendChild(liveBubble);
      liveRow.appendChild(liveCol);
      chatList.appendChild(liveRow);
    }

    try {
      for await (const ev of CodeSmith.llm.chat({
        messages: apiMessages,
        tier: 'orchestrator',
        signal: abortCtrl.signal,
      })) {
        if (ev.type === 'thinking') {
          ensureLiveBubble();
          thinkingText += ev.delta;
          // Build thinking block if not yet present
          if (!liveThinking) {
            const tb = el('div', { class: 'thinking-block' });
            const toggle = el('button', { class: 'thinking-toggle open' });
            toggle.innerHTML = '<span class="arrow" aria-hidden="true">▶</span> Reasoning…';
            const body = el('div', { class: 'thinking-body' });
            toggle.addEventListener('click', () => toggle.classList.toggle('open'));
            tb.appendChild(toggle);
            tb.appendChild(body);
            liveCol.insertBefore(tb, liveBubble);
            liveThinking = body;
          }
          liveThinking.textContent = thinkingText;
          _scrollBottom();
			} else if (ev.type === 'token') {
	          ensureLiveBubble();
	          fullText += ev.delta;
	          if (!_renderPending) {
	            _renderPending = true;
	            requestAnimationFrame(() => {
	              liveBubble.innerHTML = renderMarkdown(fullText);
	              _renderPending = false;
	            });
	          }
	          if (!_scrollPending) {
	            _scrollPending = true;
	            requestAnimationFrame(() => { _scrollBottom(); _scrollPending = false; });
	          }
        } else if (ev.type === 'done') {
          fullText = ev.text || fullText;
          thinkingText = ev.thinking || thinkingText;
          usage = ev.usage || {};
          stopped = !!ev.stopped;
        } else if (ev.type === 'error') {
          hasError = true;
          lastError = ev.error;
          recoverable = ev.recoverable;
        }
      }
    } catch (err) {
      hasError = true;
      lastError = err;
      recoverable = false;
    }

    // Clean up typing indicator if still present
    const tr = document.getElementById('typing-row');
    if (tr) tr.remove();
    if (liveRow) liveRow.remove();

    const durationMs = performance.now() - t0;

    // Store the response
    if (hasError && !fullText) {
      sess.messages.push({
        role: 'assistant',
        content: lastError ? lastError.message : 'Request failed',
        ts: Date.now(),
        isError: true,
        recoverable,
      });
    } else {
      const content = stopped ? fullText + '\n\n[stopped by user]' : fullText;
      sess.messages.push({
        role: 'assistant',
        content,
        ts: Date.now(),
        thinking: thinkingText || undefined,
        usage,
        durationMs,
        stopped,
      });
    }

    await CodeSmith.db.putSession(sess);
    CodeSmith.state.sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // Restore button
    _currentAbort = null;
    sendBtn.textContent = 'Send';
    sendBtn.classList.remove('btn-stop');
    sendBtn.classList.add('btn-primary');
    // Re-add the send arrow SVG
    sendBtn.innerHTML = 'Send <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
    composer.disabled = false;
    composer.focus();

    renderSessionList();
    renderChat();
    renderStatusStrip();
  }

  let _currentAbort = null;

  function _scrollBottom() {
    requestAnimationFrame(() => {
      const scroll = $('#chat-scroll');
      scroll.scrollTop = scroll.scrollHeight;
    });
  }

  function showRawModal(m) {
    // Reuse settings modal pattern
    const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
    const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:640px;' });
    const header = el('div', { class: 'flex items-center justify-between mb-3' }, [
      el('div', { class: 'text-[14px] font-semibold' }, 'Response Details'),
    ]);
    const closeBtn = el('button', { class: 'iconbtn', 'aria-label': 'Close' });
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const raw = {
      role: m.role,
      content: m.content ? m.content.slice(0, 2000) : '',
      thinking: m.thinking ? m.thinking.slice(0, 500) + (m.thinking.length > 500 ? '…' : '') : undefined,
      usage: m.usage,
      durationMs: m.durationMs,
      stopped: m.stopped,
      ts: m.ts,
    };
    const pre = el('div', { class: 'raw-modal-content' });
    pre.textContent = JSON.stringify(raw, null, 2);
    modal.appendChild(pre);

    const close = () => { backdrop.remove(); modal.remove(); };
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

  async function retryLastMessage() {
    const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
    if (!sess || sess.messages.length < 2) return;
    // Remove last assistant message (the error)
    const last = sess.messages[sess.messages.length - 1];
    if (last.role === 'assistant') sess.messages.pop();
    // Remove last user message, re-send it
    const userMsg = sess.messages[sess.messages.length - 1];
    if (userMsg && userMsg.role === 'user') {
      sess.messages.pop();
      await CodeSmith.db.putSession(sess);
      renderChat();
      await sendMessage(userMsg.content);
    }
  }

  // ---- composer -----------------------------------------------------------
function wireComposer() {
    const ta = $('#composer');
    const MAX_ROWS = 8;
    function autogrow() {
      ta.style.height = 'auto';
      const cs = getComputedStyle(ta);
      const lh = parseFloat(cs.lineHeight) || 20;
      const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const max = lh * MAX_ROWS + pad;
      const next = Math.min(ta.scrollHeight, max);
      ta.style.height = next + 'px';
      ta.style.overflowY = ta.scrollHeight > max ? 'auto' : 'hidden';
    }
    ta.addEventListener('input', autogrow);
    ta.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        handleSendOrStop();
      }
    });
    // Mobile: auto-focus composer when tapping in chat area
    if (window.innerWidth <= 768) {
      $('#chat-scroll').addEventListener('click', (ev) => {
        if (ev.target === $('#chat-scroll') || ev.target === $('#chat-list')) {
          ta.focus();
        }
      });
    }
    $('#btn-send').addEventListener('click', () => {
      handleSendOrStop();
    });
    autogrow();
  }

  function handleSendOrStop() {
    // If currently streaming, abort
    if (_currentAbort) {
      _currentAbort.abort();
      return;
    }
    const ta = $('#composer');
    const v = ta.value;
    ta.value = '';
    // Reset height
    ta.style.height = 'auto';
    sendMessage(v);
    ta.focus();
  }

  // ---- settings modal -----------------------------------------------------
  let lastFocused = null;
  function populateDatalist(ids) {
    const dl = $('#models-datalist');
    dl.replaceChildren();
    for (const id of ids || []) {
      const opt = document.createElement('option');
      opt.value = id;
      dl.appendChild(opt);
    }
  }
  function renderModelsCacheInfo() {
    const s = CodeSmith.state.settings || {};
    const info = $('#models-cache-info');
    const list = s.modelsCache || [];
    const at = s.modelsCacheAt;
    if (!at || list.length === 0) {
      info.textContent = 'not fetched';
      return;
    }
    const d = new Date(at);
    const ago = Math.max(0, Math.round((Date.now() - at) / 60000));
    const when = ago < 1 ? 'just now'
               : ago < 60 ? ago + 'm ago'
               : ago < 1440 ? Math.round(ago/60) + 'h ago'
               : d.toLocaleDateString();
    info.textContent = list.length + ' models · ' + when;
  }
  function openSettings() {
    lastFocused = document.activeElement;
    const s = CodeSmith.state.settings || CodeSmith.DEFAULTS;
		$('#s-api-url').value     = s.apiUrl || '';
		$('#s-api-key').value     = s.apiKey || '';
		$('#s-model-orch').value  = s.modelOrchestrator || '';
		$('#s-model-worker').value= s.modelWorker || '';
		$('#s-model-fast').value  = s.modelFast || '';
		$('#s-collab-mode').value = s.collabMode || 'solo';
	    $('#s-max-orch').value    = s.maxTokensOrchestrator || CodeSmith.DEFAULTS.maxTokensOrchestrator;
	    $('#s-max-worker').value  = s.maxTokensWorker || CodeSmith.DEFAULTS.maxTokensWorker;
	    $('#s-max-fast').value    = s.maxTokensFast || CodeSmith.DEFAULTS.maxTokensFast;
	    $('#s-parallel-workers').value = s.parallelWorkers || CodeSmith.DEFAULTS.parallelWorkers;
	    $('#s-budget-cap').value  = s.tokenBudgetCap || CodeSmith.DEFAULTS.tokenBudgetCap;
	    $('#test-result').textContent = '';
    populateDatalist(s.modelsCache || []);
    renderModelsCacheInfo();
	  // Render endpoint list
	    _renderEndpoints(s.endpoints || []);
	    const addEpBtn = $('#btn-add-endpoint');
	    if (addEpBtn) {
	      addEpBtn.onclick = () => {
	        const list = $('#endpoint-list');
	        const idx = list.children.length;
	        list.appendChild(_createEndpointRow({ name: '', apiUrl: '', apiKey: '', model: '', forTier: 'worker' }, idx));
	      };
	    }
    $('#settings-backdrop').hidden = false;
    $('#settings-modal').hidden = false;
    // Focus first field
    setTimeout(() => $('#s-api-url').focus(), 0);
    document.addEventListener('keydown', onModalKeydown);
  }
  function closeSettings() {
    $('#settings-backdrop').hidden = true;
    $('#settings-modal').hidden = true;
    document.removeEventListener('keydown', onModalKeydown);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }
  function onModalKeydown(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); closeSettings(); return; }
    if (ev.key === 'Tab')    trapFocus(ev);
  }
  function trapFocus(ev) {
    const modal = $('#settings-modal');
    const focusables = modal.querySelectorAll(
      'button, [href], input, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }

  async function saveSettingsFromModal() {
    const prev = CodeSmith.state.settings || {};
	const _clampTokens = (v, def) => {
	      const n = parseInt(v, 10);
	      if (isNaN(n) || n < 256) return def;
	      return Math.min(n, 200000);
	    };
	    const next = {
	      apiUrl:            $('#s-api-url').value.trim() || CodeSmith.DEFAULTS.apiUrl,
	      apiKey:            $('#s-api-key').value,                     // raw — never logged
	      modelOrchestrator: $('#s-model-orch').value.trim() || CodeSmith.DEFAULTS.modelOrchestrator,
	      modelWorker:       $('#s-model-worker').value.trim() || CodeSmith.DEFAULTS.modelWorker,
	      modelFast:         $('#s-model-fast').value.trim() || CodeSmith.DEFAULTS.modelFast,
	      modelsCache:       prev.modelsCache || [],
	      modelsCacheAt:     prev.modelsCacheAt || 0,
	      endpoints:         _collectEndpoints(),
	      maxTokensOrchestrator: _clampTokens($('#s-max-orch').value, CodeSmith.DEFAULTS.maxTokensOrchestrator),
	      maxTokensWorker:       _clampTokens($('#s-max-worker').value, CodeSmith.DEFAULTS.maxTokensWorker),
	      maxTokensFast:         _clampTokens($('#s-max-fast').value, CodeSmith.DEFAULTS.maxTokensFast),
		  parallelWorkers: Math.max(1, Math.min(6, parseInt($('#s-parallel-workers').value, 10) || 1)),
	      tokenBudgetCap:        Math.max(1000, parseInt($('#s-budget-cap').value, 10) || CodeSmith.DEFAULTS.tokenBudgetCap),
		  collabMode: $('#s-collab-mode').value || 'solo',
	    };
    await CodeSmith.db.saveSettings(next);
    CodeSmith.state.settings = { ...next, id: 'app' };
    renderStatusStrip();
    renderComposerHelp();
    closeSettings();
  }

  async function runFetchModels() {
    const btn = $('#btn-fetch-models');
    const info = $('#models-cache-info');
    btn.disabled = true;
    info.textContent = 'fetching…';
    try {
      const ids = await CodeSmith.api.listModels({
        apiUrl: $('#s-api-url').value.trim(),
        apiKey: $('#s-api-key').value,
      });
      // Persist cache immediately (without disturbing unsaved form fields for models)
      const current = CodeSmith.state.settings || { ...CodeSmith.DEFAULTS };
      const updated = {
        ...current,
        apiUrl: $('#s-api-url').value.trim() || current.apiUrl,
        apiKey: $('#s-api-key').value || current.apiKey,
        modelsCache: ids,
        modelsCacheAt: Date.now(),
      };
      delete updated.id; // saveSettings re-applies it
      await CodeSmith.db.saveSettings(updated);
      CodeSmith.state.settings = { ...updated, id: 'app' };
      populateDatalist(ids);
      renderModelsCacheInfo();
      // Brief inline confirmation in the test-result slot if it's empty
      if (!$('#test-result').textContent) {
        $('#test-result').className = 'text-[12px] conn-ok';
        $('#test-result').textContent = '✓ Fetched ' + ids.length + ' model' + (ids.length === 1 ? '' : 's');
        setTimeout(() => {
          if ($('#test-result').textContent.startsWith('✓ Fetched')) {
            $('#test-result').textContent = '';
          }
        }, 4000);
      }
    } catch (err) {
      const msg = (err && err.message) ? err.message : 'Fetch failed';
      info.textContent = 'fetch failed';
      $('#test-result').className = 'text-[12px] conn-err';
      $('#test-result').textContent = '✗ ' + msg.replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 240);
    } finally {
      btn.disabled = false;
    }
  }

  async function runTestConnection() {
    const btn = $('#btn-test-conn');
    const out = $('#test-result');
    btn.disabled = true;
    out.className = 'text-[12px]';
    out.textContent = 'Testing…';
    try {
      const res = await CodeSmith.api.testConnection({
        apiUrl: $('#s-api-url').value.trim(),
        apiKey: $('#s-api-key').value,
        model:  $('#s-model-orch').value.trim(),
      });
      out.className = 'text-[12px] conn-ok';
      out.textContent = '✓ Connected' + (res.model ? ' (' + res.model + ')' : '');
    } catch (err) {
      out.className = 'text-[12px] conn-err';
      const msg = (err && err.message) ? err.message : 'Connection failed';
      // Redact any accidental key echo before display
      out.textContent = '✗ ' + msg.replace(/Bearer\s+\S+/gi, 'Bearer ***').slice(0, 200);
    } finally {
      btn.disabled = false;
    }
  }
		function resetBuildUI() {
		if (CodeSmith.stageA && CodeSmith.stageA.reset) CodeSmith.stageA.reset();
		if (CodeSmith.stageB && CodeSmith.stageB.reset) CodeSmith.stageB.reset();
		if (CodeSmith.stageC && CodeSmith.stageC.stop) { try { CodeSmith.stageC.stop(); } catch {} }
		SymbolTable.reset();
		_currentBuild = null;
		_scActiveModuleId = null;
		_scModuleData = {};
		_currentStep = 'a';
		const msgArea = $('#stage-a-messages');
		if (msgArea) msgArea.replaceChildren();
		const specCard = $('#stage-a-spec-card');
		if (specCard) specCard.replaceChildren();
		const mermaidC = $('#mermaid-container');
		if (mermaidC) mermaidC.innerHTML = '<div class="text-muted text-[13px]">No skeleton yet</div>';
		const modList = $('#stage-b-module-list');
		if (modList) modList.replaceChildren();
		const scLog = $('#sc-log');
		if (scLog) scLog.replaceChildren();
		const scModList = $('#sc-module-list');
		if (scModList) scModList.replaceChildren();
	}

			function downloadSVGAsImage(svgEl, filename) {
			if (!svgEl) return;
			const clone = svgEl.cloneNode(true);
			if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
			const bbox = svgEl.getBBox ? svgEl.getBBox() : { width: svgEl.clientWidth || 800, height: svgEl.clientHeight || 600 };
			const w = bbox.width || 800;
			const h = bbox.height || 600;
			if (!clone.getAttribute('width')) clone.setAttribute('width', w);
			if (!clone.getAttribute('height')) clone.setAttribute('height', h);
			const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			bg.setAttribute('width', '100%');
			bg.setAttribute('height', '100%');
			bg.setAttribute('fill', '#0b0d10');
			clone.insertBefore(bg, clone.firstChild);
			const svgStr = new XMLSerializer().serializeToString(clone);
			const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(svgBlob);
			a.download = filename + '.svg';
			a.click();
			URL.revokeObjectURL(a.href);
			// PNG via canvas — only works if SVG has no external resources
				const img = new Image();
				img.crossOrigin = 'anonymous';
				const url = URL.createObjectURL(svgBlob);
				img.onload = () => {
				try {
					const canvas = document.createElement('canvas');
					const scale = 2;
					canvas.width = w * scale;
					canvas.height = h * scale;
					const ctx = canvas.getContext('2d');
					ctx.fillStyle = '#0b0d10';
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					ctx.scale(scale, scale);
					ctx.drawImage(img, 0, 0, w, h);
					canvas.toBlob((blob) => {
					if (!blob) { URL.revokeObjectURL(url); return; }
					const a2 = document.createElement('a');
					a2.href = URL.createObjectURL(blob);
					a2.download = filename + '.png';
					a2.click();
					URL.revokeObjectURL(a2.href);
					URL.revokeObjectURL(url);
					}, 'image/png');
				} catch (err) {
					console.warn('[CodeSmith] PNG export blocked (tainted canvas). SVG was downloaded instead.');
					URL.revokeObjectURL(url);
				}
				};
				img.onerror = () => URL.revokeObjectURL(url);
				img.src = url;
			}

		function downloadMermaidDef(def, filename) {
			const blob = new Blob([def], { type: 'text/plain;charset=utf-8' });
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = filename + '.mmd';
			a.click();
			URL.revokeObjectURL(a.href);
		}

		function showDiagramExportMenu(anchorBtn, svgEl, mermaidDef, baseName) {
			document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
			const rect = anchorBtn.getBoundingClientRect();
			const menu = document.createElement('div');
			menu.className = 'ctx-menu';
			menu.style.left = rect.left + 'px';
			menu.style.top = (rect.bottom + 4) + 'px';
			const items = [
			{ label: '📷 Download as PNG', action: () => downloadSVGAsImage(svgEl, baseName) },
			{ label: '🎨 Download as SVG', action: () => downloadSVGAsImage(svgEl, baseName) },
			{ label: '📄 Download .mmd source', action: () => downloadMermaidDef(mermaidDef, baseName) },
			{ label: '📋 Copy Mermaid source', action: () => navigator.clipboard.writeText(mermaidDef) },
			];
			for (const item of items) {
			const row = document.createElement('div');
			row.className = 'ctx-menu-item';
			row.textContent = item.label;
			row.addEventListener('click', () => { menu.remove(); item.action(); });
			menu.appendChild(row);
			}
			document.body.appendChild(menu);
			setTimeout(() => {
			const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); } };
			document.addEventListener('click', close);
			}, 0);
		}
  // ---- wiring -------------------------------------------------------------
  function wire() {
    $('#btn-new-session').addEventListener('click', newSession);
    $('#btn-settings').addEventListener('click', openSettings);
    $('#btn-close-settings').addEventListener('click', closeSettings);
    $('#btn-cancel-settings').addEventListener('click', closeSettings);
    $('#settings-backdrop').addEventListener('click', closeSettings);
    $('#btn-save-settings').addEventListener('click', saveSettingsFromModal);
  	const resetBudgetBtn = $('#btn-reset-budget');
		if (resetBudgetBtn) resetBudgetBtn.addEventListener('click', () => {
		CodeSmith.llm.resetBudget();
		renderStatusStrip();
		resetBudgetBtn.textContent = '✓ Reset';
		setTimeout(() => { resetBudgetBtn.textContent = 'Reset usage'; }, 1500);
		});
    $('#btn-test-conn').addEventListener('click', runTestConnection);
    $('#btn-fetch-models').addEventListener('click', runFetchModels);
		$('#btn-toggle-sidebar').addEventListener('click', () => {
			const sb = $('#sidebar');
			sb.classList.toggle('collapsed');
			const backdrop = $('#sidebar-backdrop');
			if (backdrop && window.innerWidth <= 768) {
				backdrop.style.display = sb.classList.contains('collapsed') ? 'none' : 'block';
			}
			});
			const sidebarBackdrop = $('#sidebar-backdrop');
			if (sidebarBackdrop) {
			sidebarBackdrop.addEventListener('click', () => {
				$('#sidebar').classList.add('collapsed');
				sidebarBackdrop.style.display = 'none';
			});
			}
			// Auto-collapse sidebar on mobile after session select
			if (window.innerWidth <= 768) {
			$('#sidebar').classList.add('collapsed');
			}
			// Close sidebar when picking a session on mobile
			document.addEventListener('click', (ev) => {
			if (window.innerWidth <= 768 && ev.target.closest('.sess-item')) {
				$('#sidebar').classList.add('collapsed');
				const bd = $('#sidebar-backdrop');
				if (bd) bd.style.display = 'none';
			}
			});
			// Mobile: close sidebar on swipe left
			let touchStartX = 0;
			document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
			document.addEventListener('touchend', (e) => {
				const touchEndX = e.changedTouches[0].screenX;
				const diff = touchStartX - touchEndX;
				if (diff > 50 && window.innerWidth <= 768 && !$('#sidebar').classList.contains('collapsed')) {
					$('#sidebar').classList.add('collapsed');
				}
			});
    wireComposer();
	const clearSessBtn = $('#btn-clear-sessions');
	    if (clearSessBtn) clearSessBtn.addEventListener('click', async () => {
	      if (!confirm('Delete all sessions? This cannot be undone.')) return;
	      await CodeSmith.db.clearSessions();
	      CodeSmith.state.sessions = [];
	      CodeSmith.state.currentId = null;
	      renderSessionList();
	      renderChat();
	    });
	    const clearArtBtn = $('#btn-clear-artifacts');
	    if (clearArtBtn) clearArtBtn.addEventListener('click', async () => {
	      if (!confirm('Delete all artifacts? This cannot be undone.')) return;
	      await CodeSmith.db.clearArtifacts();
	      renderArtifactList();
	    });
		    wireDebugPanel(); // Day 2
			wireMode();          // Day 4
			wireStepper();       // Day 5
			wireStageC();       // Day 6
			wireOnboarding();   // Day 7
		    wireTemplates();    // Day 7
		    wireKeyboardShortcuts(); // Day 7
		    wireErrorRecovery(); // Day 7
			if ($('#btn-explorer-upload')) { try { wireExplorer(); } catch(e) { console.warn('[CodeSmith] Explorer wire skipped:', e.message); } }
	  // Help button
		    const helpBtn = $('#btn-help');
		    if (helpBtn) helpBtn.addEventListener('click', openHelp);
		  }

  // ---- debug panel (Day 2) ------------------------------------------------
  function wireDebugPanel() {
    // Ctrl+Shift+D toggle
    document.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey && ev.shiftKey && ev.key === 'D') {
        ev.preventDefault();
        const panel = $('#debug-panel');
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
          $('#debug-code').focus();
          refreshDebugStats();
        }
      }
    });

    // Close button
    $('#btn-close-debug').addEventListener('click', () => {
      $('#debug-panel').hidden = true;
    });

    // Tab switching
    for (const tab of document.querySelectorAll('.debug-tab')) {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.debug-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.debug-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        const content = document.querySelector(`.debug-tab-content[data-content="${target}"]`);
        if (content) content.classList.add('active');
        if (target === 'files') refreshDebugFiles();
        if (target === 'stats') refreshDebugStats();
      });
    }

    // Run button
    $('#btn-debug-run').addEventListener('click', async () => {
      const code = $('#debug-code').value;
      if (!code.trim()) return;
      const btn = $('#btn-debug-run');
      btn.disabled = true;
      btn.textContent = 'Running…';
      const useSession = $('#debug-session-globals').checked;
      try {
        const r = await CodeSmith.sandbox.runPython(code, { sessionGlobals: useSession });
        renderDebugResult(r);
      } catch (err) {
        renderDebugResult({
          ok: false, stdout: '', stderr: '', result: null,
          error: { type: 'InternalError', message: err.message, traceback: '' },
          durationMs: 0, stdoutTruncated: false,
        });
      } finally {
        btn.disabled = false;
        btn.textContent = 'Run';
      }
    });

    // Ctrl+Enter to run in textarea
    $('#debug-code').addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        $('#btn-debug-run').click();
      }
    });

    // Clear button
    $('#btn-debug-clear').addEventListener('click', () => {
      $('#debug-output').replaceChildren();
    });

    // Files refresh
    $('#btn-debug-refresh-files').addEventListener('click', refreshDebugFiles);
  }

  function renderDebugResult(r) {
    const out = $('#debug-output');
    out.replaceChildren();

    function addSection(label, text, cls) {
      if (!text) return;
      const lbl = document.createElement('span');
      lbl.className = 'lbl';
      lbl.textContent = label;
      out.appendChild(lbl);
      const val = document.createElement('span');
      val.className = cls;
      val.textContent = text;
      out.appendChild(val);
    }

    if (r.stdout) addSection('stdout', r.stdout, 'o-out');
    if (r.stderr) addSection('stderr', r.stderr, 'o-err');
    if (r.error) {
      addSection('error (' + r.error.type + ')', r.error.message, 'o-exc');
      if (r.error.traceback && r.error.traceback !== r.error.message) {
        addSection('traceback', r.error.traceback, 'o-exc');
      }
    }
    if (r.result !== null && r.result !== undefined) {
      addSection('result', typeof r.result === 'string' ? r.result : JSON.stringify(r.result, null, 2), 'o-ret');
    }
    if (r.stdoutTruncated) {
      addSection('note', 'stdout was truncated at 100KB', 'o-err');
    }

    // Duration
    const dur = document.createElement('span');
    dur.className = 'lbl';
    dur.textContent = (r.ok ? '✓' : '✗') + ' ' + r.durationMs.toFixed(0) + 'ms';
    dur.style.marginTop = '8px';
    dur.style.color = r.ok ? '#4ade80' : '#ff6b6b';
    out.appendChild(dur);
  }

		function _renderSpecCard(spec, assumptions) {
			const container = $('#stage-a-spec-card');
			if (!container) return;
			container.replaceChildren();
			if (!spec || typeof spec !== 'object') return;
			assumptions = assumptions || {};

			for (const [key, val] of Object.entries(spec)) {
			const div = el('div', { class: 'spec-field' });
			const label = el('div', { class: 'spec-field-label' }, key.replace(/_/g, ' '));
			div.appendChild(label);

			if (val === null || val === undefined || val === '') {
				div.appendChild(el('div', { class: 'spec-field-value empty' }, '—'));
			} else if (typeof val === 'string') {
				const valEl = el('div', { class: 'spec-field-value' });
				valEl.textContent = val;
				if (assumptions[key]) valEl.appendChild(el('span', { class: 'spec-assumed-tag' }, '(assumed)'));
				div.appendChild(valEl);
			} else if (Array.isArray(val)) {
				if (val.length === 0) {
				div.appendChild(el('div', { class: 'spec-field-value empty' }, '—'));
				} else {
				for (const item of val) {
					const itemEl = el('div', { class: 'spec-field-value', style: 'padding-left:8px;' });
					itemEl.textContent = '• ' + (typeof item === 'string' ? item : JSON.stringify(item));
					div.appendChild(itemEl);
				}
				}
			} else if (typeof val === 'object') {
				for (const [sk, sv] of Object.entries(val)) {
				const row = el('div', { style: 'display:flex;gap:6px;padding-left:8px;margin-top:2px;' });
				row.appendChild(el('span', { class: 'spec-field-label', style: 'min-width:80px;margin-bottom:0;font-size:10px;' }, sk + ':'));
				const svEl = el('span', { class: 'spec-field-value', style: 'font-size:12px;' });
				if (sv === null || sv === undefined || sv === '') {
					svEl.textContent = '—';
					svEl.classList.add('empty');
				} else {
					svEl.textContent = typeof sv === 'string' ? sv : JSON.stringify(sv);
				}
				const aKey = key + '.' + sk;
				if (assumptions[aKey]) svEl.appendChild(el('span', { class: 'spec-assumed-tag' }, '(assumed)'));
				row.appendChild(svEl);
				div.appendChild(row);
				}
			}

			container.appendChild(div);
			}
		}
  async function refreshDebugFiles() {
    const container = $('#debug-files');
    const preview = $('#debug-file-preview');
    container.replaceChildren();
    preview.style.display = 'none';

    if (!await CodeSmith.sandbox.ready()) {
      container.textContent = 'Pyodide not loaded';
      return;
    }
    const files = await CodeSmith.sandbox.listFiles();
    if (files.length === 0) {
      container.textContent = '/workdir is empty';
      return;
    }
    for (const f of files) {
      const item = document.createElement('div');
      item.className = 'debug-file-item';
      item.textContent = f;
      item.addEventListener('click', async () => {
        try {
          const content = await CodeSmith.sandbox.readFile('/workdir/' + f);
          preview.textContent = content;
          preview.style.display = 'block';
        } catch (err) {
          preview.textContent = 'Error reading file: ' + err.message;
          preview.style.display = 'block';
        }
      });
      container.appendChild(item);
    }
  }

  function refreshDebugStats() {
    const el = $('#debug-stats');
    if (!el) return;
    const s = CodeSmith.sandbox.getStats();
    if (!s.loaded) {
      el.innerHTML = 'Pyodide: <span class="val">not loaded</span>';
      return;
    }
    const uptime = s.uptimeMs > 0
      ? (s.uptimeMs < 60000
          ? (s.uptimeMs / 1000).toFixed(0) + 's'
          : (s.uptimeMs / 60000).toFixed(1) + 'min')
      : '—';
    // Using textContent + manual DOM to avoid innerHTML with any user data
    el.replaceChildren();
    const lines = [
      ['Pyodide version', s.version],
      ['Python', s.pythonVersion || '?'],
      ['Uptime', uptime],
      ['Installed packages', s.installedPackages.length > 0 ? s.installedPackages.join(', ') : 'none'],
    ];
    for (const [label, value] of lines) {
      const div = document.createElement('div');
      div.textContent = label + ': ';
      const span = document.createElement('span');
      span.className = 'val';
      span.textContent = value;
      div.appendChild(span);
      el.appendChild(div);
    }
  }

// ---- Day 4: Build mode + panel -----------------------------------------
  let _buildMode = 'chat';
  let _currentBuild = null; // { spec, workerResult, attempt, status, output, moduleName }

		function wireMode() {
			for (const btn of document.querySelectorAll('.mode-btn')) {
			    btn.addEventListener('click', () => {
			      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
			      btn.classList.add('active');
			     _buildMode = btn.dataset.mode;
					$('#split-right').hidden = _buildMode !== 'build' && _buildMode !== 'explore';
					document.body.classList.toggle('build-mode', _buildMode === 'build' || _buildMode === 'explore');
					if (_buildMode === 'explore') {
					// Hide build panels, show explorer
					$('#stage-a-panel').hidden = true;
					$('#stage-a-panel').style.display = 'none';
					$('#stage-b-panel').hidden = true;
					$('#stage-c-panel').hidden = true;
					$('#stage-c-panel').style.display = 'none';
					$('#stage-e-panel').hidden = false;
					$('#stage-e-panel').style.display = 'flex';
					document.querySelector('.build-stepper').style.display = 'none';
					} else {
					$('#stage-e-panel').hidden = true;
					$('#stage-e-panel').style.display = 'none';
					document.querySelector('.build-stepper').style.display = '';
					}
					if (_buildMode === 'build') {
			        _showStep(_currentStep);
			        // Auto-focus Stage A input if we're on Stage A
			        if (_currentStep === 'a') setTimeout(() => $('#stage-a-input').focus(), 100);
			      }
			    });
			}
			// Mobile: add floating action button for quick mode switch
			if (window.innerWidth <= 768) {
				const fab = document.createElement('button');
				fab.id = 'mobile-mode-fab';
				fab.innerHTML = '⚡';
				fab.style.cssText = 'position:fixed;bottom:72px;right:16px;width:48px;height:48px;border-radius:50%;background:#4f8cff;color:#0b0d10;border:none;font-size:20px;z-index:45;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(79,140,255,0.4);';
				fab.addEventListener('click', () => {
					const modes = ['chat', 'build', 'explore'];
					const currentIdx = modes.indexOf(_buildMode);
					const nextMode = modes[(currentIdx + 1) % modes.length];
					document.querySelector('.mode-btn[data-mode="' + nextMode + '"]')?.click();
				});
				document.body.appendChild(fab);
			}

		// Build tabs (Day 4 - Stage C tabs)
		for (const tab of document.querySelectorAll('.build-tab')) {
		  tab.addEventListener('click', () => {
			document.querySelectorAll('.build-tab').forEach(t => t.classList.remove('active'));
			document.querySelectorAll('.build-content').forEach(c => { c.hidden = true; c.classList.remove('active'); });
			tab.classList.add('active');
			const target = tab.dataset.btab;
			const content = document.querySelector(`.build-content[data-bcontent="${target}"]`);
			if (content) { content.hidden = false; content.classList.add('active'); }
		  });
		}

		// Spec toggle (Day 4 - Stage C)
		const specBtn = $('#spec-toggle-btn');
		if (specBtn) {
		  specBtn.addEventListener('click', (ev) => {
			if (ev.target.id === 'btn-edit-spec' || ev.target.closest('#btn-edit-spec')) return;
			specBtn.classList.toggle('open');
		  });
		}
		const editSpecBtn = $('#btn-edit-spec');
		if (editSpecBtn) {
		  editSpecBtn.addEventListener('click', (ev) => {
			ev.stopPropagation();
			if (_currentBuild && _currentBuild.spec) openSpecEditor(_currentBuild.spec);
		  });
		}

		// Run button (Day 4 - Stage C)
		$('#btn-build-run').addEventListener('click', () => {
		  if (_currentBuild && _currentBuild.status === 'escalated') {
			rerunEscalated();
		  }
		});

		// Download button
		$('#btn-build-download').addEventListener('click', downloadArtifact);
	  }

  function setBuildBadge(status) {
    const badge = $('#build-badge');
    badge.className = 'build-badge badge-' + status;
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  function updateBuildPanel(data) {
    if (!data) return;
    _currentBuild = data;
    $('#build-module-name').textContent = data.moduleName || '—';
    setBuildBadge(data.status || 'draft');
    $('#build-attempts').textContent = data.attempt ? 'attempt ' + data.attempt : '';

    if (data.spec) {
      $('#build-spec-card').hidden = false;
      $('#build-spec-body').textContent = JSON.stringify(data.spec, null, 2);
    }

	if (data.code) {
	      const codeEl = $('#build-code-display');
	      codeEl.textContent = data.code;
	      if (window.hljs) {
	        delete codeEl.dataset.highlighted;
	        codeEl.className = 'language-python';
	        hljs.highlightElement(codeEl);
	      }
	    }
	    if (data.tests) {
	      const testsEl = $('#build-tests-display');
	      testsEl.textContent = data.tests;
	      if (window.hljs) {
	        delete testsEl.dataset.highlighted;
	        testsEl.className = 'language-python';
	        hljs.highlightElement(testsEl);
	      }
	    }
    if (data.output != null) {
      $('#build-output-display').textContent = data.output;
    }

    // Enable/disable buttons
    $('#btn-build-run').disabled = !data.moduleName || data.status === 'running' || data.status === 'repairing';
    $('#btn-build-download').disabled = !data.code;

    // If escalated, make code/tests editable
    if (data.status === 'escalated') {
      _makeEditable();
      $('#btn-build-run').disabled = false;
      $('#btn-build-run').textContent = 'Rerun';
    }
  }

  function _makeEditable() {
    const codePane = $('#build-code');
    const testsPane = $('#build-tests');
    if (codePane.querySelector('.escalated-editor')) return; // already editable

    codePane.replaceChildren();
    const codeTA = el('textarea', { class: 'escalated-editor', id: 'edit-code' });
    codeTA.value = _currentBuild.code || '';
    codePane.appendChild(codeTA);

    testsPane.replaceChildren();
    const testsTA = el('textarea', { class: 'escalated-editor', id: 'edit-tests' });
    testsTA.value = _currentBuild.tests || '';
    testsPane.appendChild(testsTA);
  }

  async function rerunEscalated() {
    if (!_currentBuild) return;
    const codeTA = $('#edit-code');
    const testsTA = $('#edit-tests');
    const code = codeTA ? codeTA.value : _currentBuild.code;
    const tests = testsTA ? testsTA.value : _currentBuild.tests;
    const modName = _currentBuild.moduleName;

    setBuildBadge('running');

    // Write files
    await CodeSmith.sandbox.writeFile('/workdir/' + modName + '.py', code);
    await CodeSmith.sandbox.writeFile('/workdir/test_' + modName + '.py', tests);

    // Run pytest
    const pytestCode = `
import sys, os
sys.path.insert(0, '/workdir')
os.chdir('/workdir')
# Clear cached modules to pick up edits
for mod in list(sys.modules):
    if mod == '${modName}' or mod.startswith('${modName}.'):
        del sys.modules[mod]
import pytest
exit_code = pytest.main(['-v', '/workdir/test_${modName}.py', '--tb=short', '--no-header'])
`;
    const result = await CodeSmith.sandbox.runPython(pytestCode, { sessionGlobals: true, timeoutMs: 30000 });
    const output = (result.stdout || '') + (result.stderr || '');
    const passed = /(\d+)\s+passed/.test(output) && !/failed/.test(output);

    _currentBuild.code = code;
    _currentBuild.tests = tests;
    _currentBuild.output = output;
    _currentBuild.status = passed ? 'passed' : 'failed';
    _currentBuild.attempt++;
    updateBuildPanel(_currentBuild);

    if (passed) await saveArtifact(_currentBuild);
  }

	async function runBuildPipeline(userPrompt) {
	    // Day 4 single-block build — works WITHOUT skeleton
	    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
	    document.querySelector('.mode-btn[data-mode="build"]').classList.add('active');
	    _buildMode = 'build';
	    $('#split-right').hidden = false;
	    $('#split-left').style.maxWidth = '50%';
	
	    // Show Stage C panel directly
	    _showStep('c');
	
	    // Reset build panel
	    _currentBuild = { status: 'running', attempt: 0, moduleName: '', spec: null, code: '', tests: '', output: '' };
	    updateBuildPanel(_currentBuild);
	
	    // Consume build events from Day 4 builder
	    for await (const ev of CodeSmith.builder.buildBlock(userPrompt)) {
	      switch (ev.type) {
	        case 'spec_start':
	          setBuildBadge('running');
	          _currentBuild.output += 'Generating spec…\n';
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'spec':
	          _currentBuild.spec = ev.spec;
	          _currentBuild.moduleName = ev.spec.module_name;
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'worker_start':
	          setBuildBadge('running');
	          _currentBuild.output += 'Worker generating code…\n';
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'worker_stream':
	          break;
	        case 'worker_done':
	          _currentBuild.code = ev.result.code;
	          _currentBuild.tests = ev.result.tests || '';
	          _currentBuild.attempt = ev.attempt;
	          _currentBuild.workerResult = ev.result;
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'install_package':
	          _currentBuild.output += 'Installing ' + ev.name + '…\n';
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'tests_start':
	          setBuildBadge('running');
	          _currentBuild.output += '\n--- Running tests (attempt ' + ev.attempt + ') ---\n';
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'tests_done':
	          _currentBuild.output += ev.output + '\n';
	          if (ev.errorOutput) _currentBuild.output += ev.errorOutput + '\n';
	          _currentBuild.output += 'Passed: ' + ev.passCount + '  Failed: ' + ev.failCount + '\n';
	          if (!ev.passed) setBuildBadge('failed');
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'repair_start':
	          setBuildBadge('repairing');
	          _currentBuild.output += '\n--- Repair attempt ' + ev.attempt + ' ---\n';
	          _currentBuild.attempt = ev.attempt;
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'success':
	          _currentBuild.status = 'passed';
	          setBuildBadge('passed');
	          updateBuildPanel(_currentBuild);
	          await saveArtifact(_currentBuild);
	          break;
	        case 'escalated':
	          _currentBuild.status = 'escalated';
	          _currentBuild.output += '\n--- Escalated after ' + ev.attempt + ' attempts ---\n';
	          setBuildBadge('escalated');
	          updateBuildPanel(_currentBuild);
	          break;
	        case 'error':
	          _currentBuild.status = 'failed';
	          _currentBuild.output += '\n[Error in ' + ev.stage + '] ' + (ev.error ? ev.error.message : '') + '\n';
	          setBuildBadge('failed');
	          updateBuildPanel(_currentBuild);
	          break;
	      }
	    }
	  }

			async function saveArtifact(build) {
				const skeleton = CodeSmith.stageB ? CodeSmith.stageB.getSkeleton() : null;
				const artifact = {
				id: (build.moduleName || 'module') + '_' + Date.now(),
				sessionId: CodeSmith.state.currentId,
				moduleName: build.moduleName,
				code: build.code,
				tests: build.tests,
				spec: build.spec,
				skeleton: skeleton,
				createdAt: Date.now(),
				status: build.status,
				};
				await CodeSmith.db.putArtifact(artifact);
				renderArtifactList();
			}

		async function renderArtifactList() {
			const list = $('#artifact-list');
			if (!list) return;
			list.replaceChildren();
			let artifacts;
			try { artifacts = await CodeSmith.db.listArtifacts(); } catch { return; }
			if (artifacts.length === 0) {
			list.appendChild(el('div', { class: 'text-muted text-[11px] px-2 py-2 text-center' }, 'No artifacts'));
			return;
			}
			for (const a of artifacts) {
			const item = el('div', { class: 'artifact-item' }, [
				el('span', { class: 'art-name' }, a.moduleName),
				el('span', { class: 'art-status' }, a.status + ' · ' + fmtTime(a.createdAt)),
			]);
			item.addEventListener('click', () => loadArtifact(a));
			list.appendChild(item);
			}
		}

		function loadArtifact(a) {
			// Switch to build mode full screen
			document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
			document.querySelector('.mode-btn[data-mode="build"]').classList.add('active');
			_buildMode = 'build';
			$('#split-right').hidden = false;
			$('#split-left').style.display = 'none';
			document.body.classList.add('build-mode');

			// Hide explorer
			$('#stage-e-panel').hidden = true;
			if ($('#stage-e-panel')) $('#stage-e-panel').style.display = 'none';
			document.querySelector('.build-stepper').style.display = '';

			// Show Stage C directly
			_showStep('c');

			_currentBuild = {
			moduleName: a.moduleName,
			spec: a.spec,
			code: a.code,
			tests: a.tests,
			status: a.status,
			output: '',
			attempt: 0,
			};
			updateBuildPanel(_currentBuild);

			// Also populate Stage C center panel
			const codeEl = $('#sc-code-display');
			if (codeEl) {
			codeEl.textContent = a.code || '';
			if (window.hljs) { delete codeEl.dataset.highlighted; codeEl.className = 'language-python'; hljs.highlightElement(codeEl); }
			}
			const testsEl = $('#sc-tests-display');
			if (testsEl) {
			testsEl.textContent = a.tests || '';
			if (window.hljs) { delete testsEl.dataset.highlighted; testsEl.className = 'language-python'; hljs.highlightElement(testsEl); }
			}
			const nameEl = $('#sc-active-name');
			if (nameEl) nameEl.textContent = a.moduleName || '—';
			const badge = $('#sc-active-badge');
			if (badge) { badge.className = 'build-badge badge-' + (a.status || 'draft'); badge.textContent = a.status || 'draft'; }
		}

  async function downloadArtifact() {
    if (!_currentBuild || !_currentBuild.code) return;
    if (typeof JSZip === 'undefined') { alert('JSZip not loaded'); return; }
    const zip = new JSZip();
    const name = _currentBuild.moduleName || 'module';
    zip.file(name + '.py', _currentBuild.code);
    if (_currentBuild.tests) zip.file('test_' + name + '.py', _currentBuild.tests);
    if (_currentBuild.spec) zip.file('spec.json', JSON.stringify(_currentBuild.spec, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name + '.zip'; a.click();
    URL.revokeObjectURL(url);
  }
	function _openSkeletonEditor(skel) {
		const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
		const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:720px;width:90vw;' });
		modal.appendChild(el('div', { class: 'text-[14px] font-semibold mb-2' }, 'Edit Skeleton JSON'));
		modal.appendChild(el('div', { class: 'text-[11px] text-muted mb-2' }, 'Modify the skeleton structure. Saving regenerates the diagram.'));
		const ta = el('textarea', { class: 'json-editor', style: 'min-height:400px;' });
		ta.value = JSON.stringify(skel, null, 2);
		modal.appendChild(ta);
		const errDiv = el('div', { class: 'json-error' });
		modal.appendChild(errDiv);
		const actions = el('div', { class: 'flex items-center justify-end gap-2 mt-3' });
		const cancelBtn = el('button', { class: 'btn' }, 'Cancel');
		const saveBtn = el('button', { class: 'btn btn-primary' }, 'Save');
		actions.appendChild(cancelBtn);
		actions.appendChild(saveBtn);
		modal.appendChild(actions);
		const close = () => { backdrop.remove(); modal.remove(); };
		cancelBtn.addEventListener('click', close);
		backdrop.addEventListener('click', close);
		saveBtn.addEventListener('click', async () => {
		try {
			const parsed = JSON.parse(ta.value);
			if (!parsed.modules || !Array.isArray(parsed.modules)) throw new Error('modules array required');
			if (!parsed.build_order || !Array.isArray(parsed.build_order)) throw new Error('build_order array required');
			CodeSmith.stageB.setSkeleton(parsed, CodeSmith.stageB.getApprovedSpec(), '');
			// Re-render
			const container = $('#mermaid-container');
			container.innerHTML = '';
			const def = CodeSmith.stageB.getMermaidDef();
			const div = document.createElement('div');
			div.className = 'mermaid';
			div.textContent = def;
			container.appendChild(div);
			try { await mermaid.run({ nodes: [div] }); } catch {}
			_renderModuleList(parsed);
			await _persistStageState();
			close();
		} catch (err) {
			errDiv.textContent = 'Invalid: ' + err.message;
		}
		});
		document.body.appendChild(backdrop);
		document.body.appendChild(modal);
	}
  function openSpecEditor(spec) {
    const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
    const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:640px;' });
    const header = el('div', { class: 'flex items-center justify-between mb-3' }, [
      el('div', { class: 'text-[14px] font-semibold' }, 'Edit Spec'),
    ]);
    const closeBtn = el('button', { class: 'iconbtn', 'aria-label': 'Close' });
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const ta = el('textarea', { class: 'json-editor' });
    ta.value = JSON.stringify(spec, null, 2);
    modal.appendChild(ta);

    const errDiv = el('div', { class: 'json-error', id: 'json-edit-error' });
    modal.appendChild(errDiv);

    const actions = el('div', { class: 'flex items-center justify-end gap-2 mt-3' });
    const cancelBtn = el('button', { class: 'btn' }, 'Cancel');
    const saveBtn = el('button', { class: 'btn btn-primary' }, 'Save');
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    modal.appendChild(actions);

    const close = () => { backdrop.remove(); modal.remove(); };
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);

	saveBtn.addEventListener('click', () => {
		  try {
			const parsed = JSON.parse(ta.value);
			if (!parsed.module_name && !parsed.goal) throw new Error('module_name or goal is required');
			// Update Stage A spec if we're in requirements phase
			if (_currentStep === 'a' && CodeSmith.stageA) {
			  CodeSmith.stageA.setSpec(parsed);
			  _renderSpecCard(parsed, CodeSmith.stageA.getAssumptions());
			}
			// Also update current build if present
			if (_currentBuild) {
			  _currentBuild.spec = parsed;
			  if (parsed.module_name) _currentBuild.moduleName = parsed.module_name;
			  updateBuildPanel(_currentBuild);
			}
			close();
		  } catch (err) {
			errDiv.textContent = 'Invalid JSON: ' + err.message;
		  }
		});

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }
  
	  // ---- Day 5: Stage A/B UI wiring ----------------------------------------
	  let _currentStep = 'a';  // 'a' | 'b' | 'c'
	  let _stageARunning = false;
	  let _quickBuildMode = false;
	  function wireStepper() {
		// Make stepper items clickable for back-navigation
		    for (const si of document.querySelectorAll('.step-item')) {
		      si.style.cursor = 'pointer';
		      si.addEventListener('click', () => {
		        const target = si.dataset.step;
		        // Can go back to any completed step, or stay on current
		        if (target <= _currentStep) {
		          if (target === 'a' && _currentStep === 'b') {
		            // Going back to A from B
		            _showStep('a');
		            _renderSpecCard(CodeSmith.stageA.getSpec(), CodeSmith.stageA.getAssumptions());
		      		 // Pre-fill spec card with goal
					// Always render spec card with current data
					    _renderSpecCard(CodeSmith.stageA.getSpec(), {});
					}
				} else if (target === 'b' && _currentStep === 'c') {
			            _showStep('b');
			          } else {
			            _showStep(target);
			          }
			        });
			      }
		    }
		  // Quick build button
		$('#btn-quick-build').addEventListener('click', () => {
			  _quickBuildMode = true;
			  _showStep('c');
			  // Prompt is taken from composer; next sendMessage in build mode goes straight to Day 4 pipeline
			});

		// Skip to skeleton
		$('#btn-skip-to-skeleton').addEventListener('click', () => {
		  CodeSmith.stageA.requestAdvance();
		  _transitionToB();
		});

		// Stage A send
		$('#btn-stage-a-send').addEventListener('click', () => _stageASend());
		$('#stage-a-input').addEventListener('keydown', (ev) => {
		  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); _stageASend(); }
		});

		// Stage A edit spec
		$('#btn-edit-spec-a').addEventListener('click', () => {
		  openSpecEditor(CodeSmith.stageA.getSpec());
		});

		// Stage B buttons
		$('#btn-b-approve').addEventListener('click', async () => {
			  const skel = CodeSmith.stageB.approve();
			  if (!skel) return;
				// Force spec card refresh with latest data
				_renderSpecCard(CodeSmith.stageA.getSpec(), CodeSmith.stageA.getAssumptions());
				await _persistStageState();
			  _showStep('c');
			  // Day 6: Stage C handles multi-module build; auto-start
			  _scRenderModuleList();
			  _scUpdateProgress();
			});

		$('#btn-b-regenerate').addEventListener('click', () => {
		  _generateSkeleton();
		});
		$('#btn-b-export-json').addEventListener('click', () => {
		const skel = CodeSmith.stageB.getSkeleton();
		const spec = CodeSmith.stageB.getApprovedSpec() || CodeSmith.stageA.getSpec();
		if (!skel) return;
		const bundle = { version: 1, spec, skeleton: skel, mermaidDef: CodeSmith.stageB.getMermaidDef(), exportedAt: Date.now() };
		const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = (skel.summary || 'skeleton').slice(0, 30).replace(/\W+/g, '_') + '.skeleton.json';
		a.click();
		URL.revokeObjectURL(a.href);
		});

		$('#btn-b-import-json').addEventListener('click', () => $('#b-import-file').click());
		$('#b-import-file').addEventListener('change', async (ev) => {
		const file = ev.target.files[0];
		if (!file) return;
		try {
			const text = await file.text();
			const bundle = JSON.parse(text);
			if (!bundle.skeleton || !bundle.skeleton.modules) throw new Error('Invalid skeleton bundle');
			if (bundle.spec) {
			CodeSmith.stageA.setSpec(bundle.spec);
			_renderSpecCard(bundle.spec, {});
			}
			CodeSmith.stageB.setSkeleton(bundle.skeleton, bundle.spec, bundle.mermaidDef);
			_showStep('b');
			// Re-render the mermaid + module list
			const container = $('#mermaid-container');
			container.innerHTML = '';
			const def = bundle.mermaidDef || CodeSmith.stageB.getMermaidDef();
			const div = document.createElement('div');
			div.className = 'mermaid';
			div.textContent = def;
			container.appendChild(div);
			try { await mermaid.run({ nodes: [div] }); } catch {}
			_renderModuleList(bundle.skeleton);
			await _persistStageState();
		} catch (err) {
			alert('Import failed: ' + err.message);
		}
		ev.target.value = '';
		});

		$('#btn-b-edit-json').addEventListener('click', () => {
		const skel = CodeSmith.stageB.getSkeleton();
		if (!skel) return;
		_openSkeletonEditor(skel);
		});
		$('#btn-b-export').addEventListener('click', (ev) => {
			const svg = $('#mermaid-container').querySelector('svg');
			const def = CodeSmith.stageB.getMermaidDef();
			const skel = CodeSmith.stageB.getSkeleton();
			const name = (skel && skel.summary) ? skel.summary.slice(0, 30).replace(/\W+/g, '_') : 'skeleton';
			showDiagramExportMenu(ev.target, svg, def, name);
			});
		$('#btn-b-changes').addEventListener('click', () => {
		  const changePrompt = prompt('What would you like to change?');
		  if (!changePrompt) return;
		  // Go back to A with the change request
		  _showStep('a');
		  CodeSmith.stageA.setSpec(CodeSmith.stageA.getSpec()); // keep current
		  _stageAHandleUserInput(changePrompt);
		});
	  
	function _showStep(step) {
	    _currentStep = step;
	    document.querySelectorAll('.step-item').forEach(si => {
	      si.classList.remove('active', 'done');
	      const s = si.dataset.step;
	      if (s === step) si.classList.add('active');
	      else if (s < step) si.classList.add('done');
	    });
	
	    $('#stage-a-panel').hidden = step !== 'a';
	    $('#stage-a-panel').style.display = step === 'a' ? '' : 'none';
	    $('#stage-b-panel').hidden = step !== 'b';
	    $('#stage-c-panel').hidden = step !== 'c';
	    $('#stage-c-panel').style.display = step === 'c' ? 'flex' : 'none';
	  }

	  function startBuildMode(userPrompt) {
		// Switch to build mode
		document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
		document.querySelector('.mode-btn[data-mode="build"]').classList.add('active');
		_buildMode = 'build';
		$('#split-right').hidden = false;
		$('#split-left').style.maxWidth = '50%';
		const target = window._getTargetType ? window._getTargetType() : 'python';
		const targetLabel = window._getTargetLabel ? window._getTargetLabel() : 'Python program';
		const taggedPrompt = `[target_type=${target}] [output_format=${targetLabel}] ${userPrompt}`;
		// Start Stage A
		CodeSmith.stageA.start(taggedPrompt);
		_showStep('a');
		_renderSpecCard(CodeSmith.stageA.getSpec(), CodeSmith.stageA.getAssumptions());

		// Add initial system question
		const initMsg = el('div', { class: 'flex justify-start' });
		const bubble = el('div', { class: 'bubble bubble-assistant', style: 'font-size:13px;max-width:400px;' });
		bubble.textContent = 'I\'ll help you define the requirements. Let me start by understanding what you want to build.';
		initMsg.appendChild(bubble);
		$('#stage-a-messages').replaceChildren(initMsg);

		// Send the initial prompt as the first user turn
		_stageAHandleUserInput(taggedPrompt);
	  }

		async function _stageASend() {
		    const input = $('#stage-a-input');
		    if (!input) return;
		    const text = input.value.trim();
		    if (!text) return;
		    if (_stageARunning) return;
		    input.value = '';
		    input.style.height = 'auto';
		    try {
		      await _stageAHandleUserInput(text);
		    } catch (err) {
		      _stageARunning = false;
		      console.error('[StageA] Error:', err);
		    }
		  }

			async function _stageAHandleUserInput(text) {
		    _stageARunning = true;
		    const msgArea = $('#stage-a-messages');
		
		    const userRow = el('div', { class: 'flex justify-end' });
		    const userBubble = el('div', { class: 'bubble bubble-user', style: 'font-size:13px;max-width:400px;' });
		    userBubble.textContent = text;
		    userRow.appendChild(userBubble);
		    msgArea.appendChild(userRow);
		
		    const typingRow = el('div', { class: 'flex justify-start' });
		    const typingEl = el('div', { class: 'typing-indicator' });
		    typingEl.innerHTML = '<span></span><span></span><span></span>';
		    typingRow.appendChild(typingEl);
		    msgArea.appendChild(typingRow);
		    msgArea.scrollTop = msgArea.scrollHeight;
		
		    try {
		      for await (const ev of CodeSmith.stageA.userTurn(text)) {
		       if (ev.type === 'thinking_delta' || ev.type === 'token_delta') {
					// Show streaming text in a live bubble
					if (typingRow.parentNode) typingRow.remove();
					if (!msgArea._liveBubble) {
						const aiRow = el('div', { class: 'flex justify-start' });
						const aiBubble = el('div', { class: 'bubble bubble-assistant', style: 'font-size:13px;max-width:400px;' });
						aiRow.appendChild(aiBubble);
						msgArea.appendChild(aiRow);
						msgArea._liveBubble = aiBubble;
						msgArea._liveRow = aiRow;
					}
					if (ev.type === 'token_delta') {
						msgArea._liveBubble.textContent += ev.delta;
					}
					msgArea.scrollTop = msgArea.scrollHeight;
					continue;
					} else if (ev.type === 'spec_updated' || ev.type === 'question_final' || ev.type === 'question' || ev.type === 'ready' || ev.type === 'error') {
					// Clear live bubble before showing final message
					if (msgArea._liveBubble) {
						if (msgArea._liveRow) msgArea._liveRow.remove();
						msgArea._liveBubble = null;
						msgArea._liveRow = null;
					}
					}
						if (ev.type === 'spec_updated') {
							_renderSpecCard(ev.spec, CodeSmith.stageA.getAssumptions());
							const specBody = $('#build-spec-body');
							if (specBody) specBody.textContent = JSON.stringify(ev.spec, null, 2);
							// Also update the live spec card in Stage A
							const stageASpecCard = $('#stage-a-spec-card');
							if (stageASpecCard) {
							_renderSpecCard(ev.spec, CodeSmith.stageA.getAssumptions());
							}
						
		        } else if (ev.type === 'question' || ev.type === 'question_final') {
		          if (typingRow.parentNode) typingRow.remove();
		          const aiRow = el('div', { class: 'flex justify-start' });
		          const aiBubble = el('div', { class: 'bubble bubble-assistant', style: 'font-size:13px;max-width:400px;' });
		          aiBubble.textContent = ev.text;
		          aiRow.appendChild(aiBubble);
		          msgArea.appendChild(aiRow);
		          msgArea.scrollTop = msgArea.scrollHeight;
		        } else if (ev.type === 'ready') {
		          if (typingRow.parentNode) typingRow.remove();
		          const readyRow = el('div', { class: 'flex justify-start' });
		          const readyBubble = el('div', { class: 'bubble bubble-assistant', style: 'font-size:13px;max-width:400px;border-color:rgba(74,222,128,0.3);' });
		          readyBubble.textContent = 'Spec looks complete! ' + (ev.rationale || 'Ready to generate skeleton.');
		          readyRow.appendChild(readyBubble);
		          msgArea.appendChild(readyRow);
		          const advRow = el('div', { class: 'flex justify-center', style: 'margin-top:8px;' });
		          const advBtn = el('button', { class: 'btn btn-primary', style: 'font-size:12px;' }, 'Continue to Skeleton →');
		          advBtn.addEventListener('click', () => _transitionToB());
		          advRow.appendChild(advBtn);
		          msgArea.appendChild(advRow);
		          msgArea.scrollTop = msgArea.scrollHeight;
		        } else if (ev.type === 'error') {
		          if (typingRow.parentNode) typingRow.remove();
		          const errRow = el('div', { class: 'flex justify-start' });
		          const errBubble = el('div', { class: 'bubble bubble-error', style: 'font-size:13px;max-width:400px;' });
		          errBubble.textContent = 'Error: ' + (ev.error ? ev.error.message : 'Unknown');
		          errRow.appendChild(errBubble);
		          const retryBtn = el('button', { class: 'btn', style: 'font-size:11px;margin-top:4px;' }, 'Retry');
		          retryBtn.addEventListener('click', () => { errRow.remove(); _stageAHandleUserInput(text); });
		          errRow.appendChild(retryBtn);
		          msgArea.appendChild(errRow);
		        }
		      }
		    } catch (err) {
		      if (typingRow.parentNode) typingRow.remove();
		      const errRow = el('div', { class: 'flex justify-start' });
		      const errBubble = el('div', { class: 'bubble bubble-error', style: 'font-size:13px;max-width:400px;' });
		      errBubble.textContent = 'Error: ' + (err.message || err);
		      errRow.appendChild(errBubble);
		      msgArea.appendChild(errRow);
		    } finally {
		      if (typingRow.parentNode) typingRow.remove();
		      _stageARunning = false;
		    }
		
		    // Update main chat with progress
		    const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		    if (sess) {
		      const spec = CodeSmith.stageA.getSpec();
		      const filledFields = Object.entries(spec).filter(([k, v]) => {
		        if (Array.isArray(v)) return v.length > 0;
		        if (typeof v === 'object' && v !== null) return Object.values(v).some(sv => sv && sv.length > 0);
		        return v && v.length > 0;
		      }).length;
		      const existing = sess.messages.find(m => m._stageAProgress);
		      const progressText = '[Stage A] Requirements: ' + filledFields + '/7 fields filled';
		      if (existing) { existing.content = progressText; }
		      else { sess.messages.push({ role: 'assistant', content: progressText, ts: Date.now(), _stageAProgress: true }); }
		      await CodeSmith.db.putSession(sess);
		      renderChat();
		      renderStatusStrip();
		    }
		    await _persistStageState();
		  }

	

	  async function _transitionToB() {
		const spec = CodeSmith.stageA.getSpec();
		  console.log('[StageB] Spec passed to skeleton:', JSON.stringify(spec).slice(0, 500));
		_showStep('b');
		await _generateSkeleton();
	  }

	async function _generateSkeleton() {
	    const spec = CodeSmith.stageA.getSpec();
	    const container = $('#mermaid-container');
	    const moduleList = $('#stage-b-module-list');
	    moduleList.replaceChildren();
	
	    // Show streaming preview
	    container.innerHTML = '';
	    const previewPre = el('pre', {
	      style: 'font-size:11px;color:#8b92a1;white-space:pre-wrap;word-break:break-all;padding:12px;margin:0;text-align:left;max-height:100%;overflow:auto;width:100%;',
	    });
	    previewPre.textContent = 'Generating architecture…\n\n';
	    container.appendChild(previewPre);
	    container.style.alignItems = 'flex-start';
	
	    let dotCount = 0;
	    const dotInterval = setInterval(() => {
	      dotCount++;
	      const dots = '.'.repeat(dotCount % 4);
	      const lines = previewPre.textContent.split('\n');
	      if (lines.length > 2) {
	        // Show line count as progress
	        const charCount = previewPre.textContent.length;
	        container.querySelector('.gen-progress')?.remove();
	      }
	    }, 500);
	
	    try {
	      const skeleton = await CodeSmith.stageB.generate(spec, (partialText) => {
	        // Show raw streaming JSON so user sees progress
	        previewPre.textContent = 'Generating architecture… (' + partialText.length + ' chars received)\n\n' + partialText;
	        previewPre.scrollTop = previewPre.scrollHeight;
	      });
	
	      clearInterval(dotInterval);
	      container.style.alignItems = '';
	
	      // Warn if too many modules
	      $('#stage-b-warn').hidden = !skeleton.modules || skeleton.modules.length <= 10;
	
	      // Render Mermaid
	      const mermaidDef = CodeSmith.stageB.getMermaidDef();
	      container.innerHTML = '';
	      const mermaidDiv = el('div', { class: 'mermaid' });
	      mermaidDiv.textContent = mermaidDef;
	      container.appendChild(mermaidDiv);
	      try {
	        await mermaid.run({ nodes: [mermaidDiv] });
	      } catch (mErr) {
	        container.innerHTML = '<pre style="color:#ff6b6b;font-size:11px;white-space:pre-wrap;padding:12px;">Mermaid render error:\n' + (mErr.message || mErr) + '\n\nDefinition:\n' + mermaidDef + '</pre>';
	      }
	
	      // Render module list
	      _renderModuleList(skeleton);
	      await _persistStageState();
	    } catch (err) {
	      clearInterval(dotInterval);
	      container.style.alignItems = '';
	      container.innerHTML = '';
	      const errDiv = el('div', { style: 'padding:16px;width:100%;' });
	      errDiv.appendChild(el('div', { style: 'color:#ff6b6b;font-size:13px;margin-bottom:8px;' }, 'Error: ' + (err.message || err)));
	      const retryBtn = el('button', { class: 'btn btn-primary', style: 'font-size:12px;margin-right:8px;' }, 'Retry');
	      retryBtn.addEventListener('click', () => _generateSkeleton());
	      errDiv.appendChild(retryBtn);
	      const showRawBtn = el('button', { class: 'btn', style: 'font-size:12px;' }, 'Show raw response');
	      showRawBtn.addEventListener('click', () => {
	        const pre = el('pre', { style: 'margin-top:8px;font-size:11px;color:#8b92a1;white-space:pre-wrap;word-break:break-all;max-height:300px;overflow:auto;background:#0b0d10;padding:8px;border-radius:6px;' });
	        pre.textContent = err.message || 'No response captured';
	        errDiv.appendChild(pre);
	        showRawBtn.remove();
	      });
	      errDiv.appendChild(showRawBtn);
	      container.appendChild(errDiv);
	    }
	  }

	  function _renderModuleList(skeleton) {
		const list = $('#stage-b-module-list');
		list.replaceChildren();

		for (const mod of skeleton.modules) {
		  const row = el('div', { class: 'module-row', dataset: { moduleId: mod.id } });

		  const header = el('div', { class: 'module-row-header' });
		  header.appendChild(el('span', { class: 'module-row-name' }, mod.name || mod.id));
		  const fnCount = (mod.public_functions || []).length;
		  const deps = (mod.depends_on || []).length;
		  header.appendChild(el('span', { class: 'module-row-meta' },
			fnCount + ' fn' + (fnCount !== 1 ? 's' : '') + (deps ? ' · ' + deps + ' dep' + (deps !== 1 ? 's' : '') : '')));
		  row.appendChild(header);

		  row.appendChild(el('div', { class: 'module-row-purpose' }, mod.purpose || ''));

		  // Expandable details
		  const details = el('div', { class: 'module-row-details' });
		  if (mod.public_functions) {
			details.appendChild(el('div', { style: 'font-size:11px;color:#5b6474;margin-bottom:4px;' }, 'Public functions:'));
			for (const fn of mod.public_functions) {
			  const fnEl = el('div', { class: 'module-fn-item' });
			  fnEl.textContent = fn.signature || fn.name;
			  if (fn.description) {
				fnEl.appendChild(el('span', { style: 'color:#5b6474;margin-left:8px;font-family:inherit;' }, '— ' + fn.description));
			  }
			  details.appendChild(fnEl);
			}
		  }
		  if (mod.depends_on && mod.depends_on.length > 0) {
			details.appendChild(el('div', { style: 'font-size:11px;color:#5b6474;margin-top:6px;' }, 'Depends on: ' + mod.depends_on.join(', ')));
		  }
		  if (mod.notes) {
			details.appendChild(el('div', { style: 'font-size:11px;color:#8b92a1;margin-top:4px;font-style:italic;' }, mod.notes));
		  }
		  row.appendChild(details);

		  row.addEventListener('click', () => {
			row.classList.toggle('expanded');
			// Highlight in Mermaid
			document.querySelectorAll('.module-row').forEach(r => {
			  if (r !== row) r.classList.remove('highlighted');
			});
			row.classList.toggle('highlighted');
		  });

		  list.appendChild(row);
		}
	  }

	  function _moduleToBuildPrompt(mod, skeleton) {
		// Convert a module from the skeleton into a build prompt for the Day 4 builder
		const sharedTypes = skeleton.shared_types ? '\n\nShared types:\n' + JSON.stringify(skeleton.shared_types, null, 2) : '';
		const deps = (mod.depends_on || []).map(d => {
		  const dep = skeleton.modules.find(m => m.id === d);
		  return dep ? dep.name : d;
		});
		const depsNote = deps.length > 0 ? '\nDependencies (assume available): ' + deps.join(', ') : '';

		return `Build Python module "${mod.name}": ${mod.purpose}

	Public functions:
	${(mod.public_functions || []).map(f => `- ${f.signature}: ${f.description}`).join('\n')}
	${depsNote}${sharedTypes}
	${mod.notes ? '\nNotes: ' + mod.notes : ''}`;
	  }

	  async function _persistStageState() {
		const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		if (!sess) return;
		sess.stageA = {
		  spec: CodeSmith.stageA.getSpec(),
		  messages: CodeSmith.stageA.getMessages(),
		  assumptions: CodeSmith.stageA.getAssumptions(),
		  ready: CodeSmith.stageA.isReady(),
		};
		const skel = CodeSmith.stageB.getSkeleton();
		if (skel) {
		  sess.stageB = {
			skeleton: skel,
			approvedSpec: CodeSmith.stageB.getApprovedSpec(),
			mermaidDef: CodeSmith.stageB.getMermaidDef(),
		  };
		}
		await CodeSmith.db.putSession(sess);
	  }
	  // ---- Day 6: Stage C multi-module UI wiring ------------------------------
		let _scBuildGenerator = null;
		let _scActiveModuleId = null;
		let _scModuleData = {};
		let _scEditModeActive = false;
		let _scEditModeOriginal = null;

  function wireStageC() {
    // Tab switching
    for (const tab of document.querySelectorAll('[data-sctab]')) {
      tab.addEventListener('click', () => {
        document.querySelectorAll('[data-sctab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('[data-sccontent]').forEach(c => { c.hidden = true; c.classList.remove('active'); });
        tab.classList.add('active');
        const tgt = tab.dataset.sctab;
        const content = document.querySelector(`[data-sccontent="${tgt}"]`);
        if (content) { content.hidden = false; content.classList.add('active'); }
      });
    }

    // Controls
    $('#btn-sc-start').addEventListener('click', () => _scStartBuild());
    $('#btn-sc-pause').addEventListener('click', () => {
      CodeSmith.stageC.pause();
      $('#btn-sc-pause').hidden = true;
      $('#btn-sc-resume').hidden = false;
    });
    $('#btn-sc-resume').addEventListener('click', () => {
      CodeSmith.stageC.resume();
      $('#btn-sc-resume').hidden = true;
      $('#btn-sc-pause').hidden = false;
    });
    $('#btn-sc-stop').addEventListener('click', () => {
      CodeSmith.stageC.stop();
    });
    $('#btn-sc-symtable').addEventListener('click', _showSymbolTable);
    $('#btn-sc-download-all').addEventListener('click', _scDownloadAll);

    // Escalation buttons
   
	$('#btn-sc-bypass').addEventListener('click', async () => {
      const modId = _scActiveModuleId;
      if (!modId) return;
      const data = _scModuleData[modId] || {};
      _scLog('⚠ ' + modId + ' bypassed (marked passed without verification)', 'log-warn');
      const skeleton = CodeSmith.stageB.getSkeleton();
      const mod = skeleton ? skeleton.modules.find(m => m.id === modId) : null;
      const artifact = {
        id: modId + '_' + Date.now(),
        sessionId: CodeSmith.state.currentId,
        moduleName: modId,
        code: data.code || '',
        tests: data.tests || '',
        spec: mod,
        createdAt: Date.now(),
        status: 'bypassed',
      };
      try { await CodeSmith.db.putArtifact(artifact); } catch {}
      SymbolTable.markImplemented(modId);
      const states = CodeSmith.stageC.getModuleStates();
      states[modId] = 'passed';
      $('#sc-escalation-bar').hidden = true;
      _scRenderModuleList();
      _scUpdateProgress();
      $('#btn-sc-resume').hidden = false;
      CodeSmith.stageC.resume();
    });

    $('#btn-sc-skip-mod').addEventListener('click', () => {
      const modId = _scActiveModuleId;
      if (!modId) return;
      _scLog('Skipped ' + modId + ' — package may be incomplete', 'log-warn');
      $('#sc-escalation-bar').hidden = true;
      $('#btn-sc-resume').hidden = false;
      CodeSmith.stageC.resume();
    });
  }

  function _scLog(text, cls) {
    const log = $('#sc-log');
    const entry = el('div', { class: 'log-entry ' + (cls || 'log-info') });
    const time = el('span', { class: 'log-time' });
    const now = new Date();
    time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.appendChild(time);
    entry.appendChild(document.createTextNode(text));
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  function _scRenderModuleList() {
    const list = $('#sc-module-list');
    list.replaceChildren();
    const states = CodeSmith.stageC.getModuleStates();
    const skeleton = CodeSmith.stageB.getSkeleton();
    if (!skeleton) return;

    for (const modId of skeleton.build_order) {
      const mod = skeleton.modules.find(m => m.id === modId);
      const state = states[modId] || 'pending';
      const item = el('div', {
        class: 'sc-mod-item' + (modId === _scActiveModuleId ? ' active' : ''),
        dataset: { modId: modId },
      });

      const dot = el('span', { class: 'sc-dot ' + state });
      item.appendChild(dot);

      const name = el('span', { class: 'sc-mod-name' }, mod ? mod.name : modId);
      item.appendChild(name);

      let statusText = state;
      if (state === 'building') statusText = 'building…';
      if (state === 'testing') statusText = 'testing…';
      const statusSpan = el('span', { class: 'sc-mod-status' }, statusText);
      item.appendChild(statusSpan);

      item.addEventListener('click', () => _scSelectModule(modId));
      list.appendChild(item);
    }
  }
			function _scExitEditMode() {
				_scEditModeActive = false;
				_scEditModeOriginal = null;
				_scEnsureDisplayElements();
				const escBar = $('#sc-escalation-bar');
				if (escBar) escBar.hidden = true;
			}
		function _scEnsureDisplayElements() {
			const codePane = $('#sc-code');
			const testsPane = $('#sc-tests');
			const outPane = $('#sc-output');
			if (codePane && !$('#sc-code-display')) {
			codePane.replaceChildren();
			const pre = document.createElement('pre');
			const code = document.createElement('code');
			code.className = 'language-python';
			code.id = 'sc-code-display';
			pre.appendChild(code);
			codePane.appendChild(pre);
			}
			if (testsPane && !$('#sc-tests-display')) {
			testsPane.replaceChildren();
			const pre = document.createElement('pre');
			const code = document.createElement('code');
			code.className = 'language-python';
			code.id = 'sc-tests-display';
			pre.appendChild(code);
			testsPane.appendChild(pre);
			}
			if (outPane && !$('#sc-output-display')) {
			outPane.replaceChildren();
			const div = document.createElement('div');
			div.id = 'sc-output-display';
			outPane.appendChild(div);
			}
		}
			function _scSelectModule(modId) {
				if (_scEditModeActive && _scActiveModuleId !== modId) {
					if (!confirm('You have unsaved edits. Discard and switch?')) return;
					_scExitEditMode();
					}
				_scActiveModuleId = modId;
				_scEnsureDisplayElements();
				_scRenderModuleList();
			const data = _scModuleData[modId] || {};
			const skeleton = CodeSmith.stageB.getSkeleton();
			const mod = skeleton ? skeleton.modules.find(m => m.id === modId) : null;
			const states = CodeSmith.stageC.getModuleStates();
			const state = states[modId] || 'pending';

			const activeName = $('#sc-active-name');
			const badge = $('#sc-active-badge');
			if (activeName) activeName.textContent = mod ? mod.name : modId;
			if (badge) {
			badge.className = 'build-badge badge-' + (state === 'building' || state === 'testing' ? 'running' : state);
			badge.textContent = state;
			}

			const codeEl = $('#sc-code-display');
			if (codeEl) {
			codeEl.textContent = data.code || '';
			if (data.code && window.hljs) {
				delete codeEl.dataset.highlighted;
				codeEl.className = 'language-python';
				try { hljs.highlightElement(codeEl); } catch {}
			}
			}

			const testsEl = $('#sc-tests-display');
			if (testsEl) {
			testsEl.textContent = data.tests || '';
			if (data.tests && window.hljs) {
				delete testsEl.dataset.highlighted;
				testsEl.className = 'language-python';
				try { hljs.highlightElement(testsEl); } catch {}
			}
			}

			const outEl = $('#sc-output-display');
			if (outEl) outEl.textContent = data.output || '';

			const escBar = $('#sc-escalation-bar');
			if (escBar) escBar.hidden = state !== 'escalated';
		}

  function _scUpdateProgress() {
    const states = CodeSmith.stageC.getModuleStates();
    const total = Object.keys(states).length;
    const passed = Object.values(states).filter(s => s === 'passed').length;
    const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
    $('#sc-progress-bar').style.width = pct + '%';
    $('#sc-progress-text').textContent = passed + ' / ' + total;
  }

	async function _scStartBuild() {
	    const skeleton = CodeSmith.stageB ? CodeSmith.stageB.getSkeleton() : null;
	    const spec = (CodeSmith.stageB ? CodeSmith.stageB.getApprovedSpec() : null) || (CodeSmith.stageA ? CodeSmith.stageA.getSpec() : null) || {};
	    if (!skeleton) {
	      _scLog('No skeleton — use Quick Build for single-module projects.', 'log-warn');
	      return;
	    }

    // Show controls
    $('#btn-sc-start').hidden = true;
    $('#btn-sc-pause').hidden = false;
    $('#btn-sc-stop').hidden = false;
    $('#sc-escalation-bar').hidden = true;
    _scModuleData = {};

    // Clear log
    $('#sc-log').replaceChildren();
    _scLog('Build started — ' + skeleton.build_order.length + ' modules');

    _scRenderModuleList();
    _scUpdateProgress();

    // Symbol table diff listener
    const diffListener = (diff) => {
      const label = diff.op + ' ' + diff.section + '.' + diff.name;
      _scLog('Δ ' + label, 'log-diff');
    };
    SymbolTable.onDiff(diffListener);

		try {
		for await (const ev of CodeSmith.stageC.run(skeleton, spec)) { try {
        switch (ev.type) {
			case 'symbols_init':
				_scLog('Symbol table initialized');
				break;
			case 'smoke_start':
				_scLog('Running smoke test: import all modules together…', 'log-info');
				break;
			case 'parallel_wave':
				_scLog('🔧 Building ' + ev.modules.length + ' modules in parallel: ' + ev.modules.join(', '), 'log-info');
				break;
			case 'smoke_result':
				_scLog(ev.passed ? '✓ Smoke test passed' : '✗ Smoke test FAILED — modules cannot import', ev.passed ? 'log-pass' : 'log-fail');
				break;	
			case 'module_start':
				_scActiveModuleId = ev.moduleId;
				_scModuleData[ev.moduleId] = { code: '', tests: '', output: '' };
				_scRenderModuleList();
				_scSelectModule(ev.moduleId);
				_scLog('▶ ' + ev.moduleId + ' (' + ev.progress + ')');
				break;
			case 'worker_stream':
				// Accumulate for display
				if (_scModuleData[ev.moduleId]) {
				_scModuleData[ev.moduleId]._rawWorker = (_scModuleData[ev.moduleId]._rawWorker || '') + ev.delta;
				}
				break;
				case 'critic_start':
					_scLog('🔍 Critic reviewing ' + ev.moduleId + '…', 'log-info');
					break;
				case 'critic_verdict':
				if (ev.verdict === 'accept') _scLog('✓ Critic accepted ' + ev.moduleId, 'log-pass');
					else _scLog('✎ Critic flagged ' + ev.issues.length + ' issue(s) in ' + ev.moduleId, 'log-warn');
					break;
					case 'reviser_start':
					_scLog('🔧 Reviser fixing ' + ev.moduleId + '…', 'log-info');
					break;
					case 'reviser_done':
					_scLog('✓ Reviser updated ' + ev.moduleId, 'log-pass');
					break;
					case 'reviser_failed':
					_scLog('⚠ Revision failed: ' + ev.reason, 'log-warn');
					// Store full error details for inspection
					if (!_scModuleData[ev.moduleId]) _scModuleData[ev.moduleId] = {};
					_scModuleData[ev.moduleId]._lastError = { stage: 'reviser', reason: ev.reason, timestamp: Date.now() };
					break;
					case 'vote_start':
				_scLog('🗳 Voting on ' + ev.moduleId + ' (3 candidates)…', 'log-info');
					break;
					case 'vote_done':
					_scLog('🏆 Picked candidate ' + ev.winner + ' of ' + ev.totalCandidates + ' for ' + ev.moduleId + (ev.rationale ? ' — ' + ev.rationale.slice(0, 80) : ''), 'log-pass');
					break;
					case 'vote_failed':
					_scLog('⚠ Vote failed: ' + ev.reason, 'log-warn');
					if (!_scModuleData[ev.moduleId]) _scModuleData[ev.moduleId] = {};
					_scModuleData[ev.moduleId]._lastError = { stage: 'vote', reason: ev.reason, timestamp: Date.now() };
					break;
			case 'worker_done':
					if (!_scModuleData[ev.moduleId]) _scModuleData[ev.moduleId] = { code: '', tests: '', output: '' };
						_scModuleData[ev.moduleId].code = ev.result.code || '';
						_scModuleData[ev.moduleId].tests = ev.result.tests || '';
						// Clear any previous error on success
						delete _scModuleData[ev.moduleId]._lastError;
						_scSelectModule(ev.moduleId);
						_scLog('Worker done for ' + ev.moduleId + ' (attempt ' + ev.attempt + ')');
						if ($('#sc-review-tests')?.checked && ev.result.tests) {
				CodeSmith.stageC.pause();
				const decision = await approveTestsModal(ev.moduleId, ev.result.tests);
				if (decision.action === 'cancel') { CodeSmith.stageC.stop(); return; }
				if (decision.action === 'skip') {
					_scModuleData[ev.moduleId].tests = '';
					ev.result.tests = '';
					try { await CodeSmith.sandbox.writeFile('/workdir/test_' + ev.moduleId + '.py', '# tests skipped by user\n'); } catch {}
				} else if (decision.action === 'approve') {
					_scModuleData[ev.moduleId].tests = decision.tests;
					ev.result.tests = decision.tests;
					try { await CodeSmith.sandbox.writeFile('/workdir/test_' + ev.moduleId + '.py', decision.tests); } catch {}
				}
				CodeSmith.stageC.resume();
				}
			break;
case 'symbols_requested':
	            _scLog('Symbols requested: ' + ev.symbols.map(s => s.name).join(', '), 'log-warn');
	            break;
	          case 'symbols_decision':
	            for (const d of (ev.decisions || [])) {
	              _scLog('Symbol ' + d.name + ': ' + d.action, d.action === 'approve' ? 'log-pass' : 'log-warn');
	            }
	            break;
	          case 'tests_start':
	            _scLog('Testing ' + ev.moduleId + ' (attempt ' + ev.attempt + ')…');
	            _scRenderModuleList();
	            break;
	          case 'tests_result':
	            if (_scModuleData[ev.moduleId]) {
	              _scModuleData[ev.moduleId].output += ev.output + '\n';
	            }
	            _scSelectModule(ev.moduleId);
	            _scLog(
	              ev.passed ? '✓ ' + ev.moduleId + ' passed (' + ev.passCount + ')' : '✗ ' + ev.moduleId + ' failed (' + ev.failCount + ' failures)',
	              ev.passed ? 'log-pass' : 'log-fail'
	            );
	            break;
	          case 'repair_start':
	            _scLog('Repair ' + ev.moduleId + ' attempt ' + ev.attempt, 'log-warn');
	            break;
				
				case 'module_built':
					_scRenderModuleList();
					_scLog('🔨 ' + ev.moduleId + ' built (untested)', 'log-info');
					break;


			case 'all_built':
						_scLog('━━━ Phase 1 complete: ' + ev.count + ' modules built ━━━', 'log-info');
						$('#btn-sc-download-all').hidden = false;
						break;
					case 'phase_checkpoint':
						_scLog(ev.message, 'log-warn');
						$('#btn-sc-pause').hidden = true;
						const continueBtn = $('#btn-sc-continue-tests');
						if (!continueBtn) {
						const controls = document.querySelector('.stage-c-controls');
						const btn = el('button', { class: 'btn btn-primary', id: 'btn-sc-continue-tests', style: 'font-size:12px;' }, '▶ Run tests on all modules');
						btn.addEventListener('click', () => {
							btn.remove();
							CodeSmith.stageC.resume();
							$('#btn-sc-pause').hidden = false;
							_scLog('━━━ Phase 2: testing each module ━━━', 'log-info');
						});
						controls.insertBefore(btn, $('#btn-sc-pause'));
						}
						break;
			case 'repair_diagnosis':
				if (ev.patch && ev.patch.diagnosis) {
				_scLog('Diagnosis: ' + ev.patch.diagnosis + ' [' + (ev.patch.category || '?') + ']', 'log-warn');
				_scLog('  → ' + (ev.patch.edits || []).length + ' patch(es) to apply', 'log-info');
				}
				break;
			case 'repair_failed':
				_scLog('Patch failed: ' + ev.reason, 'log-fail');
				break;
          case 'module_skipped':
            _scRenderModuleList();
            _scLog('⊘ ' + ev.moduleId + ' skipped', 'log-warn');
            break;
		  case 'module_passed':
            _scRenderModuleList();
            _scUpdateProgress();
            _scLog('✓ ' + ev.moduleId + ' implemented', 'log-pass');
            break;
          case 'module_escalated':
            if (_scModuleData[ev.moduleId]) {
				_restoreEscalationBar();
				$('#sc-escalation-bar').hidden = false;
              _scModuleData[ev.moduleId].code = ev.code;
              _scModuleData[ev.moduleId].tests = ev.tests;
              _scModuleData[ev.moduleId].output += ev.output + '\n';
            }
            _scRenderModuleList();
            _scSelectModule(ev.moduleId);
            _scLog('⚠ ' + ev.moduleId + ' ESCALATED — build paused', 'log-fail');
            $('#btn-sc-pause').hidden = true;
            $('#btn-sc-resume').hidden = true;
            break;
          case 'integration_start':
            _scLog('Integration test starting…');
            break;
          case 'integration_result':
            _scLog(
              ev.passed ? '✓ Integration passed' : '✗ Integration failed (attempt ' + ev.attempt + ')',
              ev.passed ? 'log-pass' : 'log-fail'
            );
            break;
			case 'build_complete':
				_scLog('BUILD COMPLETE — ' + ev.modules + ' modules', 'log-pass');
				$('#btn-sc-download-all').hidden = false;
				// Add Run button
					const runBtn = el('button', { class: 'btn btn-primary', style: 'font-size:12px;', id: 'btn-sc-run' }, '▶ Run it');
					runBtn.addEventListener('click', () => {
					  const skel = CodeSmith.stageB.getSkeleton();
					  const lastMod = skel && skel.build_order ? skel.build_order[skel.build_order.length - 1] : null;
					  const mod = skel ? skel.modules.find(m => m.id === lastMod) : null;
					  if (mod) runInBrowser(mod.name + '.py');
					});
				const controls = document.querySelector('.stage-c-controls');
				if (controls && !$('#btn-sc-run')) controls.appendChild(runBtn);
				break;
			}
    	  } catch(evErr) { _scLog('Event error: ' + evErr.message, 'log-fail'); }
      }
    } finally {

      SymbolTable.offDiff(diffListener);
      // Reset controls
      $('#btn-sc-start').hidden = false;
      $('#btn-sc-start').textContent = 'Restart build';
	  // Enable restart even after escalation
      $('#btn-sc-start').disabled = false;
      $('#btn-sc-start').addEventListener('click', () => {
				CodeSmith.stageC.stop();
				setTimeout(() => _scStartBuild(), 200);
			}, { once: true });
      $('#btn-sc-pause').hidden = true;
      $('#btn-sc-stop').hidden = true;
      $('#btn-sc-resume').hidden = true;
      _scRenderModuleList();
      _scUpdateProgress();
      // Refresh artifacts list
      renderArtifactList();
    }
  }

  function _showSymbolTable() {
    const table = SymbolTable.get();
    const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
    const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:700px;' });
    const header = el('div', { class: 'flex items-center justify-between mb-3' });
    header.appendChild(el('div', { class: 'text-[14px] font-semibold' }, 'Symbol Table'));
    const closeBtn = el('button', { class: 'iconbtn', 'aria-label': 'Close' });
    closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    header.appendChild(closeBtn);
    modal.appendChild(header);

    const content = el('div', { class: 'symtable-modal-content' });
    // Render with color coding
    for (const section of ['functions', 'types', 'exceptions', 'constants']) {
      const entries = Object.entries(table[section] || {});
      if (entries.length === 0) continue;
      const sectionHeader = el('div', { style: 'color:#4f8cff;font-weight:600;margin-top:8px;margin-bottom:4px;' }, section.toUpperCase());
      content.appendChild(sectionHeader);
      for (const [name, val] of entries) {
        const row = el('div', { style: 'padding:1px 0;' });
        const nameSpan = el('span');
        const status = val.status || '';
        nameSpan.className = status === 'implemented' ? 'sym-implemented' : 'sym-declared';
        nameSpan.textContent = name;
        row.appendChild(nameSpan);
        if (val.signature) row.appendChild(document.createTextNode('  ' + val.signature));
        if (val.module) row.appendChild(el('span', { style: 'color:#5b6474;margin-left:6px;' }, '[' + val.module + ']'));
        if (status) row.appendChild(el('span', { style: 'margin-left:6px;font-size:10px;color:' + (status === 'implemented' ? '#4ade80' : '#f59e0b') }, status));
        content.appendChild(row);
      }
    }
    modal.appendChild(content);

    const close = () => { backdrop.remove(); modal.remove(); };
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
  }

	async function _scDownloadAll(isDraft) {
   		 const arts = isDraft
		? Object.entries(_scModuleData).map(([id, d]) => ({ moduleName: id, code: d.code || '', tests: d.tests || '', status: 'draft', id }))
		: CodeSmith.stageC.getModuleArtifacts();
    	if (arts.length === 0) { alert('Nothing to download yet.'); return; }
		if (typeof JSZip === 'undefined') { alert('JSZip not loaded'); return; }
		const zip = new JSZip();
		const testsDir = zip.folder('tests');

		const isWebapp = (CodeSmith.stageA.getSpec() || {}).target_type === 'webapp';
			const skel = CodeSmith.stageB.getSkeleton();
			const spec = CodeSmith.stageB.getApprovedSpec() || CodeSmith.stageA.getSpec() || {};

			// ===== WEBAPP BRANCH =====
			if (isWebapp) {
			for (const art of arts) {
				const skelMod = skel ? (skel.modules || []).find(m => m.id === art.moduleName) : null;
				const filename = (skelMod && skelMod.name) || art.moduleName;
				zip.file(filename, art.code || '');
			}

			// Generate index.html if not present
			const hasIndex = arts.some(art => {
				const sm = skel ? (skel.modules || []).find(m => m.id === art.moduleName) : null;
				return (sm && sm.name === 'index.html') || art.moduleName === 'index.html';
			});
			if (!hasIndex && skel) {
				const cdnTags = (skel.cdn_libraries || []).map(c => '  <script src="' + c.url + '"><\/script>').join('\n');
				const cssLinks = (skel.modules || []).filter(m => m.kind === 'css').map(m => '  <link rel="stylesheet" href="' + m.name + '">').join('\n');
				const jsModules = (skel.modules || []).filter(m => m.kind === 'js');
				// Sort by build_order so dependencies load first
				const orderMap = new Map((skel.build_order || []).map((id, i) => [id, i]));
				jsModules.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
				const jsTags = jsModules.map(m => '  <script src="' + m.name + '"><\/script>').join('\n');
				const pageTitle = spec.goal || 'Web App';
				const bootstrap = `<script>
				window.App = window.App || { _modules: {}, _ready: [], registerModule(n,m){this._modules[n]=m;console.debug('[App] registered',n);}, getModule(n){return this._modules[n];}, onReady(fn){this._ready.push(fn);} };
				<\/script>`;
				const initBoot = `<script>
				document.addEventListener('DOMContentLoaded', function() {
					console.log('[App] DOM ready, modules:', Object.keys(window.App._modules));
					for (const fn of (window.App._ready || [])) {
					try { fn(); } catch(e) { console.error('[App] onReady error:', e); }
					}
					window.App._booted = true;
				});
				<\/script>`;
				const indexHtml = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <title>' + pageTitle + '</title>\n' + cssLinks + '\n' + cdnTags + '\n  ' + bootstrap + '\n</head>\n<body>\n  <div id="app"></div>\n' + jsTags + '\n  ' + initBoot + '\n</body>\n</html>\n';
				zip.file('index.html', indexHtml);
			}

			// Webapp README
			const webappReadme = '# ' + (spec.goal || 'Web App') + '\n\n' +
				'## Run\n\nOpen `index.html` directly in a browser, OR serve the folder:\n\n' +
				'```bash\npython3 -m http.server 8000\n# then visit http://localhost:8000\n```\n\n' +
				'## Files\n\n' +
				arts.map(art => {
				const sm = skel ? (skel.modules || []).find(m => m.id === art.moduleName) : null;
				return '- `' + ((sm && sm.name) || art.moduleName) + '` — ' + ((sm && sm.purpose) || '');
				}).join('\n') + '\n';
			zip.file('README.md', webappReadme);

			if (skel) zip.file('skeleton.json', JSON.stringify(skel, null, 2));
			if (spec) zip.file('spec.json', JSON.stringify(spec, null, 2));

			const webappBlob = await zip.generateAsync({ type: 'blob' });
			const webappUrl = URL.createObjectURL(webappBlob);
			const webappLink = document.createElement('a');
			webappLink.href = webappUrl;
			webappLink.download = (spec.goal || 'webapp').replace(/\W+/g, '_').slice(0, 30) + '.zip';
			webappLink.click();
			URL.revokeObjectURL(webappUrl);
			return;
			}

			// ===== PYTHON BRANCH =====
			const allImports = new Set();
			for (const a of arts) {
			const name = a.moduleName || a.id;
			zip.file(name + '.py', a.code || '');
			if (a.tests) testsDir.file('test_' + name + '.py', a.tests);
			const matches = (a.code || '').matchAll(/^(?:import|from)\s+(\w+)/gm);
			for (const m of matches) {
				const pkg = m[1];
				if (!['sys','os','json','re','math','datetime','collections','itertools','functools',
					'pathlib','typing','dataclasses','enum','abc','io','csv','string','textwrap',
					'unittest','pytest','copy','operator','contextlib','warnings'].includes(pkg)) {
				allImports.add(pkg);
				}
			}
			}

			try {
			const integCode = await CodeSmith.sandbox.readFile('/workdir/test_integration.py');
			if (integCode) testsDir.file('test_integration.py', integCode);
			} catch {}

			if (spec) zip.file('spec.json', JSON.stringify(spec, null, 2));
			if (skel) zip.file('skeleton.json', JSON.stringify(skel, null, 2));
			zip.file('symbol_table.json', JSON.stringify(SymbolTable.get(), null, 2));

			const reqs = Array.from(allImports).sort().join('\n');
			zip.file('requirements.txt', reqs || '# no external dependencies\n');
			zip.file('.gitignore', `__pycache__/\n*.pyc\n*.pyo\n.pytest_cache/\n*.egg-info/\ndist/\nbuild/\n.env\nvenv/\n`);

			// Generate run.py + README via orchestrator
			const fullCode = arts.map(a => '# === ' + a.moduleName + '.py ===\n' + (a.code || '')).join('\n\n');
			const runPyPrompt = `You have access to the full source of a Python package. Write a single run.py file at the top level that:
				1. Imports the package's entry function (look at the modules below — find the main orchestrator function)
				2. Defines 1-3 SAMPLES dicts with realistic input matching the actual function signature and the spec's example data
				3. Has a main() that takes optional sys.argv[1] to pick a sample, defaults to running all
				4. Prints results as JSON
				5. Uses ONLY stdlib imports

				Spec example data:
				${JSON.stringify((spec && spec.inputs && spec.inputs.example) || {}, null, 2).slice(0, 2000)}

			Source:
			${fullCode.slice(0, 12000)}

			Output ONLY the Python code for run.py. No markdown fences, no explanation.`;

					let runPy = '';
					try {
					const r = await CodeSmith.llm.chatComplete({
						messages: [
						{ role: 'system', content: 'You write runnable Python entry-point scripts.' },
						{ role: 'user', content: runPyPrompt },
						],
						tier: 'orchestrator', temperature: 0.2, maxTokens: 6000,
					});
					runPy = (r.text || '').trim();
					if (runPy.startsWith('```')) runPy = runPy.replace(/^```(?:python)?\s*\n?/, '').replace(/\n?```\s*$/, '');
					} catch {}
					if (runPy) zip.file('run.py', runPy);

			const readmePrompt = `Write a README.md for this Python project. The user is non-technical. Required sections in this exact order:
				1. # Title (one line)
				2. ## How to run (exact bash commands starting with "cd path/to/folder", then "python run.py")
				3. ## How to use in your code (one short Python snippet importing from the actual modules)
				4. ## Files (bullet list of every .py with one-line purpose)
				5. ## Limitations (real ones from the code, not generic)

				Do NOT include git clone, pip install steps unless requirements.txt has real packages. Output ONLY markdown.

			Modules: ${arts.map(a => a.moduleName).join(', ')}
			Has run.py: ${!!runPy}
			Spec goal: ${spec.goal || ''}`;
					let readme = '# ' + (spec.goal || 'CodeSmith Project') + '\n\nRun: `python run.py`\n';
					const attribution = '\n\n---\n_Generated with [CodeSmith](https://khalecl.github.io/codesmith/) by Khaled Diab._\n';

					try {
					const r2 = await CodeSmith.llm.chatComplete({
						messages: [
						{ role: 'system', content: 'You write clear READMEs for non-technical users.' },
						{ role: 'user', content: readmePrompt },
						],
						tier: 'fast', temperature: 0.3, maxTokens: 3000,
					});
					if (r2.text) readme = r2.text;
					} catch {}
					zip.file('README.md', readme);

					const blob = await zip.generateAsync({ type: 'blob' });
					const url = URL.createObjectURL(blob);
					const link = document.createElement('a');
					link.href = url;
					link.download = (spec.goal || 'codesmith_build').replace(/\W+/g, '_').slice(0, 30) + '.zip';
					link.click();
					URL.revokeObjectURL(url);
				}

	  

			function _scEditAndRerun() {
					const modId = _scActiveModuleId;
					if (!modId) return;
					const data = _scModuleData[modId] || {};

					_scEditModeActive = true;
					_scEditModeOriginal = { code: data.code || '', tests: data.tests || '' };

					const codePane = $('#sc-code');
					const testsPane = $('#sc-tests');
					codePane.replaceChildren();
					const codeTA = el('textarea', { class: 'escalated-editor', id: 'sc-edit-code' });
					codeTA.value = _scEditModeOriginal.code;
					codePane.appendChild(codeTA);

					testsPane.replaceChildren();
					const testsTA = el('textarea', { class: 'escalated-editor', id: 'sc-edit-tests' });
					testsTA.value = _scEditModeOriginal.tests;
					testsPane.appendChild(testsTA);

					const escBar = $('#sc-escalation-bar');
					escBar.replaceChildren();

					const cancelBtn = el('button', { class: 'btn', style: 'font-size:11px;' }, 'Cancel');
					cancelBtn.addEventListener('click', () => {
					_scExitEditMode();
					_restoreEscalationBar();
					$('#sc-escalation-bar').hidden = false;
					_scSelectModule(modId);
					});

					const discardBtn = el('button', { class: 'btn', style: 'font-size:11px;color:#f59e0b;' }, 'Discard changes');
					discardBtn.addEventListener('click', () => {
					if (!confirm('Discard your edits?')) return;
					if (_scModuleData[modId]) {
						_scModuleData[modId].code = _scEditModeOriginal.code;
						_scModuleData[modId].tests = _scEditModeOriginal.tests;
					}
					_scExitEditMode();
					_restoreEscalationBar();
					$('#sc-escalation-bar').hidden = false;
					_scSelectModule(modId);
					});

					const rebuildBtn = el('button', { class: 'btn', style: 'font-size:11px;' }, 'Rebuild this module');
					rebuildBtn.addEventListener('click', async () => {
					if (!confirm('Regenerate this module from scratch? Your edits will be lost.')) return;
					_scExitEditMode();
					await _scRebuildSingleModule(modId);
					});

					const rerunBtn = el('button', { class: 'btn btn-primary', style: 'font-size:11px;' }, 'Save & rerun tests');
					rerunBtn.addEventListener('click', async () => {
					const code = $('#sc-edit-code').value;
					const tests = $('#sc-edit-tests').value;
					const skeleton = CodeSmith.stageB.getSkeleton();
					const mod = skeleton ? skeleton.modules.find(m => m.id === modId) : null;
					if (!mod) return;

					_scLog('Re-running ' + modId + ' with edits…');
					await CodeSmith.sandbox.writeFile('/workdir/' + mod.name + '.py', code);
					await CodeSmith.sandbox.writeFile('/workdir/test_' + mod.name + '.py', tests);

					const pytestCode = `
				import sys, os
				sys.path.insert(0, '/workdir')
				os.chdir('/workdir')
				for mn in list(sys.modules):
					if mn == '${mod.name}' or mn.startswith('${mod.name}.'):
						del sys.modules[mn]
				import pytest
				pytest.main(['-v', '/workdir/test_${mod.name}.py', '--tb=short', '--no-header'])
				`;
					const result = await CodeSmith.sandbox.runPython(pytestCode, { sessionGlobals: true, timeoutMs: 30000 });
					const output = (result.stdout || '') + (result.stderr || '');
					const passed = /(\d+)\s+passed/.test(output) && !/failed/.test(output);
					_scModuleData[modId] = { code, tests, output };

					if (passed) {
						_scLog('✓ ' + modId + ' passed after manual edit', 'log-pass');
						SymbolTable.markImplemented(modId);
						const artifact = {
						id: modId + '_' + Date.now(),
						sessionId: CodeSmith.state.currentId,
						moduleName: modId,
						code, tests, spec: mod,
						createdAt: Date.now(), status: 'passed',
						};
						try { await CodeSmith.db.putArtifact(artifact); } catch {}
						_scExitEditMode();
						_scSelectModule(modId);
						$('#btn-sc-resume').hidden = false;
						CodeSmith.stageC.resume();
					} else {
						_scLog('✗ Still failing after edit', 'log-fail');
						// Stay in edit mode but show output
						const existingOut = $('#sc-edit-output');
						if (existingOut) existingOut.remove();
						const outDiv = el('pre', {
						id: 'sc-edit-output',
						style: 'background:#0b0d10;color:#ff9999;padding:8px;font-size:11px;max-height:200px;overflow:auto;margin-top:8px;border-radius:4px;white-space:pre-wrap;'
						});
						outDiv.textContent = output;
						codePane.appendChild(outDiv);
					}
					});

					escBar.appendChild(cancelBtn);
					escBar.appendChild(discardBtn);
					escBar.appendChild(rebuildBtn);
					escBar.appendChild(rerunBtn);
					escBar.hidden = false;
				}

			function _restoreEscalationBar() {
				const escBar = $('#sc-escalation-bar');
				escBar.replaceChildren();
				const editBtn = el('button', { class: 'btn', id: 'btn-sc-edit-rerun', style: 'font-size:11px;' }, 'Edit & rerun');
				editBtn.addEventListener('click', _scEditAndRerun);
				const regenBtn = el('button', { class: 'btn', id: 'btn-sc-regen', style: 'font-size:11px;' }, 'Regenerate');
				regenBtn.addEventListener('click', () => _scRebuildSingleModule(_scActiveModuleId));
				const retrySameBtn = el('button', { class: 'btn', id: 'btn-sc-retry-same', style: 'font-size:11px;' }, 'Retry same model');
				retrySameBtn.title = 'Retry with the same model that was used for this module';
				retrySameBtn.addEventListener('click', () => _scRetrySameModel(_scActiveModuleId));
				const showErrorBtn = el('button', { class: 'btn', id: 'btn-sc-show-error', style: 'font-size:11px;' }, 'Show error details');
				showErrorBtn.addEventListener('click', () => _scShowErrorDetails(_scActiveModuleId));
				const bypassBtn = el('button', {
					class: 'btn',
					style: 'font-size:11px;color:#0b0d10;background:#f59e0b;border-color:#f59e0b;font-weight:600;'
					}, 'Bypass & continue');
					bypassBtn.addEventListener('click', () => {
						const modId = _scActiveModuleId;
						if (!modId) return;
						_scLog('⚠ ' + modId + ' bypassed', 'log-warn');
						CodeSmith.stageC.setModuleDecision(modId, 'bypass');
						_scExitEditMode();
						CodeSmith.stageC.resume();
						});


				const skipBtn = el('button', {
				class: 'btn',
				style: 'font-size:11px;color:#0b0d10;background:#ff6b6b;border-color:#ff6b6b;font-weight:600;'
				}, 'Skip module');

				skipBtn.addEventListener('click', () => {
					const modId = _scActiveModuleId;
					if (!modId) return;
					_scLog('Skipped ' + modId, 'log-warn');
					CodeSmith.stageC.setModuleDecision(modId, 'skip');
					_scExitEditMode();
					CodeSmith.stageC.resume();
					});
			const backBtn = el('button', { class: 'btn', id: 'btn-sc-back-b', style: 'font-size:11px;' }, 'Back to skeleton');
			backBtn.addEventListener('click', () => _showStep('b'));
			escBar.appendChild(editBtn);
			escBar.appendChild(regenBtn);
			escBar.appendChild(retrySameBtn);
			escBar.appendChild(showErrorBtn);
			escBar.appendChild(bypassBtn);
			escBar.appendChild(skipBtn);
			escBar.appendChild(backBtn);
		}

		async function _scRebuildSingleModule(modId) {
			if (!modId) return;
			const skeleton = CodeSmith.stageB.getSkeleton();
			const mod = skeleton ? skeleton.modules.find(m => m.id === modId) : null;
			if (!mod) { _scLog('Module not found in skeleton', 'log-fail'); return; }
			_scLog('🔄 Rebuilding ' + modId + ' only…', 'log-warn');

			const states = CodeSmith.stageC.getModuleStates();
			states[modId] = 'building';
			_scRenderModuleList();

			const depCode = SymbolTable.getDependencyCode(modId, skeleton, CodeSmith.stageC.getModuleArtifacts());
			const spec = CodeSmith.stageB.getApprovedSpec() || CodeSmith.stageA.getSpec();
			const dummyInputs = (spec && spec.inputs && spec.inputs.example) ? spec.inputs.example : '';
			const workOrder = {
			module_spec: mod,
			symbol_table: SymbolTable.get(),
			dependency_code: depCode,
			dummy_inputs: dummyInputs,
			};

			try {
			const result = await CodeSmith.llm.chatComplete({
				messages: [
				{ role: 'system', content: 'You are a senior Python engineer. Output ONLY valid JSON: {"code":"…","tests":"…","imports_needed":[],"requested_symbols":[]}' },
				{ role: 'user', content: 'Work order:\n' + JSON.stringify(workOrder, null, 2) },
				],
				tier: 'worker',
				temperature: 0.2,
				maxTokens: 20000,
			});
			let txt = (result.text || '').trim();
			if (txt.startsWith('```')) txt = txt.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
			const parsed = JSON.parse(txt);
			_scModuleData[modId] = { code: parsed.code, tests: parsed.tests || '', output: '' };
			try {
				await CodeSmith.sandbox.writeFile('/workdir/' + mod.name + '.py', parsed.code);
				if (parsed.tests) await CodeSmith.sandbox.writeFile('/workdir/test_' + mod.name + '.py', parsed.tests);
			} catch {}
			states[modId] = 'escalated';
			_scLog('Rebuild complete — review and rerun tests', 'log-info');
			_scSelectModule(modId);
			_scRenderModuleList();
			} catch (err) {
			_scLog('Rebuild failed: ' + (err.message || err), 'log-fail');
			states[modId] = 'escalated';
			_scRenderModuleList();
			}
		}
  			async function _scRetrySameModel(modId) {
				if (!modId) return;
				const skeleton = CodeSmith.stageB.getSkeleton();
				const mod = skeleton ? skeleton.modules.find(m => m.id === modId) = null;
				if (!mod) { _scLog('Module not found in skeleton', 'log-fail'); return; }
				_scLog('🔄 Retrying ' + modId + ' with same model…', 'log-warn');
				const states = CodeSmith.stageC.getModuleStates();
				states[modId] = 'building';
				_scRenderModuleList();
				// Clear previous error
				if (_scModuleData[modId]) delete _scModuleData[modId]._lastError;
				// Re-run the build for just this module using same work order
				const depCode = SymbolTable.getDependencyCode(modId, skeleton, CodeSmith.stageC.getModuleArtifacts());
				const spec = CodeSmith.stageB.getApprovedSpec() || CodeSmith.stageA.getSpec();
				const dummyInputs = (spec && spec.inputs && spec.inputs.example) ? spec.inputs.example : '';
				const workOrder = {
					module_spec: mod,
					symbol_table: SymbolTable.get(),
					dependency_code: depCode,
					dummy_inputs: dummyInputs,
					cdn_libraries: skeleton.cdn_libraries || [],
					shared_state: skeleton.shared_state || {},
				};
				const isWebapp = spec.target_type === 'webapp';
				const workerSystem = isWebapp
					? STAGE_C_WEBAPP_WORKER_SYSTEM.replace('{style_brief}', spec.style_brief || 'Clean modern defaults.')
					: STAGE_C_WORKER_SYSTEM;
				try {
					for await (const ev of CodeSmith.llm.chat({
						messages: [
							{ role: 'system', content: workerSystem },
							{ role: 'user', content: 'Work order:\n' + JSON.stringify(workOrder, null, 2) },
						],
						tier: 'worker', temperature: 0.2, maxTokens: 20000,
					})) {
						if (ev.type === 'token') {
							_scLog('  [retry] ' + ev.delta.slice(0, 60) + (ev.delta.length > 60 ? '…' : ''), 'log-info');
						} else if ( PARTICLES  === 'done') {
							const workerText = ev.text || '';
							let workerResult;
							try {
								workerResult = _parseJSON(workerText);
								if (!workerResult || !workerResult.code) throw new Error('Missing code');
							} catch (err) {
								_scLog('Retry parse failed: ' + err.message, 'log-fail');
								states[modId] = 'escalated';
								_scRenderModuleList();
								return;
							}
							_scModuleData[modId] = { code: workerResult.code, tests: workerResult.tests || '', output: '' };
							// Write to sandbox
							const safeName = _sanitizeModuleName(mod.name || mod.id);
							mod.name = safeName;
							try {
								await CodeSmith.sandbox.writeFile('/workdir/' + safeName + '.py', workerResult.code);
								if (workerResult.tests && !isWebapp) {
									await CodeSmith.sandbox.writeFile('/workdir/test_' + safeName + '.py', workerResult.tests);
								}
							} catch (err) {
								_scLog('Retry write failed: ' + err.message, 'log-fail');
							}
							_scLog('✓ Retry complete for ' + modId + ' — review and test', 'log-pass');
							_scSelectModule(modId);
							_scRenderModuleList();
							// Auto-run tests if available
							if (workerResult.tests) {
								_scLog('Auto-running tests for ' + modId + '…', 'log-info');
								// Trigger test run by simulating resume which will hit testing phase
								CodeSmith.stageC.resume();
							}
							return;
						} else if (ev.type === 'error' && !ev.recoverable) {
							_scLog('Retry error: ' + (ev.error ? ev.error.message : 'Unknown'), 'log-fail');
							states[modId] = 'escalated';
							_scRenderModuleList();
							return;
						}
					}
				} catch (err) {
					_scLog('Retry exception: ' + (err.message || err), 'log-fail');
					states[modId] = 'escalated';
					_scRenderModuleList();
				}
			}

			function _scShowErrorDetails(modId) {
				if (!modId || !_scModuleData[modId]) {
					alert('No error details available for ' + (modId || 'this module'));
					return;
				}
				const data = _scModuleData[modId];
				const error = data._lastError;
				const output = data.output || '';
				// Build detailed error report
				let report = '=== Error Details for ' + modId + ' ===\n\n';
				if (error) {
					report += 'Stage: ' + error.stage + '\n';
					report += 'Reason: ' + error.reason + '\n';
					report += 'Time: ' + new Date(error.timestamp).toLocaleString() + '\n\n';
				} else {
					report += 'No structured error recorded.\n\n';
				}
				if (output) {
					report += '--- Build Output (last 2000 chars) ---\n';
					report += output.slice(-2000) + '\n\n';
				}
				if (data._rawWorker) {
					report += '--- Raw Worker Response (last 1500 chars) ---\n';
					report += data._rawWorker.slice(-1500) + '\n\n';
				}
				report += '--- Current Code (first 500 chars) ---\n';
				report += (data.code || '').slice(0, 500) + '\n';
				// Show in modal
				const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
				const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:800px;width:90vw;max-height:80vh;display:flex;flex-direction:column;' });
				const header = el('div', { class: 'flex items-center justify-between mb-3' });
				header.appendChild(el('div', { class: 'text-[14px] font-semibold' }, 'Error Details: ' + modId));
				const closeBtn = el('button', { class: 'iconbtn', 'aria-label': 'Close' });
				closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
				header.appendChild(closeBtn);
				modal.appendChild(header);
				const pre = el('pre', { style: 'flex:1;overflow:auto;background:#0b0d10;padding:12px;font-size:11px;color:#8b92a1;white-space:pre-wrap;word-break:break-all;border-radius:6px;margin:0;' });
				pre.textContent = report;
				modal.appendChild(pre);
				const actions = el('div', { class: 'flex items-center justify-end gap-2 mt-3' });
				const copyBtn = el('button', { class: 'btn' }, 'Copy to clipboard');
				copyBtn.addEventListener('click', () => {
					navigator.clipboard.writeText(report).then(() => {
						copyBtn.textContent = 'Copied!';
						setTimeout(() => copyBtn.textContent = 'Copy to clipboard', 1500);
					});
				});
				actions.appendChild(copyBtn);
				modal.appendChild(actions);
				const close = () => { backdrop.remove(); modal.remove(); };
				closeBtn.addEventListener('click', close);
				backdrop.addEventListener('click', close);
				document.body.appendChild(backdrop);
				document.body.appendChild(modal);
			}
	  // ---- Day 7: Onboarding -------------------------------------------------
	  let _onbPreset = 'nvidia';

	  function wireOnboarding() {
		// Step navigation
		function showOnbStep(n) {
		  document.querySelectorAll('.onb-step').forEach(s => s.classList.remove('active'));
		  const step = document.querySelector(`.onb-step[data-onb="${n}"]`);
		  if (step) step.classList.add('active');
		  document.querySelectorAll('.onb-dot').forEach(d => d.classList.toggle('active', d.dataset.dot === String(n)));
		}
		$('#onb-next-1').addEventListener('click', () => showOnbStep(2));
		$('#onb-back-2').addEventListener('click', () => showOnbStep(1));
		$('#onb-next-2').addEventListener('click', () => showOnbStep(3));
		$('#onb-back-3').addEventListener('click', () => showOnbStep(2));

		// Presets
		for (const card of document.querySelectorAll('.preset-card')) {
		  card.addEventListener('click', () => {
			document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('selected'));
			card.classList.add('selected');
			_onbPreset = card.dataset.preset;
		  });
		}

		// Skip
		$('#onb-skip').addEventListener('click', () => dismissOnboarding());

		// Warm up
		$('#onb-warmup').addEventListener('click', async () => {
		  const st = $('#onb-warmup-status');
		  st.textContent = 'Loading Pyodide…';
		  st.style.color = '#f59e0b';
		  try {
			await CodeSmith.sandbox.warmUp();
			st.textContent = 'Python sandbox ready.';
			st.style.color = '#4ade80';
		  } catch (err) {
			st.textContent = 'Failed: ' + (err.message || err);
			st.style.color = '#ff6b6b';
		  }
		});

		// Finish
		$('#onb-finish').addEventListener('click', async () => {
		  const apiKey = $('#onb-api-key').value.trim();
		  const preset = CodeSmith.PRESETS[_onbPreset] || CodeSmith.PRESETS.nvidia;
		  const settings = {
			...CodeSmith.DEFAULTS,
			...preset,
			apiKey: apiKey,
			onboardingDone: true,
		  };
		  await CodeSmith.db.saveSettings(settings);
		  CodeSmith.state.settings = { ...settings, id: 'app' };
		  renderStatusStrip();
		  renderComposerHelp();
		  dismissOnboarding();
		});
	  }

	  function dismissOnboarding() {
		const overlay = $('#onboarding-overlay');
		if (overlay) overlay.remove();
		// Mark as done even if skipped
		if (CodeSmith.state.settings) {
		  CodeSmith.state.settings.onboardingDone = true;
		  CodeSmith.db.saveSettings(CodeSmith.state.settings).catch(() => {});
		}
	  }

	  function checkOnboarding() {
		const s = CodeSmith.state.settings;
		if (!s || (!s.apiKey && !s.onboardingDone)) {
		  $('#onboarding-overlay').hidden = false;
		}
	  }

	  // ---- Day 7: Templates --------------------------------------------------
	  function _renderTemplateGrid() {
			const grid = $('#template-grid');
			if (!grid) return;
			const target = window._getTargetType ? window._getTargetType() : 'python';
			const templates = CodeSmith.TEMPLATES[target] || {};
			grid.replaceChildren();
			for (const [key, tpl] of Object.entries(templates)) {
				const card = el('div', { class: 'template-card', dataset: { tpl: key } });
				card.innerHTML = `<div class="tc-icon">${tpl.icon}</div><div class="tc-title">${tpl.title}</div><div class="tc-desc">${tpl.desc}</div>`;
				grid.appendChild(card);
			}
		}
			let _targetType = 'python';
			window._getTargetType = () => _targetType;

		function wireTemplates() {
				const grid = $('#template-grid');
				if (!grid) return;
				let _targetType = 'python';
				window._getTargetType = () => _targetType;
				window._getTargetLabel = () => {
					const map = { python: 'Python program', webapp: 'HTML/JS web app', cli: 'Python CLI tool with argparse', api: 'FastAPI REST server', notebook: 'Jupyter notebook (.ipynb)' };
					return map[_targetType] || 'Python program';
				};
				for (const btn of document.querySelectorAll('#target-toggle .mode-btn')) {
					btn.addEventListener('click', () => {
						document.querySelectorAll('#target-toggle .mode-btn').forEach(b => b.classList.remove('active'));
						btn.classList.add('active');
						_targetType = btn.dataset.target;
						if (typeof _renderTemplateGrid === 'function') _renderTemplateGrid();
					});
				}
				if (typeof _renderTemplateGrid === 'function') _renderTemplateGrid();
				grid.addEventListener('click', (ev) => {
					const card = ev.target.closest('.template-card');
					if (!card) return;
					const target = window._getTargetType ? window._getTargetType() : 'python';
					const tpl = (CodeSmith.TEMPLATES[target] || {})[card.dataset.tpl];
					if (!tpl) return;
					if (card.dataset.tpl === 'custom') {
						$('#composer').focus();
						return;
					}
					const composer = $('#composer');
					composer.value = tpl.prompt;
					composer.focus();
					composer.dispatchEvent(new Event('input'));
				});
			}

	  // ---- Day 7: Command palette --------------------------------------------
	  let _cmdOpen = false;

	  const CMD_ACTIONS = [
		{ id: 'new-session', label: 'New session', shortcut: '', action: () => newSession() },
		{ id: 'settings', label: 'Settings', shortcut: 'Ctrl+,', action: () => openSettings() },
		{ id: 'mode-chat', label: 'Switch to Chat mode', shortcut: '', action: () => { document.querySelector('.mode-btn[data-mode="chat"]').click(); } },
		{ id: 'mode-build', label: 'Switch to Build mode', shortcut: '', action: () => { document.querySelector('.mode-btn[data-mode="build"]').click(); } },
		{ id: 'warmup', label: 'Warm up Python sandbox', shortcut: '', action: async () => { try { await CodeSmith.sandbox.warmUp(); } catch {} } },
		{ id: 'export', label: 'Export current artifact', shortcut: '', action: () => { const dl = $('#btn-build-download') || $('#btn-sc-download-all'); if (dl) dl.click(); } },
		{ id: 'debug', label: 'Debug panel', shortcut: 'Ctrl+Shift+D', action: () => { const p = $('#debug-panel'); p.hidden = !p.hidden; } },
		{ id: 'help', label: 'Help', shortcut: '?', action: () => openHelp() },
		{ id: 'clear-session', label: 'Clear current session messages', shortcut: '', action: async () => {
		  const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		  if (sess) { sess.messages = []; await CodeSmith.db.putSession(sess); renderChat(); }
		}},
		{ id: 'clear-all', label: 'Clear all data (destructive)', shortcut: '', action: async () => {
		  if (confirm('Delete ALL sessions, artifacts, and settings? This cannot be undone.')) {
			const dbs = await indexedDB.databases?.() || [];
			indexedDB.deleteDatabase(CodeSmith.DB_NAME);
			location.reload();
		  }
		}},
	  ];

	  function openCommandPalette() {
		if (_cmdOpen) return;
		_cmdOpen = true;
		const backdrop = document.createElement('div');
		backdrop.className = 'cmd-palette-backdrop';
		const palette = document.createElement('div');
		palette.className = 'cmd-palette';
		const input = document.createElement('input');
		input.className = 'cmd-input';
		input.placeholder = 'Type a command…';
		input.setAttribute('aria-label', 'Command palette search');
		palette.appendChild(input);
		const list = document.createElement('div');
		list.className = 'cmd-list';
		list.setAttribute('role', 'listbox');
		palette.appendChild(list);
		backdrop.appendChild(palette);
		document.body.appendChild(backdrop);

		let highlighted = 0;
		function render(filter) {
		  list.replaceChildren();
		  const q = (filter || '').toLowerCase();
		  const filtered = CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(q));
		  highlighted = Math.min(highlighted, Math.max(0, filtered.length - 1));
		  filtered.forEach((a, i) => {
			const item = document.createElement('div');
			item.className = 'cmd-item' + (i === highlighted ? ' highlighted' : '');
			item.setAttribute('role', 'option');
			item.textContent = a.label;
			if (a.shortcut) {
			  const sc = document.createElement('span');
			  sc.className = 'cmd-shortcut';
			  sc.textContent = a.shortcut;
			  item.appendChild(sc);
			}
			item.addEventListener('click', () => { close(); a.action(); });
			item.addEventListener('mouseenter', () => {
			  list.querySelectorAll('.cmd-item').forEach(c => c.classList.remove('highlighted'));
			  item.classList.add('highlighted');
			  highlighted = i;
			});
			list.appendChild(item);
		  });
		}
		render('');
		input.focus();

		input.addEventListener('input', () => { highlighted = 0; render(input.value); });
		input.addEventListener('keydown', (ev) => {
		  const items = list.querySelectorAll('.cmd-item');
		  if (ev.key === 'ArrowDown') { ev.preventDefault(); highlighted = Math.min(highlighted + 1, items.length - 1); render(input.value); }
		  else if (ev.key === 'ArrowUp') { ev.preventDefault(); highlighted = Math.max(highlighted - 1, 0); render(input.value); }
		  else if (ev.key === 'Enter') {
			ev.preventDefault();
			const q = input.value.toLowerCase();
			const filtered = CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(q));
			if (filtered[highlighted]) { close(); filtered[highlighted].action(); }
		  }
		  else if (ev.key === 'Escape') { close(); }
		});

		function close() {
		  _cmdOpen = false;
		  backdrop.remove();
		}
		backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) close(); });
	  }

	  // ---- Day 7: Help modal -------------------------------------------------
	  function openHelp() {
		const backdrop = el('div', { class: 'modal-backdrop', style: 'z-index:80;' });
		const modal = el('div', { class: 'modal', style: 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:90;max-width:560px;' });
		const header = el('div', { class: 'flex items-center justify-between mb-3' });
		header.appendChild(el('div', { class: 'text-[15px] font-semibold' }, 'CodeSmith Help'));
		const closeBtn = el('button', { class: 'iconbtn', 'aria-label': 'Close' });
		closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
		header.appendChild(closeBtn);
		modal.appendChild(header);

		const content = el('div', { class: 'help-content' });
		content.innerHTML = `
		  <h3>What CodeSmith Is</h3>
		  <p>A browser-based tool that turns plain-English descriptions into working Python programs. AI writes the code, tests it, fixes failures automatically, and packages the result for download.</p>
		  <h3>How It Works</h3>
		  <p><strong>1. Requirements</strong> — Answer a few questions so the AI understands what you need.</p>
		  <p><strong>2. Skeleton</strong> — AI designs the module architecture. You review and approve.</p>
		  <p><strong>3. Build</strong> — Each module is coded, tested, and repaired until all tests pass.</p>
		  <p><strong>4. Download</strong> — Get a zip with source, tests, docs, and requirements.txt.</p>
		  <h3>Keyboard Shortcuts</h3>
		  <p><code>Ctrl+K</code> Command palette &nbsp; <code>Ctrl+,</code> Settings &nbsp; <code>Ctrl+Shift+D</code> Debug panel &nbsp; <code>Esc</code> Close modal</p>
		  <h3>Known Limitations</h3>
		  <p>Pyodide (WASM Python) cannot run C extensions, filesystem I/O, networking, or GUIs. Builds on the free tier take 5-10 minutes. Memory is limited to ~100MB.</p>
		  <h3>Privacy</h3>
		  <p>Your code and prompts go only to the AI endpoint you configure. Nothing is stored on servers we control. All session data lives in your browser's IndexedDB.</p>
		  <h3>Links</h3>
		  <p><a href="#" style="color:#4f8cff;">GitHub repository (coming soon)</a></p>
		`;
		modal.appendChild(content);

		const close = () => { backdrop.remove(); modal.remove(); };
		closeBtn.addEventListener('click', close);
		backdrop.addEventListener('click', close);
		document.body.appendChild(backdrop);
		document.body.appendChild(modal);
	  }

	  // ---- Day 7: Keyboard shortcuts -----------------------------------------
	  function wireKeyboardShortcuts() {
		document.addEventListener('keydown', (ev) => {
		  const mod = ev.ctrlKey || ev.metaKey;
		  // Ctrl+K: command palette
		  if (mod && ev.key === 'k') { ev.preventDefault(); openCommandPalette(); return; }
		  // Ctrl+,: settings
		  if (mod && ev.key === ',') { ev.preventDefault(); openSettings(); return; }
		  // Esc: close topmost modal
		  if (ev.key === 'Escape') {
			if (_cmdOpen) return; // handled internally
			const modals = document.querySelectorAll('.modal-backdrop');
			if (modals.length > 0) modals[modals.length - 1].click();
		  }
		});
	  }

	  // ---- Day 7: Run in browser ---------------------------------------------
	  function wireRunPanel() {
		// Run button appears after successful build in Stage C
		// We'll inject it dynamically when build completes
	  }

	  async function runInBrowser(entryModule) {
		// Find or create run panel
		let runPanel = $('#run-panel');
		if (!runPanel) {
		  runPanel = el('div', { class: 'run-panel', id: 'run-panel' });
		  const header = el('div', { style: 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.06);' });
		  header.appendChild(el('span', { style: 'font-size:12px;font-weight:600;color:#e8ecf1;' }, 'Output'));
		  const closeBtn = el('button', { class: 'btn btn-ghost', style: 'font-size:11px;margin-left:auto;' }, 'Close');
		  closeBtn.addEventListener('click', () => { runPanel.hidden = true; });
		  header.appendChild(closeBtn);
		  runPanel.appendChild(header);

		  const terminal = el('div', { class: 'run-terminal', id: 'run-terminal' });
		  runPanel.appendChild(terminal);

		  const stdinBar = el('div', { class: 'run-stdin-bar', id: 'run-stdin-bar' });
		  const stdinInput = el('input', { type: 'text', id: 'run-stdin-input', placeholder: 'stdin input…' });
		  const stdinBtn = el('button', { class: 'btn', style: 'font-size:11px;' }, 'Send');
		  stdinBar.appendChild(stdinInput);
		  stdinBar.appendChild(stdinBtn);
		  runPanel.appendChild(stdinBar);

		  // Insert before composer
		  const composer = document.querySelector('.hairline-t.p-3');
		  if (composer) composer.parentNode.insertBefore(runPanel, composer);
		}

		runPanel.hidden = false;
		const terminal = $('#run-terminal');
		terminal.textContent = '$ python ' + entryModule + '.py\n';

			const code = `
				import sys, os
				sys.path.insert(0, '/workdir')
				os.chdir('/workdir')
				exec(open('/workdir/' + ${JSON.stringify(entryModule)}).read())
				`;
		const result = await CodeSmith.sandbox.runPython(code, { sessionGlobals: false, timeoutMs: 30000 });
		if (result.stdout) terminal.textContent += result.stdout;
		if (result.stderr) terminal.textContent += '\n[stderr]\n' + result.stderr;
		if (result.error) terminal.textContent += '\n[error] ' + result.error.type + ': ' + result.error.message;
		terminal.textContent += '\n[exit]';
	  }

	  // ---- Day 7: Page title --------------------------------------------------
	  function updatePageTitle() {
		const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		const title = sess ? sess.title : '';
		const step = _currentStep ? ' — Stage ' + _currentStep.toUpperCase() : '';
		document.title = (title ? title + step + ' · ' : '') + 'CodeSmith';
	  }

	  // ---- Day 7: Telemetry (local only) -------------------------------------
	  async function getTelemetry() {
		const sessions = await CodeSmith.db.listSessions();
		const artifacts = await CodeSmith.db.listArtifacts();
		const budget = CodeSmith.llm ? CodeSmith.llm.getBudget() : { tokensIn: 0, tokensOut: 0, calls: 0 };
		const passed = artifacts.filter(a => a.status === 'passed');
		const rate = artifacts.length > 0 ? Math.round((passed.length / artifacts.length) * 100) : 0;
		return {
		  totalSessions: sessions.length,
		  modulesBuilt: artifacts.length,
		  modulesPassed: passed.length,
		  successRate: rate,
		  tokensIn: budget.tokensIn,
		  tokensOut: budget.tokensOut,
		  totalCalls: budget.calls,
		};
	  }
		// ---- Code Explorer UI wiring ----
		// INSERT THESE FUNCTIONS INSIDE the UI module, before its return { ... }

		function wireExplorer() {
		    const $ = (() => {
									const cache = new Map();
									const _ = (sel) => {
									if (!cache.has(sel)) {
										cache.set(sel, document.querySelector(sel));
									}
									return cache.get(sel);
									};
									_.clear = () => cache.clear();
									return _;
								})();
		  const urlBtn = $('#btn-explorer-url');
			if (urlBtn) urlBtn.addEventListener('click', async () => {
			const url = prompt('Paste URL — supports:\n• GitHub file: https://github.com/user/repo/blob/main/file.py\n• GitHub repo: https://github.com/user/repo\n• Raw URL: https://example.com/script.js\n• HTML page: https://example.com/page.html');
			if (!url) return;
			try {
				await _explorerImportFromURL(url);
				_explorerRenderTree();
				_explorerRenderTabs();
				const first = CodeSmith.explorer.getFileList()[0];
				if (first) { CodeSmith.explorer.openTab(first.name); _explorerShowFile(first.name); }
			} catch (err) {
				alert('Import failed: ' + err.message);
			}
			});
		  function el(tag, props = {}, children = []) {
			const n = document.createElement(tag);
			for (const [k, v] of Object.entries(props)) {
			  if (k === 'class') n.className = v;
			  else if (k === 'style' && typeof v === 'string') n.setAttribute('style', v);
			  else if (k in n) n[k] = v;
			  else n.setAttribute(k, v);
			}
			for (const c of [].concat(children)) {
			  if (c == null) continue;
			  n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
			}
			return n;
		  }

		  // AI tab switching
		  for (const tab of document.querySelectorAll('.ai-tab')) {
			tab.addEventListener('click', () => {
			  document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
			  document.querySelectorAll('.explorer-ai-content').forEach(c => c.classList.remove('active'));
			  tab.classList.add('active');
			  const tgt = tab.dataset.aitab;
			  const content = document.querySelector(`[data-aicontent="${tgt}"]`);
			  if (content) content.classList.add('active');
			  // Update model selector default per tab
				const sel = document.querySelector('#explorer-model-select');
				const label = document.querySelector('#model-for-label');
				if (sel && label) {
					const defaults = { analysis: 'orchestrator', pair: 'auto', algo: 'worker' };
					sel.value = defaults[tgt] || 'auto';
					label.textContent = 'for: ' + tgt;
				}
			});
		  }

		  // File upload
		  $('#btn-explorer-upload').addEventListener('click', () => {
			$('#explorer-file-input').click();
		  });
			$('#explorer-file-input').addEventListener('change', async (ev) => {
					for (const file of ev.target.files) {
					if (file.name.endsWith('.mmd')) {
						const text = await file.text();
						CodeSmith.explorer.addFile(file.name, text);
						window._lastAlgoDef = text;
						const container = $('#algo-container');
						container.innerHTML = '';
						const div = document.createElement('div');
						div.className = 'mermaid';
						div.textContent = text;
						container.appendChild(div);
						try { await mermaid.run({ nodes: [div] }); } catch {}
						$('#btn-explorer-algo-export').disabled = false;
						continue;
					}
					if (file.name.endsWith('.zip') && typeof JSZip !== 'undefined') {
					// Extract zip
					try {
					const zip = await JSZip.loadAsync(file);
					for (const [path, entry] of Object.entries(zip.files)) {
						if (entry.dir) continue;
						if (path.includes('__pycache__') || path.includes('.pyc') || path.includes('node_modules') || path.includes('.git/')) continue;
						// Skip binary files
						const ext = path.split('.').pop().toLowerCase();
						const textExts = ['py','js','ts','jsx','tsx','vue','html','css','json','md','txt','cfg','toml','yaml','yml','sh','bat','sql','csv','xml','env','gitignore','ini','rst','in','lock'];
						if (!textExts.includes(ext)) continue;
						try {
						const content = await entry.async('string');
						CodeSmith.explorer.addFile(path, content);
						} catch {}
					}
					} catch (err) {
					console.error('[Explorer] Zip extract failed:', err);
					alert('Failed to extract zip: ' + err.message);
					}
				} else {
					const text = await file.text();
					CodeSmith.explorer.addFile(file.name, text);
				}
				CodeSmith.explorer.openTab(file.name);
				}
			_explorerRenderTree();
			_explorerRenderTabs();
			_explorerShowFile(CodeSmith.explorer.getActiveFile());
			ev.target.value = '';
		  });
				// Folder upload
					const folderBtn = $('#btn-explorer-folder');
					if (folderBtn) {
						folderBtn.addEventListener('click', () => { $('#explorer-folder-input').click(); });
					}
					const folderInput = $('#explorer-folder-input');
					if (folderInput) {
						folderInput.addEventListener('change', async (ev) => {
						for (const file of ev.target.files) {
							// Skip hidden files and common junk
							const path = file.webkitRelativePath || file.name;
							if (path.includes('__pycache__') || path.includes('.pyc') || path.includes('node_modules') || path.includes('.git/') || path.includes('.DS_Store')) continue;
							try {
							const text = await file.text();
							CodeSmith.explorer.addFile(path, text);
							} catch {}
						}
						_explorerRenderTree();
						_explorerRenderTabs();
						const first = CodeSmith.explorer.getFileList()[0];
						if (first) { CodeSmith.explorer.openTab(first.name); _explorerShowFile(first.name); }
						ev.target.value = '';
						});
					}
		  // Paste code
		  $('#btn-explorer-paste').addEventListener('click', () => {
			const name = prompt('Filename (e.g. main.py):');
			if (!name) return;
			const code = prompt('Paste your code:');
			if (!code) return;
			CodeSmith.explorer.addFile(name, code);
			CodeSmith.explorer.openTab(name);
			_explorerRenderTree();
			_explorerRenderTabs();
			_explorerShowFile(name);
		  });

		  // Clear all
		  $('#btn-explorer-clear').addEventListener('click', () => {
			if (!confirm('Clear all files?')) return;
			CodeSmith.explorer.clearAll();
			_explorerRenderTree();
			_explorerRenderTabs();
			$('#explorer-code-area').innerHTML = '';
			$('#explorer-drop-zone')?.remove();
			const dz = el('div', { id: 'explorer-drop-zone', class: 'drop-zone', style: 'margin:40px auto;max-width:360px;' });
			dz.innerHTML = '<div class="drop-zone-icon">📂</div><div class="drop-zone-text">Drop files here or click Upload</div>';
			$('#explorer-code-area').appendChild(dz);
			_explorerResetAnalysis();
		  });

		  // Drop zone
			// Click on drop zone triggers upload
			  const dropZone = $('#explorer-drop-zone');
			  if (dropZone) {
			    dropZone.addEventListener('click', () => {
			      $('#explorer-file-input').click();
			    });
			  }
			// Drop zone
			const codeArea = $('#monaco-container');
			  if (!codeArea) return;
			  codeArea.addEventListener('dragover', (ev) => {
			ev.preventDefault();
					const dz = $('#explorer-drop-zone');
					if (dz) dz.classList.add('drag-over');
				  });
		  codeArea.addEventListener('dragleave', () => {
			const dz = $('#explorer-drop-zone');
			if (dz) dz.classList.remove('drag-over');
		  });
		  codeArea.addEventListener('drop', async (ev) => {
			ev.preventDefault();
			const dz = $('#explorer-drop-zone');
			if (dz) dz.classList.remove('drag-over');
			for (const file of ev.dataTransfer.files) {
			  const text = await file.text();
			  CodeSmith.explorer.addFile(file.name, text);
			  CodeSmith.explorer.openTab(file.name);
			}
			_explorerRenderTree();
			_explorerRenderTabs();
			_explorerShowFile(CodeSmith.explorer.getActiveFile());
		  });

		  // Analyze button
		  $('#btn-explorer-analyze').addEventListener('click', _explorerRunAnalysis);

		  // Algorithm button
		  $('#btn-explorer-algo').addEventListener('click', _explorerRunAlgo);
		  const algoExportBtn = $('#btn-explorer-algo-export');
		  if (algoExportBtn) algoExportBtn.addEventListener('click', (ev) => {
		    const svg = $('#algo-container').querySelector('svg');
		    const def = window._lastAlgoDef || '';
		    const name = (CodeSmith.explorer.getActiveFile() || 'flowchart').replace(/\W+/g, '_');
		    showDiagramExportMenu(ev.target, svg, def, name + '_flow');
		  });

		  // Pair programmer send
		  $('#btn-pair-send').addEventListener('click', _pairSend);
		  $('#pair-input').addEventListener('keydown', (ev) => {
			if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); _pairSend(); }
		  });

		  // Quick action buttons
		  for (const btn of document.querySelectorAll('.pair-quick-btn')) {
			btn.addEventListener('click', () => {
			  const q = btn.dataset.pairQ;
			  const map = {
				fix: 'Find and fix any bugs in this code. Be specific about what\'s wrong and why.',
				optimize: 'Optimize this code for performance. Identify bottlenecks and suggest improvements.',
				refactor: 'Refactor this code for better readability and maintainability. Keep the same behavior.',
				tests: 'Add comprehensive unit tests for this code. Cover happy path, edge cases, and error cases.',
				docs: 'Add clear docstrings and inline comments explaining the logic.',
				types: 'Add type hints to all functions and variables.',
			  };
				    const queryText = map[q] || q;
						$('#pair-input').value = queryText;
						// Show routing preview
							let routing;
							try {
								routing = CodeSmith.router.route(question, userModelChoice);
							} catch (e) {
								routing = { tier: 'orchestrator', temperature: 0.2, maxTokens: 6000, reason: 'router fallback' };
							}
							const routeEl = $('#route-indicator');
						if (routeEl) {
							const modelName = CodeSmith.llm.getModelForTier(routing.tier);
							const displayName = typeof modelName === 'string' ? modelName.split('/').pop() : routing.tier;
							routeEl.innerHTML = `<span class="route-model">${displayName}</span> <span class="route-reason">— ${routing.reason}</span>`;
							routeEl.hidden = false;
						}
						_switchToAiTab('pair');
						_pairSend();
			});
		  }
		  // Wire bottom bar and terminal
		  _wireExploreMode();

				// Preview button
				const previewBtn = $('#btn-explorer-preview');
				if (previewBtn) previewBtn.addEventListener('click', () => {
					const name = CodeSmith.explorer.getActiveFile();
					if (!name) return;
					const file = CodeSmith.explorer.getFile(name);
					if (!file) return;
					let html = file.content;
					if (file.language !== 'html') {
					if (file.language === 'css') {
						html = '<!DOCTYPE html><html><head><style>' + html + '</style></head><body><div style="padding:20px;font-family:system-ui;"><h1>Heading 1</h1><h2>Heading 2</h2><p>Paragraph with <a href="#">a link</a> and <strong>bold</strong>.</p><button>Button</button><input placeholder="input"/></div></body></html>';
								} else if (file.language === 'javascript') {
									const SCRIPT_OPEN  = '<' + 'script>';
									const SCRIPT_CLOSE = '<' + '/' + 'script>';
									const escaped = html.split(SCRIPT_CLOSE).join('<' + '\\/' + 'script>');
										html = [
										'<!DOCTYPE html><html><head><title>JS Preview</title>',
										'<style>body{font-family:monospace;background:#0b0d10;color:#e8ecf1;padding:20px;}</style>',
										'</head><body><div id="output" style="white-space:pre-wrap;"></div>',
										SCRIPT_OPEN,
										'const _log=console.log;',
										'console.log=(...a)=>{document.getElementById("output").textContent+=a.join(" ")+"\\n";_log(...a);};',
										'window.onerror=(m)=>{document.getElementById("output").textContent+="ERROR: "+m+"\\n";};',
										'try{', escaped, '}catch(e){document.getElementById("output").textContent+="ERROR: "+e.message;}',
										SCRIPT_CLOSE,
										'</body></html>'
										].join('');
		   					   } else {
								alert('Preview only works for HTML, CSS, and JS files.');
								return;
						}
						}
						const blob = new Blob([html], { type: 'text/html' });
						const url = URL.createObjectURL(blob);
						const win = window.open(url, '_blank');
						if (!win) { alert('Popup blocked. Allow popups for this site.'); URL.revokeObjectURL(url); return; }
						setTimeout(() => URL.revokeObjectURL(url), 60000);
					});

		// Copy file button
		$('#btn-explorer-copy-file').addEventListener('click', () => {
			const name = CodeSmith.explorer.getActiveFile();
			if (!name) return;
			const file = CodeSmith.explorer.getFile(name);
			if (!file) return;
			navigator.clipboard.writeText(file.content).then(() => {
			  const btn = $('#btn-explorer-copy-file');
			  btn.textContent = 'Copied!';
			  setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
			});
		  });
		}
		async function _explorerImportFromURL(url) {
		// GitHub blob URL → raw URL
		let m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
		if (m) {
			const rawUrl = `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}`;
			const text = await fetch(rawUrl).then(r => r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)));
			CodeSmith.explorer.addFile(m[4].split('/').pop(), text);
			return;
		}

		// GitHub repo URL → fetch tree via API
		m = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/|$)/);
		if (m) {
			const [, owner, repo] = m;
			const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
			const tree = await fetch(apiUrl).then(r => r.ok ? r.json() : Promise.reject(new Error('GitHub API: ' + r.status)));
			if (!tree.tree) throw new Error('Empty tree');
			const textExts = ['py','js','ts','jsx','tsx','vue','html','css','json','md','txt','yaml','yml','toml','sh','sql','xml'];
			const files = tree.tree.filter(n => n.type === 'blob' && textExts.includes(n.path.split('.').pop()));
			if (files.length > 50 && !confirm(`Repo has ${files.length} text files. Import all?`)) return;
			let imported = 0;
			for (const f of files.slice(0, 100)) {
			try {
				const raw = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f.path}`;
				const text = await fetch(raw).then(r => r.ok ? r.text() : null);
				if (text != null) { CodeSmith.explorer.addFile(f.path, text); imported++; }
			} catch {}
			}
			alert(`Imported ${imported} files from ${owner}/${repo}`);
			return;
		}

		// Raw URL — fetch as text
		const resp = await fetch(url);
		if (!resp.ok) throw new Error('HTTP ' + resp.status + ' (CORS may be blocking)');
		const text = await resp.text();
		const filename = url.split('/').pop().split('?')[0] || 'fetched.txt';

		if (filename.endsWith('.html') || text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'text/html');
			CodeSmith.explorer.addFile(filename, text);
			let i = 0;
			for (const s of doc.querySelectorAll('script:not([src])')) {
			if (s.textContent.trim()) CodeSmith.explorer.addFile(`inline_${++i}.js`, s.textContent);
			}
			let j = 0;
			for (const s of doc.querySelectorAll('style')) {
			if (s.textContent.trim()) CodeSmith.explorer.addFile(`inline_${++j}.css`, s.textContent);
			}
		} else {
			CodeSmith.explorer.addFile(filename, text);
		}
		}
		function _explorerRenderTree() {
		  const $ = (sel) => document.querySelector(sel);
		  const files = CodeSmith.explorer.getFileList();
		  const body = $('#explorer-tree-body');
		  body.replaceChildren();
		  $('#explorer-file-count').textContent = files.length + ' file' + (files.length !== 1 ? 's' : '');

		  const iconMap = {
			python: '🐍', javascript: '📜', typescript: '📘', html: '🌐',
			css: '🎨', json: '📋', markdown: '📝', text: '📄', bash: '⚡',
			vue: '💚', sql: '🗄️', yaml: '⚙️',
		  };

		  for (const f of files) {
			const active = f.name === CodeSmith.explorer.getActiveFile();
			const item = document.createElement('div');
			item.className = 'ftree-item' + (active ? ' active' : '');
			const icon = document.createElement('span');
			icon.className = 'ftree-icon';
			icon.textContent = iconMap[f.language] || '📄';
			item.appendChild(icon);
			const name = document.createElement('span');
			name.className = 'ftree-name';
			name.textContent = f.name;
			item.appendChild(name);
			if (f.modified) {
			  const badge = document.createElement('span');
			  badge.className = 'ftree-badge modified';
			  badge.textContent = 'M';
			  item.appendChild(badge);
			} else {
			  const lines = document.createElement('span');
			  lines.className = 'ftree-lines';
			  lines.textContent = f.lines + 'L';
			  item.appendChild(lines);
			}
			item.addEventListener('click', () => {
			  CodeSmith.explorer.openTab(f.name);
			  _explorerRenderTree();
			  _explorerRenderTabs();
			  _explorerShowFile(f.name);
			});
			    item.addEventListener('contextmenu', (ev) => {
			      ev.preventDefault();
			      _showContextMenu(ev.clientX, ev.clientY, [
			        { label: 'Open', action: () => { CodeSmith.explorer.openTab(f.name); _explorerRenderTree(); _explorerRenderTabs(); _explorerShowFile(f.name); } },
			        { label: 'Copy filename', action: () => navigator.clipboard.writeText(f.name) },
			        { label: 'Copy contents', action: () => { const fl = CodeSmith.explorer.getFile(f.name); if (fl) navigator.clipboard.writeText(fl.content); } },
			        'sep',
			        { label: 'Rename', action: () => { const nn = prompt('New name:', f.name); if (nn && nn !== f.name) { const fl = CodeSmith.explorer.getFile(f.name); if (fl) { CodeSmith.explorer.addFile(nn, fl.content); CodeSmith.explorer.closeTab(f.name); CodeSmith.explorer.openTab(nn); _explorerRenderTree(); _explorerRenderTabs(); _explorerShowFile(nn); } } } },
			        { label: 'Snapshot', action: () => { const fl = CodeSmith.explorer.getFile(f.name); if (fl) { CodeSmith.snapshots.take(f.name, fl.content, 'Manual'); _renderSnapshots(); } } },
			        'sep',
						{ label: 'Delete', cls: 'destructive', action: () => { if (confirm('Delete ' + f.name + '?')) { CodeSmith.explorer.deleteFile(f.name); if (CodeSmith.monaco.isInitialized()) CodeSmith.monaco.closeFile(f.name); _explorerRenderTree(); _explorerRenderTabs(); const next = CodeSmith.explorer.getActiveFile(); if (next) _explorerShowFile(next); else { const mc = document.querySelector('#monaco-container'); if (mc) mc.innerHTML = '<div id="explorer-drop-zone" class="drop-zone" style="margin:40px auto;max-width:360px;"><div class="drop-zone-icon">📂</div><div class="drop-zone-text">Drop files here or click Upload</div></div>'; document.querySelector('#explorer-editor-header').hidden = true; } } } },
			      ]);
			    });
			body.appendChild(item);
		  }

		  // Enable/disable buttons
		  const hasFile = !!CodeSmith.explorer.getActiveFile();
		  const analyzeBtn = $('#btn-explorer-analyze');
		  const algoBtn = $('#btn-explorer-algo');
		  const pairBtn = $('#btn-pair-send');
		  if (analyzeBtn) analyzeBtn.disabled = !hasFile;
		  if (algoBtn) algoBtn.disabled = !hasFile;
		  if (pairBtn) pairBtn.disabled = !hasFile;
		}

		function _explorerRenderTabs() {
		  const $ = (sel) => document.querySelector(sel);
		  const tabs = CodeSmith.explorer.getOpenTabs();
		  const container = $('#explorer-tabs');
		  container.replaceChildren();

		  for (const name of tabs) {
			const active = name === CodeSmith.explorer.getActiveFile();
			const tab = document.createElement('div');
			tab.className = 'editor-tab' + (active ? ' active' : '');
			tab.textContent = name;
			const closeBtn = document.createElement('span');
			closeBtn.className = 'tab-close';
			closeBtn.textContent = '×';
			closeBtn.addEventListener('click', (ev) => {
			  ev.stopPropagation();
			  CodeSmith.explorer.closeTab(name);
			  _explorerRenderTabs();
			  _explorerRenderTree();
			  const newActive = CodeSmith.explorer.getActiveFile();
			  if (newActive) _explorerShowFile(newActive);
			  else {
				$('#explorer-code-area').innerHTML = '';
				$('#explorer-editor-header').hidden = true;
			  }
			});
			tab.appendChild(closeBtn);
			tab.addEventListener('click', () => {
			  CodeSmith.explorer.setActiveFile(name);
			  _explorerRenderTabs();
			  _explorerRenderTree();
			  _explorerShowFile(name);
			});
			container.appendChild(tab);
		  }
		}

		function _explorerShowFile(name) {
		  const $ = (sel) => document.querySelector(sel);
		  if (!name) return;
		  const file = CodeSmith.explorer.getFile(name);
		  if (!file) return;
		 
			$('#explorer-editor-header').hidden = false;
			$('#explorer-file-path').textContent = name;
			const lines = file.content.split('\n');
			$('#explorer-line-info').textContent = lines.length + ' lines';
			const previewBtn2 = $('#btn-explorer-preview');
			if (previewBtn2) {
				const previewable = ['html', 'css', 'javascript'];
				previewBtn2.hidden = !previewable.includes(file.language);
			}
		 
		  // Remove drop zone if present
		  const dz = $('#explorer-drop-zone');
		  if (dz) dz.remove();
		 
		  // Initialize or switch Monaco editor
		  const container = $('#monaco-container');
		  if (!CodeSmith.monaco.isInitialized()) {
		    container.innerHTML = '';
		    CodeSmith.monaco.init(container).then(() => {
		      CodeSmith.monaco.openFile(name, file.content, file.language);
		      _runLiveDiagnostics(name);
		    });
		  } else {
		    CodeSmith.monaco.openFile(name, file.content, file.language);
		    _runLiveDiagnostics(name);
		  }
		 
		 	// Reset AI panels for new file
			const analysisEl = document.querySelector('#explorer-analysis');
			if (analysisEl) analysisEl.replaceChildren();
			const pairChat = document.querySelector('#pair-chat');
			if (pairChat) pairChat.innerHTML = '<div class="explorer-empty" style="padding:16px;"><div class="explorer-empty-icon">🤝</div><div class="explorer-empty-title">AI Pair Programmer</div><div class="explorer-empty-desc">Ask for changes, improvements, or bug fixes.</div></div>';
			const algoContainer = document.querySelector('#algo-container');
			if (algoContainer) algoContainer.innerHTML = '<div class="explorer-empty"><div class="explorer-empty-icon">🔀</div><div class="explorer-empty-title">Algorithm Flowchart</div><div class="explorer-empty-desc">Generates a visual flowchart of the code\'s logic</div></div>';
		  // Run local analysis
		  const analysis = CodeSmith.explorer.analyzeCode(file.content, file.language);
			// Feed basic structure into knowledge graph (no AI needed)
			try { CodeSmith.knowledge.learnFromFile(name, file.content, file.language, null); } catch {}
			_explorerRenderLocalAnalysis(analysis);
					_renderEditHistory();
		}

		function _explorerRenderLocalAnalysis(analysis) {
		  const $ = (sel) => document.querySelector(sel);
		  const container = $('#explorer-analysis');
		  container.replaceChildren();

		  // Metrics section
		  const metricsSection = document.createElement('div');
		  metricsSection.className = 'analysis-section';
		  const metricsLabel = document.createElement('div');
		  metricsLabel.className = 'analysis-label';
		  metricsLabel.textContent = 'Metrics';
		  metricsSection.appendChild(metricsLabel);

		  const metrics = [
			{ label: 'Total lines', val: analysis.totalLines },
			{ label: 'Code lines', val: analysis.codeLines },
			{ label: 'Comments', val: analysis.commentLines + ' (' + analysis.commentRatio + '%)' },
			{ label: 'Blank lines', val: analysis.blankLines },
			{ label: 'Branches', val: analysis.branchCount },
		  ];
		  for (const m of metrics) {
			const row = document.createElement('div');
			row.className = 'analysis-metric';
			row.innerHTML = `<span>${m.label}</span><span class="metric-val">${m.val}</span>`;
			metricsSection.appendChild(row);
		  }

		  // Complexity bar
		  const compRow = document.createElement('div');
		  compRow.className = 'analysis-metric';
		  const compLevel = analysis.complexityScore < 30 ? 'low' : analysis.complexityScore < 60 ? 'med' : 'high';
		  compRow.innerHTML = `<span>Complexity</span>
			<div class="metric-bar"><div class="metric-bar-fill complexity-${compLevel}" style="width:${analysis.complexityScore}%"></div></div>
			<span class="metric-val" style="font-size:11px;">${analysis.complexityScore}/100</span>`;
		  metricsSection.appendChild(compRow);
		  container.appendChild(metricsSection);

		  // Symbols section
		  if (analysis.symbols.length > 0) {
			const symSection = document.createElement('div');
			symSection.className = 'analysis-section';
			const symLabel = document.createElement('div');
			symLabel.className = 'analysis-label';
			symLabel.textContent = 'Functions & Classes (' + analysis.symbols.length + ')';
			symSection.appendChild(symLabel);

			for (const sym of analysis.symbols) {
			  const item = document.createElement('div');
			  item.className = 'fn-map-item';
			  const dotCls = sym.kind === 'class' ? 'fn-class' : sym.kind === 'def' || sym.kind === 'function' ? 'fn-func' : 'fn-method';
			  item.innerHTML = `<span class="fn-type-dot ${dotCls}"></span>
				<span>${sym.name}</span>
				<span class="fn-line">L${sym.line}</span>`;
			  item.addEventListener('click', () => {
				const row = document.querySelector(`.code-line-row[data-line="${sym.line}"]`);
				if (row) {
				  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
				  row.classList.add('highlighted');
				  setTimeout(() => row.classList.remove('highlighted'), 2000);
				}
			  });
			        item.addEventListener('contextmenu', (ev) => {
						ev.preventDefault();
						const activeFile = CodeSmith.explorer.getActiveFile();
						_showFunctionActions(ev.clientX, ev.clientY, sym.name, activeFile, sym.line);
					});
			  symSection.appendChild(item);
			}
			container.appendChild(symSection);
		  }

		  // Imports section
		  if (analysis.imports.length > 0) {
			const impSection = document.createElement('div');
			impSection.className = 'analysis-section';
			const impLabel = document.createElement('div');
			impLabel.className = 'analysis-label';
			impLabel.textContent = 'Imports (' + analysis.imports.length + ')';
			impSection.appendChild(impLabel);
			const impList = document.createElement('div');
			impList.style.cssText = 'font-size:11px;font-family:monospace;color:#8b92a1;line-height:1.8;';
			impList.textContent = analysis.imports.join(', ');
			impSection.appendChild(impList);
			container.appendChild(impSection);
		  }
		}
			function _renderEditHistory() {
				let panel = document.getElementById('edit-history-panel');
				if (!panel) {
				panel = document.createElement('div');
				panel.id = 'edit-history-panel';
				panel.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);max-height:140px;overflow-y:auto;background:#0f1319;';
				const pairChat = document.getElementById('pair-chat');
				if (pairChat && pairChat.parentElement) {
					pairChat.parentElement.insertBefore(panel, pairChat.nextSibling);
				}
				}
				panel.replaceChildren();
				const history = CodeSmith.explorer.getEditHistory();
				if (history.length === 0) { panel.style.display = 'none'; return; }
				panel.style.display = 'block';
				const header = document.createElement('div');
				header.style.cssText = 'padding:4px 10px;font-size:10px;color:#5b6474;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;display:flex;align-items:center;';
				header.textContent = 'Edit History (' + history.length + ')';
				const undoBtn = document.createElement('button');
				undoBtn.className = 'btn btn-ghost';
				undoBtn.style.cssText = 'margin-left:auto;font-size:10px;padding:1px 6px;';
				undoBtn.textContent = '↶ Undo last';
				undoBtn.addEventListener('click', () => {
				const last = CodeSmith.explorer.undoLastEdit();
				if (last && CodeSmith.monaco.isInitialized()) {
					CodeSmith.monaco.updateContent(last.filename, last.before);
				}
				_renderEditHistory();
				_explorerRenderTree();
				});
				header.appendChild(undoBtn);
				panel.appendChild(header);
				for (const h of history.slice().reverse()) {
				const row = document.createElement('div');
				row.style.cssText = 'padding:3px 10px;font-size:11px;color:#8b92a1;display:flex;gap:6px;align-items:center;';
				const time = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
				
				// Add reapply button for undone edits
				const isUndone = h.undone;
				const statusIcon = isUndone ? '<span style="color:#f59e0b;">↶</span>' : '<span style="color:#4ade80;">✓</span>';
				
				row.innerHTML = '<span style="color:#5b6474;font-family:monospace;font-size:10px;">' + time +
								'</span>' + statusIcon +
								'<span style="font-family:monospace;font-size:10px;">' + h.filename + '</span>' +
								'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">' + h.label + '</span>';
				
				// Add reapply button for undone edits
				if (isUndone) {
					const reapplyBtn = document.createElement('button');
					reapplyBtn.className = 'btn btn-ghost';
					reapplyBtn.style.cssText = 'font-size:9px;padding:1px 6px;';
					reapplyBtn.textContent = 'Reapply';
					reapplyBtn.addEventListener('click', () => {
						const result = CodeSmith.explorer.applyEdit(h.filename, h.edit);
						if (result.ok && CodeSmith.monaco.isInitialized()) {
							CodeSmith.monaco.updateContent(h.filename, result.newContent);
						}
						_renderEditHistory();
						_explorerRenderTree();
					});
					row.appendChild(reapplyBtn);
				}
				
				panel.appendChild(row);
				}
			}
		function _explorerResetAnalysis() {
		  const $ = (sel) => document.querySelector(sel);
		  const container = $('#explorer-analysis');
		  container.innerHTML = '<div class="explorer-empty"><div class="explorer-empty-icon">🔍</div><div class="explorer-empty-title">No file loaded</div></div>';
		}

		async function _explorerRunAnalysis() {
		  const $ = (sel) => document.querySelector(sel);
		  const name = CodeSmith.explorer.getActiveFile();
		  if (!name) return;
		  const file = CodeSmith.explorer.getFile(name);
		  if (!file) return;

		const btn = $('#btn-explorer-analyze');
		  btn.disabled = true;
		  btn.textContent = 'Analyzing…';
		
		  // Show spinner in analysis panel
		  const container = $('#explorer-analysis');
		  const spinner = document.createElement('div');
		  spinner.className = 'analysis-section';
		  spinner.id = 'analysis-spinner';
		  spinner.innerHTML = '<div class="typing-indicator" style="padding:12px;"><span></span><span></span><span></span></div><div style="font-size:11px;color:#5b6474;padding:0 12px;">AI is analyzing the code…</div>';
		  container.appendChild(spinner);
		
		  try {
		    const result = await CodeSmith.pair.analyzeWithAI(file.content, name, file.language);
		    const sp = $('#analysis-spinner');
		    if (sp) sp.remove();
			  // Update token display
		    const budget = CodeSmith.llm.getBudget();
		    const tokenEl = $('#explorer-token-usage');
		    if (tokenEl) tokenEl.textContent = '↑' + budget.tokensIn.toLocaleString() + ' ↓' + budget.tokensOut.toLocaleString() + ' tokens';
		    if (!result) {
		      btn.textContent = 'Analysis failed';
		      const errDiv = document.createElement('div');
		      errDiv.className = 'analysis-section';
		      errDiv.innerHTML = '<div style="color:#ff6b6b;font-size:12px;">AI analysis returned no results. Check your API connection.</div>';
		      container.appendChild(errDiv);
		      return;
		    }

			const container = $('#explorer-analysis');
			// Append AI analysis after local analysis
			const aiSection = document.createElement('div');
			aiSection.className = 'analysis-section';
			aiSection.style.borderTop = '2px solid rgba(79,140,255,0.2)';

			const aiLabel = document.createElement('div');
			aiLabel.className = 'analysis-label';
			aiLabel.style.color = '#4f8cff';
			aiLabel.textContent = 'AI Analysis';
			aiSection.appendChild(aiLabel);

			// Summary
			if (result.summary) {
			  const sum = document.createElement('div');
			  sum.style.cssText = 'font-size:12px;color:#e8ecf1;margin-bottom:8px;line-height:1.4;';
			  sum.textContent = result.summary;
			  aiSection.appendChild(sum);
			}

			// Quality score
			if (result.quality_score != null) {
			  const qRow = document.createElement('div');
			  qRow.className = 'analysis-metric';
			  const qLevel = result.quality_score >= 70 ? 'low' : result.quality_score >= 40 ? 'med' : 'high';
			  qRow.innerHTML = `<span>Quality</span>
				<div class="metric-bar"><div class="metric-bar-fill complexity-${qLevel}" style="width:${result.quality_score}%"></div></div>
				<span class="metric-val">${result.quality_score}/100</span>`;
			  aiSection.appendChild(qRow);
			}

			// Issues
			if (result.issues && result.issues.length > 0) {
			  const issLabel = document.createElement('div');
			  issLabel.className = 'analysis-label';
			  issLabel.style.marginTop = '8px';
			  issLabel.textContent = 'Issues (' + result.issues.length + ')';
			  aiSection.appendChild(issLabel);

			  for (const issue of result.issues) {
				const issItem = document.createElement('div');
				issItem.style.cssText = 'padding:4px 0;font-size:11px;color:#8b92a1;cursor:pointer;';
				const sevColor = issue.severity === 'high' ? '#ff6b6b' : issue.severity === 'medium' ? '#f59e0b' : '#8b92a1';
				issItem.innerHTML = `<span style="color:${sevColor};font-weight:600;font-size:9px;text-transform:uppercase;">${issue.severity}</span>
				  <span style="color:#5b6474;font-family:monospace;margin:0 4px;">L${issue.line || '?'}</span>
				  ${issue.message}`;
				if (issue.line) {
				  issItem.addEventListener('click', () => {
					const row = document.querySelector(`.code-line-row[data-line="${issue.line}"]`);
					if (row) {
					  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
					  row.classList.add('highlighted');
					  setTimeout(() => row.classList.remove('highlighted'), 3000);
					}
				  });
				}
				aiSection.appendChild(issItem);
			  }
			}

			// Suggestions
			if (result.suggestions && result.suggestions.length > 0) {
			  const sugLabel = document.createElement('div');
			  sugLabel.className = 'analysis-label';
			  sugLabel.style.marginTop = '8px';
			  sugLabel.textContent = 'Suggestions';
			  aiSection.appendChild(sugLabel);
			  for (const sug of result.suggestions) {
				const sugItem = document.createElement('div');
				sugItem.style.cssText = 'padding:2px 0;font-size:11px;color:#8b92a1;';
				sugItem.textContent = '→ ' + sug;
				aiSection.appendChild(sugItem);
			  }
			}

			container.appendChild(aiSection);
			    // Feed into project knowledge graph
				try { CodeSmith.knowledge.learnFromFile(name, file.content, file.language, result); } catch {}
			
				// Render knowledge summary
				_renderKnowledgeSummary();
		  } catch (err) {
		    console.error('[Explorer] AI analysis error:', err);
			    const sp = $('#analysis-spinner');
			    if (sp) sp.remove();
			    const errDiv = document.createElement('div');
			    errDiv.className = 'analysis-section';
			    errDiv.innerHTML = '<div style="color:#ff6b6b;font-size:12px;">Error: ' + (err.message || err) + '</div>';
			    container.appendChild(errDiv);
			  } finally {
			    btn.disabled = false;
			    btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Analyze with AI';
			  }
		}

		async function _explorerRunAlgo() {
		  const $ = (sel) => document.querySelector(sel);
		  const name = CodeSmith.explorer.getActiveFile();
		  if (!name) return;
		  const file = CodeSmith.explorer.getFile(name);
		  if (!file) return;

		  const btn = $('#btn-explorer-algo');
		  btn.disabled = true;
		  btn.textContent = 'Generating…';

		  try {
				const mermaidDef = await CodeSmith.pair.generateFlowchart(file.content, name, file.language);
				window._lastAlgoDef = mermaidDef;
				$('#btn-explorer-algo-export').disabled = false;
				const container = $('#algo-container');
			container.innerHTML = '';
			const mermaidDiv = document.createElement('div');
			mermaidDiv.className = 'mermaid';
			mermaidDiv.textContent = mermaidDef;
			container.appendChild(mermaidDiv);
			try {
			  await mermaid.run({ nodes: [mermaidDiv] });
			} catch (mErr) {
			  container.innerHTML = `<pre style="color:#ff6b6b;font-size:11px;white-space:pre-wrap;padding:12px;">Mermaid error: ${mErr.message}\n\nDefinition:\n${mermaidDef}</pre>`;
			}
		  } catch (err) {
			console.error('[Explorer] Algo error:', err);
		  } finally {
			btn.disabled = false;
			btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Generate Flowchart';
		  }
		}

		async function _pairSend() {
		  const $ = (sel) => document.querySelector(sel);
		  const input = $('#pair-input');
		  const question = input.value.trim();
		  if (!question) return;

		  const name = CodeSmith.explorer.getActiveFile();
		  if (!name) return;
		  const file = CodeSmith.explorer.getFile(name);
		  if (!file) return;

		  input.value = '';
		  const chat = $('#pair-chat');

		  // Clear empty state
		  const empty = chat.querySelector('.explorer-empty');
		  if (empty) empty.remove();

		  // User message
		  const userRow = document.createElement('div');
		  userRow.style.cssText = 'display:flex;justify-content:flex-end;';
		  const userBubble = document.createElement('div');
		  userBubble.className = 'bubble bubble-user';
		  userBubble.style.cssText = 'font-size:12px;max-width:100%;';
		  userBubble.textContent = question;
		  userRow.appendChild(userBubble);
		  chat.appendChild(userRow);

		  // AI response area
		  const aiRow = document.createElement('div');
		  aiRow.style.cssText = 'display:flex;justify-content:flex-start;';
		  const aiCol = document.createElement('div');
		  aiCol.style.cssText = 'max-width:100%;width:100%;';
		  const aiBubble = document.createElement('div');
		  aiBubble.className = 'bubble bubble-assistant';
		  aiBubble.style.cssText = 'font-size:12px;max-width:100%;';
		  aiBubble.textContent = '';
		  aiCol.appendChild(aiBubble);
		  aiRow.appendChild(aiCol);
		  chat.appendChild(aiRow);
		  chat.scrollTop = chat.scrollHeight;

		  let fullText = '';
		  const btn = $('#btn-pair-send');
		  btn.disabled = true;
		  btn.textContent = '…';

		  try {
			for await (const ev of CodeSmith.pair.askPair(file.content, name, file.language, question)) {
			  if (ev.type === 'token') {
				fullText += ev.delta;
				aiBubble.innerHTML = renderMarkdown(fullText);
				chat.scrollTop = chat.scrollHeight;
			  } else if (ev.type === 'done') {
				fullText = ev.text || fullText;
			  } else if (ev.type === 'error') {
				aiBubble.textContent = 'Error: ' + (ev.error ? ev.error.message : 'Unknown');
				aiBubble.className = 'bubble bubble-error';
			  }
			}

			// Parse edit instructions from response
					const edits = CodeSmith.pair.parseEdits(fullText);
					if (edits.length > 0) {
					for (let i = 0; i < edits.length; i++) {
						const edit = edits[i];
						const card = _createEditCard(edit, i, name);
						aiCol.appendChild(card);
							}
					if (edits.length > 1) {
						const applyAllBtn = document.createElement('button');
						applyAllBtn.className = 'edit-apply-btn';
						applyAllBtn.style.cssText = 'margin:4px 0;width:100%;padding:6px;font-size:11px;';
						applyAllBtn.textContent = '✓ Apply all ' + edits.length + ' edits';
						applyAllBtn.addEventListener('click', async () => {
							// Group edits by file
							const fileEdits = {};
							for (const e of edits) {
								if (!fileEdits[e.file]) fileEdits[e.file] = [];
								fileEdits[e.file].push(e);
							}
							let applied = 0, failed = 0;
								const failures = [];
								for (const [filename, fileEditsList] of Object.entries(fileEdits)) {
									// Sort edits bottom-up to preserve line numbers during application
									const sortedEdits = fileEditsList.sort((a, b) => {
										const aLine = a.startLine || a.afterLine || 0;
										const bLine = b.startLine || b.afterLine || 0;
										return bLine - aLine; // descending: apply from bottom to top
									});
									let content = CodeSmith.explorer.getFile(filename).content;
									for (const edit of sortedEdits) {
										const result = CodeSmith.explorer.applyEdit(filename, edit);
										if (result.ok) {
											content = result.newContent;
											applied++;
										} else {
											failed++;
											failures.push(result.error);
										}
									}
									if (CodeSmith.monaco.isInitialized()) {
										CodeSmith.monaco.updateContent(filename, content);
									}
								}
							_explorerRenderTree();
							_renderEditHistory();
							applyAllBtn.textContent = applied + ' applied' + (failed ? ', ' + failed + ' failed' : '');
							applyAllBtn.disabled = true;
							aiCol.querySelectorAll('.edit-card').forEach(c => c.classList.add('edit-applied'));
							if (failures.length > 0) {
								const warn = document.createElement('div');
								warn.style.cssText = 'margin:6px 0;padding:8px;background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.3);border-radius:6px;font-size:11px;color:#ff6b6b;';
								warn.textContent = '⚠ Failed edits: ' + failures.join('; ');
								aiCol.appendChild(warn);
							}
						});
						aiCol.insertBefore(applyAllBtn, aiCol.children[1]);
					}
					chat.scrollTop = chat.scrollHeight;
					} else if (fullText.includes('```')) {
				const codeBlocks = [...fullText.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(m => m[1]);
				if (codeBlocks.length > 0) {
					const hint = document.createElement('div');
					hint.style.cssText = 'margin:6px 0;padding:8px 10px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:6px;font-size:11px;color:#f59e0b;';
					hint.textContent = '⚠ The AI returned code blocks but not in the structured edit format. Pick how to apply:';
					aiCol.appendChild(hint);
					codeBlocks.forEach((code, i) => {
					const row = document.createElement('div');
					row.style.cssText = 'display:flex;gap:4px;margin:4px 0;';
					const replaceBtn = document.createElement('button');
					replaceBtn.className = 'edit-apply-btn';
					replaceBtn.style.fontSize = '10px';
					replaceBtn.textContent = 'Replace entire file with block ' + (i + 1);
					replaceBtn.addEventListener('click', () => {
						if (!confirm('Replace the entire file with this code block?')) return;
						CodeSmith.explorer.updateFileContent(name, code);
						if (CodeSmith.monaco.isInitialized()) CodeSmith.monaco.updateContent(name, code);
						try { CodeSmith.snapshots.take(name, code, 'Manual replace from chat'); } catch {}
						_explorerRenderTree();
						replaceBtn.textContent = '✓ Replaced';
						replaceBtn.disabled = true;
					});
					const copyBtn = document.createElement('button');
					copyBtn.className = 'edit-show-btn';
					copyBtn.style.fontSize = '10px';
					copyBtn.textContent = 'Copy block ' + (i + 1);
					copyBtn.addEventListener('click', () => {
						navigator.clipboard.writeText(code);
						copyBtn.textContent = '✓ Copied';
					});
					row.appendChild(replaceBtn);
					row.appendChild(copyBtn);
					aiCol.appendChild(row);
					});
					chat.scrollTop = chat.scrollHeight;
				}
				}
		  // Update token display
		    const budget = CodeSmith.llm.getBudget();
		    const tokenEl = document.querySelector('#explorer-token-usage');
		    if (tokenEl) tokenEl.textContent = '↑' + budget.tokensIn.toLocaleString() + ' ↓' + budget.tokensOut.toLocaleString() + ' tokens';
		    CodeSmith.ui.renderStatusStrip();
		  } catch (err) {
			aiBubble.textContent = 'Error: ' + (err.message || err);
			aiBubble.className = 'bubble bubble-error';
		  } finally {
			btn.disabled = false;
			btn.textContent = 'Ask';
		  }
		}

		function _createEditCard(edit, index, filename) {
		  const card = document.createElement('div');
		  card.className = 'edit-card';
		  card.dataset.editIndex = String(index);

		  // Header
		  const header = document.createElement('div');
		  header.className = 'edit-card-header';
		  const typeBadge = document.createElement('span');
		  typeBadge.className = 'edit-card-type edit-type-' + edit.type;
		  typeBadge.textContent = edit.type;
		  header.appendChild(typeBadge);
		  const location = document.createElement('span');
		  location.className = 'edit-card-location';
		  if (edit.type === 'add') {
			location.textContent = 'after line ' + edit.afterLine;
		  } else {
			location.textContent = 'lines ' + edit.startLine + (edit.endLine !== edit.startLine ? '–' + edit.endLine : '');
		  }
		  header.appendChild(location);
		  card.appendChild(header);

		  // Body
		  const body = document.createElement('div');
		  body.className = 'edit-card-body';
		  if (edit.oldCode) {
			const oldDiv = document.createElement('div');
			oldDiv.className = 'edit-card-old';
			oldDiv.textContent = edit.oldCode;
			body.appendChild(oldDiv);
		  }
		  if (edit.newCode) {
			const newDiv = document.createElement('div');
			newDiv.className = 'edit-card-new';
			newDiv.textContent = edit.newCode;
			body.appendChild(newDiv);
		  }
		  card.appendChild(body);

		  // Reason
			if (edit.reason) {
						const reason = document.createElement('div');
						reason.className = 'edit-card-reason';
						reason.textContent = edit.reason;
						card.appendChild(reason);
					}

					if (edit.warnings && edit.warnings.length > 0) {
						const warn = document.createElement('div');
						warn.style.cssText = 'padding:6px 10px;font-size:10px;color:#f59e0b;background:rgba(245,158,11,0.06);border-top:1px solid rgba(245,158,11,0.2);';
						warn.textContent = '⚠ ' + edit.warnings.join(' · ');
						card.appendChild(warn);
						if (edit.suspicious) {
						card.style.borderColor = 'rgba(245,158,11,0.4)';
						}
					}

			  // Actions
			  const actions = document.createElement('div');
			  actions.className = 'edit-card-actions';

			  const applyBtn = document.createElement('button');
			  applyBtn.className = 'edit-apply-btn';
			  applyBtn.textContent = '✓ Apply';
			  applyBtn.dataset.editIndex = String(index);
			  
			  // Store original edit for potential reapply
			  const originalEdit = { ...edit };
			  let currentEdit = { ...edit };
			  
				applyBtn.addEventListener('click', () => {
			    if (edit.suspicious && !confirm('This edit has warnings (' + (edit.warnings || []).join('; ') + '). Apply anyway?')) return;
					
					// Get fresh file content in case previous edits changed it
					const file = CodeSmith.explorer.getFile(filename);
					const freshContent = file ? file.content : '';
					const currentLines = freshContent.split('\n');
					
					// Recalculate line numbers based on current file state vs original
					// Track how line numbers have shifted from previous applied edits
					const appliedEdits = CodeSmith.explorer.getEditHistory().filter(h => h.filename === filename);
					let lineShift = 0;
					for (const h of appliedEdits) {
						if (h.timestamp > (card.dataset.appliedAt || 0)) {
							const hLines = h.before.split('\n').length;
							const hNewLines = h.after.split('\n').length;
							lineShift += (hNewLines - hLines);
						}
					}
					
					// Adjust edit to current line numbers
					const adjustedEdit = { ...currentEdit };
					if (adjustedEdit.startLine) adjustedEdit.startLine += lineShift;
					if (adjustedEdit.endLine) adjustedEdit.endLine += lineShift;
					if (adjustedEdit.afterLine) adjustedEdit.afterLine += lineShift;
					
					const result = CodeSmith.explorer.applyEdit(filename, adjustedEdit);
					if (result.ok) {
					card.classList.add('edit-applied');
					card.dataset.appliedAt = String(Date.now());
					applyBtn.textContent = '↶ Undo';
					applyBtn.classList.remove('edit-apply-btn');
					applyBtn.classList.add('edit-undo-btn');
					applyBtn.style.background = 'rgba(245,158,11,0.15)';
					applyBtn.style.color = '#f59e0b';
					if (CodeSmith.monaco.isInitialized()) {
						CodeSmith.monaco.updateContent(filename, result.newContent);
					}
					_explorerRenderTree();
					_renderEditHistory();
					try { CodeSmith.snapshots.take(filename, result.newContent, 'After: ' + (edit.reason || edit.type).slice(0, 40)); } catch {}
					const toast = document.createElement('div');
					toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#4ade80;color:#0b0d10;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;z-index:200;';
					toast.textContent = '✓ Edit applied to ' + filename;
					document.body.appendChild(toast);
					setTimeout(() => toast.remove(), 2000);
					} else {
					applyBtn.textContent = '✗ ' + result.error;
					applyBtn.style.color = '#ff6b6b';
					// Allow retry
					setTimeout(() => {
						applyBtn.textContent = '✓ Apply';
						applyBtn.style.color = '';
					}, 3000);
					}
				});
			  actions.appendChild(applyBtn);

			  const showBtn = document.createElement('button');
			  showBtn.className = 'edit-show-btn';
			  showBtn.textContent = '→ Show';
			  showBtn.addEventListener('click', () => {
				// Get current file state to find accurate line numbers
				const file = CodeSmith.explorer.getFile(filename);
				if (!file) return;
				
				// Try to find the content by searching for oldCode text
				const lines = file.content.split('\n');
				let targetStart = currentEdit.startLine || currentEdit.afterLine || 1;
				let targetEnd = currentEdit.endLine || targetStart;
				
				// If we have oldCode, try to find it in current file for accurate positioning
				if (currentEdit.oldCode && currentEdit.oldCode.trim()) {
					const oldLines = currentEdit.oldCode.split('\n');
					const firstOldLine = oldLines[0].trim();
					// Search for the content in current file
					for (let i = 0; i < lines.length; i++) {
						if (lines[i].trim() === firstOldLine) {
							// Verify subsequent lines match
							let match = true;
							for (let j = 1; j < oldLines.length && match; j++) {
								if (i + j >= lines.length || lines[i + j].trim() !== oldLines[j].trim()) {
									match = false;
								}
							}
							if (match) {
								targetStart = i + 1;
								targetEnd = i + oldLines.length;
								break;
							}
						}
					}
				}
				
				// Use Monaco editor to reveal and highlight
				if (CodeSmith.monaco.isInitialized()) {
					const editor = CodeSmith.monaco.getEditor();
					if (editor) {
						editor.revealLineInCenter(Math.min(targetStart, lines.length));
						editor.setPosition({ lineNumber: targetStart, column: 1 });
						editor.focus();
						
						// Set selection to highlight the target range
						if (currentEdit.type === 'replace' || currentEdit.type === 'delete') {
							editor.setSelection({
								startLineNumber: targetStart,
								startColumn: 1,
								endLineNumber: targetEnd,
								endColumn: lines[targetEnd - 1]?.length + 1 || 1
							});
						} else if (currentEdit.type === 'add') {
							editor.setPosition({ lineNumber: targetStart, column: 1 });
						}
						return;
					}
				}
				
				// Fallback to DOM query if Monaco not available
				const row = document.querySelector(`.code-line-row[data-line="${targetStart}"]`);
				if (row) {
				  // Clear previous highlights
				  document.querySelectorAll('.code-line-row.edit-target').forEach(r => r.classList.remove('edit-target'));
				  // Highlight target lines
				  if (currentEdit.type === 'replace' || currentEdit.type === 'delete') {
					for (let l = targetStart; l <= targetEnd; l++) {
					  const r = document.querySelector(`.code-line-row[data-line="${l}"]`);
					  if (r) r.classList.add(currentEdit.type === 'delete' ? 'delete-target' : 'edit-target');
					}
				  } else if (currentEdit.type === 'add') {
					row.classList.add('add-marker');
				  }
				  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
				}
			  });
			  actions.appendChild(showBtn);
			  card.appendChild(actions);

		  return card;
		}
				function _renderKnowledgeSummary() {
					const $ = (sel) => document.querySelector(sel);
					const el = $('#knowledge-summary');
					if (!el) return;
					
					const files = Object.keys(CodeSmith.knowledge.getDependencies() || {});
					const allSymbols = CodeSmith.knowledge.getSymbolsAcrossProject();
					const issues = CodeSmith.knowledge.getKnownIssues();
					const deps = CodeSmith.knowledge.getDependencies();
					
					if (allSymbols.length === 0 && issues.length === 0) { el.hidden = true; return; }
					el.hidden = false;
					el.replaceChildren();
					
					const label = document.createElement('div');
					label.className = 'analysis-label';
					label.style.color = '#a855f7';
					label.textContent = 'Project Knowledge';
					el.appendChild(label);
					
					// Symbol count
					const funcs = allSymbols.filter(s => s.kind === 'def' || s.kind === 'function');
					const classes = allSymbols.filter(s => s.kind === 'class');
					if (funcs.length > 0 || classes.length > 0) {
						const line = document.createElement('div');
						line.style.cssText = 'font-size:10px;color:#8b92a1;margin-bottom:4px;';
						line.textContent = funcs.length + ' functions, ' + classes.length + ' classes across project';
						el.appendChild(line);
					}
					
					// External deps
					const depNames = Object.keys(deps);
					if (depNames.length > 0) {
						const depLine = document.createElement('div');
						depLine.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin-bottom:4px;';
						for (const d of depNames) {
						const badge = document.createElement('span');
						badge.className = 'knowledge-badge dep';
						badge.textContent = d;
						badge.title = 'Used in: ' + deps[d].files.join(', ');
						depLine.appendChild(badge);
						}
						el.appendChild(depLine);
					}
					
					// High issues
					const highIssues = issues.filter(i => i.severity === 'high');
					if (highIssues.length > 0) {
						const issLine = document.createElement('div');
						issLine.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;';
						for (const iss of highIssues.slice(0, 5)) {
						const badge = document.createElement('span');
						badge.className = 'knowledge-badge issue';
						badge.textContent = (iss.file || '?') + ':' + (iss.line || '?');
						badge.title = iss.message;
						badge.style.cursor = 'pointer';
						badge.addEventListener('click', () => {
							const editor = CodeSmith.monaco.getEditor();
							if (editor && iss.line) {
							editor.revealLineInCenter(iss.line);
							editor.setPosition({ lineNumber: iss.line, column: 1 });
							editor.focus();
							}
						});
						issLine.appendChild(badge);
						}
						el.appendChild(issLine);
					}
					}
					
					// Contextual function actions (right-click on function names in analysis)
					function _showFunctionActions(x, y, funcName, filename, lineNum) {
					const pairInput = document.querySelector('#pair-input');
					_showContextMenu(x, y, [
						{ label: '🐛 Find bugs in ' + funcName, action: () => { pairInput.value = 'Find bugs in the function ' + funcName + ' (line ' + lineNum + ')'; document.querySelector('#btn-pair-send')?.click(); _switchToAiTab('pair'); } },
						{ label: '⚡ Optimize ' + funcName, action: () => { pairInput.value = 'Optimize the function ' + funcName + ' for performance'; document.querySelector('#btn-pair-send')?.click(); _switchToAiTab('pair'); } },
						{ label: '🧪 Write tests for ' + funcName, action: () => { pairInput.value = 'Write comprehensive tests for ' + funcName; document.querySelector('#btn-pair-send')?.click(); _switchToAiTab('pair'); } },
						{ label: '📝 Document ' + funcName, action: () => { pairInput.value = 'Add a detailed docstring to ' + funcName; document.querySelector('#btn-pair-send')?.click(); _switchToAiTab('pair'); } },
						'sep',
						{ label: '🔀 Show flowchart', action: () => { document.querySelector('#btn-explorer-algo')?.click(); _switchToAiTab('algo'); } },
						{ label: '📋 Go to line ' + lineNum, action: () => { const editor = CodeSmith.monaco.getEditor(); if (editor) { editor.revealLineInCenter(lineNum); editor.setPosition({ lineNumber: lineNum, column: 1 }); editor.focus(); } } },
					]);
					}
					
					function _switchToAiTab(tabName) {
					document.querySelectorAll('.ai-tab').forEach(t => t.classList.remove('active'));
					document.querySelectorAll('.explorer-ai-content').forEach(c => c.classList.remove('active'));
					const tab = document.querySelector(`.ai-tab[data-aitab="${tabName}"]`);
					const content = document.querySelector(`[data-aicontent="${tabName}"]`);
					if (tab) tab.classList.add('active');
					if (content) content.classList.add('active');
					}
					
	function _showContextMenu(x, y, items) {
		  // Remove existing
		  document.querySelectorAll('.ctx-menu').forEach(m => m.remove());
		 
		  const menu = document.createElement('div');
		  menu.className = 'ctx-menu';
		  menu.style.left = x + 'px';
		  menu.style.top = y + 'px';
		 
		  for (const item of items) {
		    if (item === 'sep') {
		      menu.appendChild(document.createElement('div'));
		      menu.lastChild.className = 'ctx-menu-sep';
		      continue;
		    }
		    const row = document.createElement('div');
		    row.className = 'ctx-menu-item' + (item.cls ? ' ' + item.cls : '');
		    row.textContent = item.label;
		    if (item.shortcut) {
		      const sc = document.createElement('span');
		      sc.className = 'ctx-menu-shortcut';
		      sc.textContent = item.shortcut;
		      row.appendChild(sc);
		    }
		    row.addEventListener('click', () => { menu.remove(); item.action(); });
		    menu.appendChild(row);
		  }
		 
		  // Keep on screen
		  document.body.appendChild(menu);
		  const rect = menu.getBoundingClientRect();
		  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
		  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
		 
		  // Close on click outside
		  const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close); } };
		  setTimeout(() => document.addEventListener('click', close), 0);
		}
		// Mode switching for explore mode — add to wireMode()
		function _wireExploreMode() {
		  const $ = (sel) => document.querySelector(sel);
		 
		  // Bottom bar toggles
		  if (!$('#btn-toggle-problems')) return; // Explorer panel not in DOM
			$('#btn-toggle-problems').addEventListener('click', () => {
		    const panel = $('#diagnostics-panel');
		    panel.hidden = !panel.hidden;
		    $('#btn-toggle-problems').classList.toggle('active', !panel.hidden);
		  });
		 
		  $('#btn-toggle-terminal').addEventListener('click', async () => {
		    const panel = $('#integrated-terminal');
		    panel.hidden = !panel.hidden;
		    $('#btn-toggle-terminal').classList.toggle('active', !panel.hidden);
		    if (!panel.hidden && !CodeSmith.terminal.isInitialized()) {
		      await CodeSmith.sandbox.warmUp();
		      await CodeSmith.terminal.init($('#terminal-body'));
		    }
		    if (!panel.hidden) CodeSmith.terminal.fit();
		  });
		 
		  $('#btn-toggle-snapshots').addEventListener('click', () => {
		    const panel = $('#snapshots-panel');
		    panel.hidden = !panel.hidden;
		    $('#btn-toggle-snapshots').classList.toggle('active', !panel.hidden);
		    _renderSnapshots();
		  });
		 
		  // Terminal controls
		  $('#btn-terminal-clear').addEventListener('click', () => CodeSmith.terminal.clear());
		  $('#btn-terminal-close').addEventListener('click', () => {
		    $('#integrated-terminal').hidden = true;
		    $('#btn-toggle-terminal').classList.remove('active');
		  });
		 
		  // Snapshot button
		  $('#btn-explorer-snapshot').addEventListener('click', () => {
		    const name = CodeSmith.explorer.getActiveFile();
		    if (!name) return;
		    const file = CodeSmith.explorer.getFile(name);
		    if (!file) return;
		    const label = prompt('Snapshot label:', 'Manual snapshot');
		    if (label === null) return;
		    CodeSmith.snapshots.take(name, file.content, label);
		    _renderSnapshots();
		  });
		 
		  // Monaco change listener for live diagnostics
		  CodeSmith.monaco.onChange((filename, content) => {
		    clearTimeout(_diagDebounce);
		    _diagDebounce = setTimeout(() => _runLiveDiagnostics(filename), 500);
		  });
		 // Zen mode toggle: Ctrl+Shift+Z or Escape to exit
			  document.addEventListener('keydown', (ev) => {
			    if (ev.ctrlKey && ev.shiftKey && ev.key === 'Z') {
			      ev.preventDefault();
			      document.body.classList.toggle('zen-mode');
			    }
			    if (ev.key === 'Escape' && document.body.classList.contains('zen-mode')) {
			      document.body.classList.remove('zen-mode');
			    }
			  });
			  // Ctrl+Backtick shortcut for terminal
			  document.addEventListener('keydown', (ev) => {
			    if ((ev.ctrlKey || ev.metaKey) && ev.key === '`') {
			      ev.preventDefault();
			      const btn = document.getElementById('btn-toggle-terminal');
			      if (btn) btn.click();
			    }
			  });
		}
		 
		let _diagDebounce = null;
		 
		function _runLiveDiagnostics(filename) {
		  const $ = (sel) => document.querySelector(sel);
		  const file = CodeSmith.explorer.getFile(filename);
		  if (!file) return;
		 
		  const lines = file.content.split('\n');
		  const markers = [];
		  const diagnostics = [];
		 
		  if (file.language === 'python') {
		    for (let i = 0; i < lines.length; i++) {
		      const line = lines[i];
		      const trimmed = line.trimStart();
		 
		      // Syntax issues
		      if (/\t/.test(line) && /^ /.test(line)) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'Mixed tabs and spaces', severity: 'warning' });
		      }
		      if (trimmed.length > 120) {
		        diagnostics.push({ line: i + 1, col: 120, msg: 'Line exceeds 120 characters (' + trimmed.length + ')', severity: 'info' });
		      }
		      if (/except\s*:/.test(trimmed) && !/except\s+\w/.test(trimmed)) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'Bare except clause — catch specific exceptions', severity: 'warning' });
		      }
		      if (/==\s*None/.test(trimmed) || /!=\s*None/.test(trimmed)) {
		        diagnostics.push({ line: i + 1, col: line.indexOf('None'), msg: 'Use "is None" or "is not None" instead of == / !=', severity: 'warning' });
		      }
		      if (/print\s*\(/.test(trimmed) && !trimmed.startsWith('#')) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'print() statement found — consider using logging', severity: 'info' });
		      }
		      if (/import \*/.test(trimmed)) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'Wildcard import — import specific names', severity: 'warning' });
		      }
		      // Undefined variable hint: basic pattern
		      const assignMatch = trimmed.match(/^(\w+)\s*=[^=]/);
		      if (/^\s*(def|class)\s+\w+.*:\s*$/.test(line)) {
		        // Check next line for pass or docstring
		        if (i + 1 < lines.length && lines[i + 1].trim() === '') {
		          diagnostics.push({ line: i + 1, col: 1, msg: 'Empty function/class body — add pass or implementation', severity: 'warning' });
		        }
		      }
		    }
		  } else if (file.language === 'javascript' || file.language === 'typescript') {
		    for (let i = 0; i < lines.length; i++) {
		      const line = lines[i];
		      const trimmed = line.trimStart();
		 
		      if (/\bvar\b/.test(trimmed) && !trimmed.startsWith('//')) {
		        diagnostics.push({ line: i + 1, col: line.indexOf('var') + 1, msg: 'Use const or let instead of var', severity: 'warning' });
		      }
		      if (/==(?!=)/.test(trimmed) && !/===/.test(trimmed) && !trimmed.startsWith('//')) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'Use === instead of == for strict equality', severity: 'warning' });
		      }
		      if (/console\.log/.test(trimmed) && !trimmed.startsWith('//')) {
		        diagnostics.push({ line: i + 1, col: 1, msg: 'console.log found — remove before production', severity: 'info' });
		      }
		      if (trimmed.length > 120) {
		        diagnostics.push({ line: i + 1, col: 120, msg: 'Line exceeds 120 characters', severity: 'info' });
		      }
		    }
		  }
		 
		  // Set Monaco markers
		  if (CodeSmith.monaco.isInitialized() && typeof monaco !== 'undefined') {
		    const monacoMarkers = diagnostics.map(d => ({
		      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error
		              : d.severity === 'warning' ? monaco.MarkerSeverity.Warning
		              : monaco.MarkerSeverity.Info,
		      startLineNumber: d.line,
		      startColumn: d.col || 1,
		      endLineNumber: d.line,
		      endColumn: (lines[d.line - 1] || '').length + 1,
		      message: d.msg,
		      source: 'CodeSmith',
		    }));
		    CodeSmith.monaco.setDiagnostics(filename, monacoMarkers);
		  }
		 
		  // Update diagnostics panel
		  const panel = $('#diagnostics-panel');
		  const list = $('#diagnostics-list');
		  const errCount = diagnostics.filter(d => d.severity === 'error').length;
		  const warnCount = diagnostics.filter(d => d.severity === 'warning').length;
		 
		  const errEl = $('#diag-error-count');
		  const warnEl = $('#diag-warn-count');
		  if (errCount > 0) { errEl.hidden = false; errEl.textContent = errCount + ' errors'; }
		  else { errEl.hidden = true; }
		  if (warnCount > 0) { warnEl.hidden = false; warnEl.textContent = warnCount + ' warnings'; }
		  else { warnEl.hidden = true; }
		 
		  list.replaceChildren();
		  for (const d of diagnostics) {
		    const item = document.createElement('div');
		    item.className = 'diag-item';
		    const icon = d.severity === 'error' ? '🔴' : d.severity === 'warning' ? '🟡' : '🔵';
		    item.innerHTML = `<span class="diag-icon">${icon}</span>
		      <span class="diag-loc">${filename}:${d.line}</span>
		      <span class="diag-msg">${d.msg}</span>`;
		    item.addEventListener('click', () => {
		      const editor = CodeSmith.monaco.getEditor();
		      if (editor) {
		        editor.revealLineInCenter(d.line);
		        editor.setPosition({ lineNumber: d.line, column: d.col || 1 });
		        editor.focus();
		      }
		    });
		    list.appendChild(item);
		  }
		}
		 
		function _renderSnapshots() {
		  const $ = (sel) => document.querySelector(sel);
		  const list = $('#snapshots-list');
		  if (!list) return;
		  list.replaceChildren();
		 
		  const filename = CodeSmith.explorer.getActiveFile();
		  const snaps = CodeSmith.snapshots.list(filename);
		 
		  if (snaps.length === 0) {
		    list.innerHTML = '<div style="padding:12px;text-align:center;font-size:11px;color:#5b6474;">No snapshots yet. Click 📸 to save one.</div>';
		    return;
		  }
		 
		  for (const snap of snaps.reverse()) {
		    const item = document.createElement('div');
		    item.className = 'snapshot-item';
		    const time = new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
		    const lineCount = snap.content.split('\n').length;
		    item.innerHTML = `<span class="snap-time">${time}</span>
		      <span class="snap-label">${snap.label}</span>
		      <span class="snap-changes">${lineCount}L</span>`;
		 
		    item.addEventListener('click', () => {
		      const file = CodeSmith.explorer.getFile(snap.filename);
		      if (!file) return;
		      // Show diff
		      const container = document.createElement('div');
		      container.className = 'diff-container';
		      container.style.cssText = 'position:fixed;inset:0;z-index:80;background:#0b0d10;display:flex;flex-direction:column;';
		      const header = document.createElement('div');
		      header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);background:#141820;';
		      header.innerHTML = `<span style="font-size:12px;font-weight:600;color:#e8ecf1;">Diff: ${snap.label}</span>
		        <span style="font-size:10px;color:#5b6474;">${snap.filename}</span>`;
		      const closeBtn = document.createElement('button');
		      closeBtn.className = 'btn btn-ghost';
		      closeBtn.style.cssText = 'margin-left:auto;font-size:11px;';
		      closeBtn.textContent = 'Close';
		      closeBtn.addEventListener('click', () => { CodeSmith.monaco.disposeDiff(); container.remove(); });
		      const restoreBtn = document.createElement('button');
		      restoreBtn.className = 'btn btn-primary';
		      restoreBtn.style.cssText = 'font-size:11px;';
		      restoreBtn.textContent = 'Restore this version';
		      restoreBtn.addEventListener('click', () => {
		        CodeSmith.explorer.updateFileContent(snap.filename, snap.content);
		        CodeSmith.monaco.updateContent(snap.filename, snap.content);
		        CodeSmith.monaco.disposeDiff();
		        container.remove();
		        _explorerRenderTree();
		      });
		      header.appendChild(restoreBtn);
		      header.appendChild(closeBtn);
		      container.appendChild(header);
		      const diffBody = document.createElement('div');
		      diffBody.style.cssText = 'flex:1;min-height:0;';
		      container.appendChild(diffBody);
		      document.body.appendChild(container);
		      CodeSmith.monaco.showDiffView(diffBody, snap.content, file.content, file.language);
		    });
		 
		    list.appendChild(item);
		  }
		}

	  // ---- Day 7: Error recovery ---------------------------------------------
	  function wireErrorRecovery() {
		window.addEventListener('error', (ev) => {
		  console.error('[CodeSmith] Uncaught:', ev.error);
		});
		window.addEventListener('unhandledrejection', (ev) => {
		  console.error('[CodeSmith] Unhandled rejection:', ev.reason);
		});
	  }

	  async function checkIncompleteBuilds() {
		const sess = CodeSmith.state.sessions.find(s => s.id === CodeSmith.state.currentId);
		if (!sess || !sess.stageB) return;
		const skel = sess.stageB.skeleton;
		if (!skel) return;
		// Check if we have some but not all artifacts
		let artifacts;
		try { artifacts = await CodeSmith.db.listArtifacts(); } catch { return; }
		const sessionArts = artifacts.filter(a => a.sessionId === sess.id);
		const total = skel.build_order ? skel.build_order.length : 0;
		if (sessionArts.length > 0 && sessionArts.length < total) {
		  // Show resume prompt in chat
		  const chatList = $('#chat-list');
		  if (!chatList) return;
		  const row = el('div', { class: 'flex justify-center', style: 'padding:12px;' });
		  const card = el('div', { class: 'panel', style: 'padding:12px 16px;text-align:center;max-width:400px;' });
		  card.appendChild(el('div', { style: 'font-size:13px;color:#e8ecf1;margin-bottom:8px;' },
			'Incomplete build detected (' + sessionArts.length + '/' + total + ' modules)'));
		  const resumeBtn = el('button', { class: 'btn btn-primary', style: 'font-size:12px;margin-right:6px;' }, 'Resume build');
		  const dismissBtn = el('button', { class: 'btn', style: 'font-size:12px;' }, 'Dismiss');
		  resumeBtn.addEventListener('click', () => {
			row.remove();
			// Switch to build mode and Stage C
			document.querySelector('.mode-btn[data-mode="build"]').click();
			_showStep('c');
		  });
		  dismissBtn.addEventListener('click', () => row.remove());
		  card.appendChild(resumeBtn);
		  card.appendChild(dismissBtn);
		  row.appendChild(card);
		  chatList.prepend(row);
		}
	  }
		  // ---- Endpoint config helpers -------------------------------------------
		  function _renderEndpoints(endpoints) {
		    const list = $('#endpoint-list');
		    if (!list) return;
		    list.replaceChildren();
		    (endpoints || []).forEach((ep, i) => list.appendChild(_createEndpointRow(ep, i)));
		  }
		
		  function _createEndpointRow(ep, idx) {
		    const row = el('div', { class: 'panel', style: 'padding:8px;font-size:11px;' });
		    row.innerHTML = `
		      <div style="display:flex;gap:6px;margin-bottom:4px;">
		        <select class="ep-tier" style="background:#0f1319;color:#e8ecf1;border:1px solid rgba(255,255,255,0.06);border-radius:4px;padding:3px 6px;font-size:11px;">
		          <option value="orchestrator" ${ep.forTier === 'orchestrator' ? 'selected' : ''}>Orchestrator</option>
		          <option value="worker" ${ep.forTier === 'worker' ? 'selected' : ''}>Worker</option>
		          <option value="fast" ${ep.forTier === 'fast' ? 'selected' : ''}>Fast</option>
		        </select>
		        <input class="ep-url" type="url" placeholder="API URL" value="${ep.apiUrl || ''}" style="flex:1;font-size:11px;padding:3px 6px;" />
				<button class="btn btn-ghost ep-test" style="font-size:10px;color:#4ade80;padding:2px 6px;">Test</button>
				<button class="btn btn-ghost ep-remove" style="font-size:10px;color:#ff6b6b;padding:2px 6px;">✕</button>		      </div>
		      <div style="display:flex;gap:6px;">
		        <input class="ep-key" type="password" placeholder="API key" value="${ep.apiKey || ''}" style="flex:1;font-size:11px;padding:3px 6px;" />
		        <input class="ep-model" type="text" placeholder="Model ID" value="${ep.model || ''}" style="flex:1;font-size:11px;padding:3px 6px;font-family:monospace;" />
		      </div>
		    `;
			row.querySelector('.ep-test').addEventListener('click', async () => {
				const btn = row.querySelector('.ep-test');
				btn.textContent = '...';
				btn.disabled = true;
				try {
					const res = await CodeSmith.api.testConnection({
					apiUrl: row.querySelector('.ep-url').value.trim(),
					apiKey: row.querySelector('.ep-key').value,
					model: row.querySelector('.ep-model').value.trim(),
					});
					btn.textContent = '✓ ' + (res.model || 'OK').slice(0, 20);
					btn.style.color = '#4ade80';
				} catch (err) {
					btn.textContent = '✗ ' + (err.message || '').slice(0, 30);
					btn.style.color = '#ff6b6b';
				} finally {
					setTimeout(() => { btn.disabled = false; btn.textContent = 'Test'; btn.style.color = '#4ade80'; }, 4000);
				}
				});
			row.querySelector('.ep-remove').addEventListener('click', (ev) => {
				ev.preventDefault();
				ev.stopPropagation();
				row.remove();
				});	

		    return row;
		  }
		
		  function _collectEndpoints() {
		    const list = $('#endpoint-list');
		    if (!list) return [];
		    return Array.from(list.children).map(row => ({
		      forTier: row.querySelector('.ep-tier')?.value || 'worker',
		      apiUrl: row.querySelector('.ep-url')?.value?.trim() || '',
		      apiKey: row.querySelector('.ep-key')?.value || '',
		      model: row.querySelector('.ep-model')?.value?.trim() || '',
		    })).filter(ep => ep.apiUrl && ep.apiKey);
		  }
		return {
			wire, refreshSessions, renderChat, renderSessionList,
			renderStatusStrip, renderComposerHelp, newSession,
			runBuildPipeline, renderArtifactList, updateBuildPanel,
			startBuildMode, checkOnboarding, checkIncompleteBuilds,
			 updatePageTitle, openHelp, openCommandPalette, getTelemetry, wireExplorer, _renderSnapshots,runInBrowser};
	})();
CodeSmith.ui = UI;


/* ============================================================================
 * 5. BOOT
 * ==========================================================================*/
(async function boot() {
		/* ============================================================================
	 * MOBILE INITIALIZATION
	 * ==========================================================================*/
	// Detect mobile and apply initial optimizations
	if (window.innerWidth <= 768) {
	  document.body.classList.add('mobile-view');
	  // Ensure sidebar is collapsed on load
	  const sidebar = document.getElementById('sidebar');
	  if (sidebar) sidebar.classList.add('collapsed');
	}
	
	// Handle orientation changes
	window.addEventListener('resize', () => {
	  const isMobile = window.innerWidth <= 768;
	  document.body.classList.toggle('mobile-view', isMobile);
	  if (!isMobile) {
	  // Reset mobile-specific states when going back to desktop
	    const sidebar = document.getElementById('sidebar');
	    if (sidebar) sidebar.classList.remove('collapsed');
	  }
	});
  try {
		// Canonical source notice (non-blocking)
		try {
		const host = window.location.hostname;
		const isCanonical = host === 'khalecl.github.io' || host === 'localhost' || host === '127.0.0.1' || host === '';
		if (!isCanonical) {
			const banner = document.createElement('div');
			banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1f2a;color:#e8ecf1;padding:8px 14px;text-align:center;font-size:12px;z-index:9999;border-bottom:1px solid #4f8cff;font-family:system-ui;';
			banner.innerHTML = '⚡ This is an unofficial copy of <strong>CodeSmith</strong>. The official version is at <a href="https://khalecl.github.io/codesmith/" style="color:#4f8cff;font-weight:600;">khalecl.github.io/codesmith</a> by Khaled Diab. <button onclick="this.parentElement.remove()" style="margin-left:8px;background:transparent;border:1px solid #4f8cff;color:#4f8cff;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">Dismiss</button>';
			document.body.insertBefore(banner, document.body.firstChild);
		}
		} catch {}
    await CodeSmith.db.init();
    const saved = await CodeSmith.db.getSettings();
    CodeSmith.state.settings = saved || { ...CodeSmith.DEFAULTS };
    await CodeSmith.ui.refreshSessions();
    // Select most recent session if any
	if (CodeSmith.state.sessions.length > 0) {
		const first = CodeSmith.state.sessions[0];
		CodeSmith.state.currentId = first.id;
		if (first.stageA && first.stageA.spec) {
			CodeSmith.stageA.start(first.stageA.spec.goal || '');
			CodeSmith.stageA.setSpec(first.stageA.spec);
		}
		if (first.stageB && first.stageB.skeleton) {
			CodeSmith.stageB.setSkeleton(
			first.stageB.skeleton,
			first.stageB.approvedSpec,
			first.stageB.mermaidDef
			);
		}
		}
try { CodeSmith.ui.wire(); } catch(e) { console.error('wire FAILED:', e); }
    try { CodeSmith.ui.renderStatusStrip(); } catch(e) { console.error('renderStatusStrip FAILED:', e); }
    try { CodeSmith.ui.renderComposerHelp(); } catch(e) { console.error('renderComposerHelp FAILED:', e); }
    try { CodeSmith.ui.renderChat(); } catch(e) { console.error('renderChat FAILED:', e); }
    try { CodeSmith.ui.renderArtifactList(); } catch(e) { console.error('renderArtifactList FAILED:', e); }
    try { CodeSmith.ui.checkOnboarding(); } catch(e) { console.error('checkOnboarding FAILED:', e); }
    try { CodeSmith.ui.checkIncompleteBuilds(); } catch(e) { console.error('checkIncompleteBuilds FAILED:', e); }
    try { CodeSmith.ui.updatePageTitle(); } catch(e) { console.error('updatePageTitle FAILED:', e); }
  } catch (err) {
    // Don't leak anything sensitive; just surface a minimal error.
    console.error('[CodeSmith] boot failed:', err && err.message ? err.message : err);
    document.body.insertAdjacentHTML('beforeend',
      '<div style="position:fixed;inset:auto 16px 16px auto;padding:10px 14px;' +
      'background:#2a1418;border:1px solid #ff6b6b;border-radius:8px;color:#ff6b6b;' +
      'font:13px system-ui;z-index:80;">Failed to initialize. See console.</div>');
  }
})();
</script>
