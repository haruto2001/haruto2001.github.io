import { createAppContext } from "./scripts/app-context.js";
import { createLocaleStore } from "./scripts/locale-store.js";
import { createNavigationController } from "./scripts/navigation-controller.js";
import { createThemeController } from "./scripts/theme-controller.js";
import { createTypographyController } from "./scripts/typography-controller.js";

const context = createAppContext({
  document,
  window,
  history,
  baseUrl: new URL("./", import.meta.url),
});
const localeStore = createLocaleStore(context);
const navigationController = createNavigationController(context);
const themeController = createThemeController(context, localeStore);
const typographyController = createTypographyController(context);

function reportBenchmarkResult(status, detail = {}) {
  const result = {
    status,
    readyTime: performance.now(),
    ...detail,
  };

  window.__homepageBenchmark = result;
  window.dispatchEvent(new CustomEvent(`homepage:${status}`, { detail: result }));
}

async function initialize() {
  navigationController.initializeHeaderLayout();
  navigationController.initializeNavigation();
  await localeStore.initialize();
  themeController.initialize();
  navigationController.syncLanguageSwitchLinks();
  typographyController.apply();
  navigationController.restoreInitialScroll();
  reportBenchmarkResult("ready");
}

initialize().catch((error) => {
  console.error(error);
  reportBenchmarkResult("error", {
    message: error instanceof Error ? error.message : String(error),
  });
});
