import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import type { Plugin } from "vite";
import devReloadSSE from "./vite-dev-reload";

const DEV_WS_MUTE_SCRIPT = `
      // Mute Vite's HMR-failure noise. Native HMR is off (vite.config.ts:
      // server.hmr=false) because the runtime preview proxy is HTTP-only;
      // reload comes from the SSE dev-reload plugin instead. @vite/client
      // still attempts a WS connection regardless of hmr:false, so two layers:
      //  1. Stub WebSocket for subprotocol 'vite-hmr' — the synthetic close
      //     skips the network entirely, so the browser never logs its native
      //     "WebSocket connection ... failed:" line (that line bypasses
      //     console.* and can't be filtered any other way). Vite's transport
      //     rejects with "closed without opened", matching its expected path.
      //  2. Filter "failed to connect to websocket" from console.warn/error,
      //     covering Vite's own diagnostic at client.mjs:861/868.
      // Must run before @vite/client loads.
      (function () {
        const RealWS = window.WebSocket;
        function StubWS(url, protocols) {
          const isHmr =
            protocols === 'vite-hmr' ||
            (Array.isArray(protocols) && protocols.includes('vite-hmr'));
          if (!isHmr) return new RealWS(url, protocols);
          const listeners = { close: [], error: [], open: [], message: [] };
          const fake = {
            readyState: 0,
            url: url,
            protocol: '',
            send: function () {},
            close: function () {},
            addEventListener: function (type, fn) {
              (listeners[type] || (listeners[type] = [])).push(fn);
            },
            removeEventListener: function (type, fn) {
              const arr = listeners[type]; if (!arr) return;
              const i = arr.indexOf(fn); if (i >= 0) arr.splice(i, 1);
            },
            dispatchEvent: function () { return true; },
            onopen: null, onclose: null, onerror: null, onmessage: null,
          };
          queueMicrotask(function () {
            fake.readyState = 3;
            const ev = new CloseEvent('close', { code: 1006, reason: '', wasClean: false });
            listeners.close.forEach(function (fn) { try { fn.call(fake, ev); } catch (e) {} });
            if (typeof fake.onclose === 'function') { try { fake.onclose(ev); } catch (e) {} }
          });
          return fake;
        }
        StubWS.CONNECTING = 0;
        StubWS.OPEN = 1;
        StubWS.CLOSING = 2;
        StubWS.CLOSED = 3;
        StubWS.prototype = RealWS.prototype;
        window.WebSocket = StubWS;

        ['warn', 'error'].forEach(function (level) {
          const orig = console[level];
          console[level] = function () {
            const first = arguments[0];
            if (typeof first === 'string' && first.includes('failed to connect to websocket')) return;
            return orig.apply(console, arguments);
          };
        });
      })();
    `;

function devWsMute(): Plugin {
  return {
    name: "aether-dev-ws-mute",
    apply: "serve",
    transformIndexHtml(html: string) {
      return {
        html,
        tags: [
          { tag: "script", injectTo: "head-prepend", children: DEV_WS_MUTE_SCRIPT },
        ],
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const envDir = process.cwd();
  const env = loadEnv(mode, envDir, "");
  const isVercel = Boolean(process.env.VERCEL);

  // Use "/" by default (required for clean SPA routing on Vercel) unless
  // VITE_BASE is explicitly set (e.g., orchestrator dev proxy paths).
  const base = env.VITE_BASE || "/";

  console.log(
    `[vite.config] mode=${mode} envDir=${envDir} base=${base} vercel=${isVercel} reload=sse`
  );

  return {
    plugins: [react(), tailwindcss(), devReloadSSE(), devWsMute()],
    base,
    assetsInclude: ["**/*.glb", "**/*.gltf", "**/*.obj", "**/*.stl"],
    cacheDir: process.env.AETHER_VITE_CACHE_DIR || path.resolve(envDir, ".vite-cache"),
    resolve: {
      alias: {
        "@": path.resolve(envDir, "src"),
        "@tanstack/react-query": path.resolve(
          envDir,
          "node_modules/@tanstack/react-query/src/index.ts"
        ),
        "@tanstack/query-core": path.resolve(
          envDir,
          "node_modules/@tanstack/query-core/src/index.ts"
        ),
        "@tanstack/react-table": path.resolve(
          envDir,
          "node_modules/@tanstack/react-table/src/index.tsx"
        ),
        "@tanstack/table-core": path.resolve(
          envDir,
          "node_modules/@tanstack/table-core/src/index.ts"
        ),
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      write: process.env.VITE_CHECK_MODE !== "true",
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      ...(process.env.AETHER_VITE_CACHE_DIR
        ? {
            fs: {
              allow: [
                searchForWorkspaceRoot(process.cwd()),
                process.env.AETHER_VITE_CACHE_DIR,
              ],
            },
          }
        : {}),
      host: "127.0.0.1",
      hmr: false,
      watch: {
        // Only enable polling outside Vercel builds where FUSE/rclone mounts lack inotify.
        usePolling: !isVercel,
        interval: 500,
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/.vite-cache/**",
          "**/dist/**",
          "**/.dev-server.log",
          "**/.browser-errors.log",
          "**/.browser-errors.seq",
          "**/*.timestamp-*.mjs",
          "**/*.timestamp-*.cjs",
          "**/ms.config.json",
        ],
      },
    },
    optimizeDeps: {
      holdUntilCrawlEnd: true,
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/client",
        "radix-ui",
        "@dnd-kit/core",
        "@dnd-kit/sortable",
        "@dnd-kit/utilities",
        "@microsoft/managed-apps/data",
        "@zxing/library",
        "leaflet",
        "html2canvas-pro",
        "jspdf",
        "three",
        "three/examples/jsm/controls/OrbitControls.js",
        "three/examples/jsm/loaders/GLTFLoader.js",
        "three/examples/jsm/loaders/OBJLoader.js",
        "three/examples/jsm/loaders/STLLoader.js",
        "three/examples/jsm/environments/RoomEnvironment.js",
        "@tanstack/react-query",
        "class-variance-authority",
        "clsx",
        "cmdk",
        "date-fns",
        "zustand",
        "lucide-react",
        "motion",
        "react-day-picker",
        "react-router-dom",
        "react-webcam",
        "recharts",
        "signature_pad",
        "sonner",
        "tailwind-merge",
        "unpdf",
        "xlsx",
      ],
    },
  };
});
