const STORAGE_KEY = "homepage-theme";
const THEME_ICON_PATHS = {
  light: "./assets/icons/light_mode.svg",
  dark: "./assets/icons/dark_mode.svg",
};

function isTheme(value) {
  return value === "light" || value === "dark";
}

export function createThemeController(context, localeStore) {
  const { baseUrl, rootElement, window: windowObject } = context;
  const { themeToggleButtons } = context.elements;

  function getCurrentTheme() {
    return isTheme(rootElement.dataset.theme) ? rootElement.dataset.theme : "light";
  }

  function getNextTheme(theme) {
    return theme === "dark" ? "light" : "dark";
  }

  function persistTheme(theme) {
    try {
      windowObject.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn(error);
    }
  }

  function resolveThemeIconUrl(theme) {
    const path = THEME_ICON_PATHS[theme] ?? THEME_ICON_PATHS.light;
    return new URL(path, baseUrl).href;
  }

  function updateToggleButtons(theme = getCurrentTheme()) {
    const nextTheme = getNextTheme(theme);
    const textKey = nextTheme === "dark" ? "labels.themeDark" : "labels.themeLight";
    const ariaKey = nextTheme === "dark" ? "labels.switchToDark" : "labels.switchToLight";
    const visibleLabel = localeStore.getValue(textKey);
    const actionLabel = localeStore.getValue(ariaKey);
    const iconUrl = resolveThemeIconUrl(nextTheme);

    themeToggleButtons.forEach((button) => {
      const srLabel = button.querySelector("[data-theme-toggle-label]");

      button.dataset.themeTarget = nextTheme;
      button.style.setProperty("--theme-icon-url", `url("${iconUrl}")`);
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("title", actionLabel);
      button.setAttribute("aria-pressed", String(theme === "dark"));

      if (srLabel) {
        srLabel.textContent = visibleLabel;
      }
    });

    rootElement.style.setProperty("--theme-toggle-icon-url", `url("${iconUrl}")`);
  }

  function applyTheme(theme, options = {}) {
    const { persist = true } = options;

    rootElement.dataset.theme = theme;
    rootElement.style.colorScheme = theme;

    if (persist) {
      persistTheme(theme);
    }

    updateToggleButtons(theme);
  }

  function initialize() {
    const currentTheme = getCurrentTheme();
    rootElement.style.colorScheme = currentTheme;
    updateToggleButtons(currentTheme);

    themeToggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const targetTheme = isTheme(button.dataset.themeTarget)
          ? button.dataset.themeTarget
          : getNextTheme(getCurrentTheme());

        applyTheme(targetTheme);
      });
    });
  }

  return {
    initialize,
  };
}
