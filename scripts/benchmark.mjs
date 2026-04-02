import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./static-server.mjs";

function parseArgs(argv) {
  const options = {
    runs: 5,
    paths: ["/", "/en/"],
    port: 4173,
    url: null,
    headed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--runs") {
      options.runs = Number.parseInt(argv[index + 1] ?? "", 10) || options.runs;
      index += 1;
      continue;
    }

    if (argument === "--path") {
      options.paths = [argv[index + 1] ?? options.paths[0]];
      index += 1;
      continue;
    }

    if (argument === "--paths") {
      options.paths = (argv[index + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (argument === "--port") {
      options.port = Number.parseInt(argv[index + 1] ?? "", 10) || options.port;
      index += 1;
      continue;
    }

    if (argument === "--url") {
      options.url = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (argument === "--headed") {
      options.headed = true;
    }
  }

  return options;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

function roundMetric(value) {
  return value == null ? "-" : `${value.toFixed(1)} ms`;
}

function getSummary(values) {
  return {
    median: median(values),
    average: average(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      'Playwright is required for benchmarking. Install it with "npm install -D playwright" and run "npx playwright install chromium".',
    );
  }
}

async function collectMetrics(page, targetUrl) {
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

  const benchmark = await page.evaluate(() => {
    if (window.__homepageBenchmark?.status === "ready") {
      return window.__homepageBenchmark;
    }

    if (window.__homepageBenchmark?.status === "error") {
      throw new Error(window.__homepageBenchmark.message ?? "Application initialization failed.");
    }

    return new Promise((resolve, reject) => {
      const onReady = (event) => {
        cleanup();
        resolve(event.detail);
      };
      const onError = (event) => {
        cleanup();
        reject(new Error(event.detail?.message ?? "Application initialization failed."));
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new Error("Timed out while waiting for homepage:ready."));
      }, 15000);

      function cleanup() {
        window.clearTimeout(timeoutId);
        window.removeEventListener("homepage:ready", onReady);
        window.removeEventListener("homepage:error", onError);
      }

      window.addEventListener("homepage:ready", onReady, { once: true });
      window.addEventListener("homepage:error", onError, { once: true });
    });
  });

  return page.evaluate((ready) => {
    const navigationEntry = performance.getEntriesByType("navigation")[0];
    const paintEntries = performance.getEntriesByType("paint");
    const firstContentfulPaint = paintEntries.find((entry) => entry.name === "first-contentful-paint");

    return {
      readyTime: ready.readyTime,
      domContentLoaded: navigationEntry?.domContentLoadedEventEnd ?? null,
      loadEventEnd: navigationEntry?.loadEventEnd ?? null,
      firstContentfulPaint: firstContentfulPaint?.startTime ?? null,
    };
  }, benchmark);
}

async function benchmarkPath(browserType, origin, pathName, runs, headed) {
  const metrics = [];
  const targetUrl = new URL(pathName, origin).href;

  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    const browser = await browserType.launch({ headless: !headed });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      metrics.push(await collectMetrics(page, targetUrl));
    } finally {
      await context.close();
      await browser.close();
    }
  }

  return metrics;
}

function summarizePath(pathName, samples) {
  return {
    path: pathName,
    runs: samples.length,
    readyMedian: roundMetric(getSummary(samples.map((sample) => sample.readyTime)).median),
    readyAverage: roundMetric(getSummary(samples.map((sample) => sample.readyTime)).average),
    fcpMedian: roundMetric(getSummary(samples.map((sample) => sample.firstContentfulPaint)).median),
    dclMedian: roundMetric(getSummary(samples.map((sample) => sample.domContentLoaded)).median),
    loadMedian: roundMetric(getSummary(samples.map((sample) => sample.loadEventEnd)).median),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");

  const { chromium } = await loadPlaywright();

  let origin = options.url;
  let serverHandle = null;

  if (!origin) {
    serverHandle = await createStaticServer(rootDir, options.port);
    origin = serverHandle.origin;
  }

  try {
    const summaries = [];

    for (const pathName of options.paths) {
      const samples = await benchmarkPath(
        chromium,
        origin,
        pathName,
        options.runs,
        options.headed,
      );
      summaries.push(summarizePath(pathName, samples));
    }

    console.table(summaries);
  } finally {
    await new Promise((resolve, reject) => {
      if (!serverHandle) {
        resolve();
        return;
      }

      serverHandle.server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
