import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./static-server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {
    port: 4173,
    url: null,
    headed: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

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
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/e2e-test.mjs [--url <origin>] [--port <port>] [--headed]

Runs lightweight Playwright end-to-end checks against the built static site.
If --url is omitted, a local static server is started automatically.`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      'Playwright is required for end-to-end tests. Install it with "npm install -D playwright" and run "npx playwright install chromium".',
    );
  }
}

async function waitForHomepageReady(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    if (window.__homepageBenchmark?.status === "ready") {
      return;
    }

    if (window.__homepageBenchmark?.status === "error") {
      throw new Error(window.__homepageBenchmark.message ?? "Application initialization failed.");
    }

    return new Promise((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
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
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectSectionNearTop(page, sectionId) {
  const deadline = Date.now() + 3000;
  let metrics = null;

  while (Date.now() < deadline) {
    metrics = await page.evaluate((targetId) => {
      const section = document.getElementById(targetId);
      const header = document.querySelector(".site-header");
      if (!section) {
        return null;
      }

      return {
        top: section.getBoundingClientRect().top,
        headerHeight: Math.ceil(header?.getBoundingClientRect().height ?? 0),
        viewportHeight: window.innerHeight,
        reachedPageEnd:
          Math.ceil(window.scrollY + window.innerHeight) >=
          Math.floor(document.documentElement.scrollHeight),
      };
    }, sectionId);

    assert(metrics, `Section #${sectionId} was not found.`);

    const nearTop = metrics.top >= 0 && metrics.top <= metrics.headerHeight + 48;
    const nearTopAtPageEnd =
      metrics.reachedPageEnd && metrics.top >= 0 && metrics.top <= Math.min(metrics.viewportHeight / 3, 160);

    if (nearTop || nearTopAtPageEnd) {
      return;
    }

    await page.waitForTimeout(50);
  }

  assert(
    false,
    `Section #${sectionId} was not positioned near the top after navigation. Last top=${metrics?.top}, headerHeight=${metrics?.headerHeight}.`,
  );
}

async function testLanguageSwitch(browserType, origin, headed) {
  const browser = await browserType.launch({ headless: !headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL("/", origin).href);
    await waitForHomepageReady(page);

    const initialName = (await page.textContent("h1.name"))?.trim() ?? "";
    const initialTitle = await page.title();
    assert(
      initialTitle === `${initialName} | 研究者プロフィール`,
      `Unexpected Japanese page title: ${initialTitle}`,
    );

    await page.getByRole("link", { name: "English" }).click();
    await page.waitForURL("**/en/index.html");
    await waitForHomepageReady(page);

    const currentLanguage = await page.getAttribute("html", "lang");
    assert(currentLanguage === "en", `Language switch did not update html lang: ${currentLanguage}`);

    const switchedName = (await page.textContent("h1.name"))?.trim() ?? "";
    const switchedTitle = await page.title();
    assert(
      switchedTitle === `${switchedName} | Research Profile`,
      `Unexpected English page title: ${switchedTitle}`,
    );

    assert(switchedName.length > 0, "English language switch did not render the English page.");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function testThemePersistence(browserType, origin, headed) {
  const browser = await browserType.launch({ headless: !headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL("/", origin).href);
    await waitForHomepageReady(page);

    const initialTheme = await page.getAttribute("html", "data-theme");
    await page.locator("[data-theme-toggle]").click();
    await page.waitForFunction(
      (theme) => document.documentElement.dataset.theme && document.documentElement.dataset.theme !== theme,
      initialTheme,
    );

    const toggledTheme = await page.getAttribute("html", "data-theme");
    const storedTheme = await page.evaluate(() => window.localStorage.getItem("homepage-theme"));
    assert(toggledTheme && toggledTheme !== initialTheme, "Theme toggle did not change the active theme.");
    assert(storedTheme === toggledTheme, "Theme toggle did not persist to localStorage.");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForHomepageReady(page);

    const reloadedTheme = await page.getAttribute("html", "data-theme");
    assert(reloadedTheme === toggledTheme, "Theme did not persist after reload.");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function testNavigation(browserType, origin, headed) {
  const browser = await browserType.launch({ headless: !headed });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(new URL("/", origin).href);
    await waitForHomepageReady(page);

    await page.locator('.site-nav-button[href="#awards"]').click();
    await page.waitForURL("**#awards");
    await expectSectionNearTop(page, "awards");

    const ariaCurrent = await page.getAttribute('.site-nav-button[href="#awards"]', "aria-current");
    assert(ariaCurrent === "location", "Current section navigation state was not updated.");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function testAnchorFallbackWithoutJavaScript(browserType, origin, headed) {
  const browser = await browserType.launch({ headless: !headed });
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();

  try {
    await page.goto(new URL("/", origin).href, { waitUntil: "domcontentloaded" });

    await page.locator('.site-nav-button[href="#education"]').click();
    await page.waitForURL("**#education");
    await expectSectionNearTop(page, "education");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runTest(name, fn, failures) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) });
    console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const { chromium } = await loadPlaywright();
  let origin = options.url;
  let serverHandle = null;

  if (!origin) {
    serverHandle = await createStaticServer(rootDir, options.port);
    origin = serverHandle.origin;
  }

  const failures = [];

  try {
    await runTest("language switch", () => testLanguageSwitch(chromium, origin, options.headed), failures);
    await runTest("theme persistence", () => testThemePersistence(chromium, origin, options.headed), failures);
    await runTest("section navigation", () => testNavigation(chromium, origin, options.headed), failures);
    await runTest(
      "anchor fallback without javascript",
      () => testAnchorFallbackWithoutJavaScript(chromium, origin, options.headed),
      failures,
    );

    if (failures.length > 0) {
      throw new Error(`${failures.length} end-to-end test(s) failed.`);
    }

    console.log("End-to-end tests passed.");
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
