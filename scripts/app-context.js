const SUPPORTED_LANGUAGES = new Set(["ja", "en"]);

export function createAppContext({ document, window, history, baseUrl }) {
  const rootElement = document.documentElement;
  const currentLanguage = SUPPORTED_LANGUAGES.has(rootElement.lang.toLowerCase())
    ? rootElement.lang.toLowerCase()
    : "ja";
  const initialHash =
    typeof window.__initialHash === "string" ? window.__initialHash : window.location.hash;

  const elements = {
    headerElement: document.querySelector(".site-header"),
    navigationElement: document.querySelector(".site-nav"),
    languageSwitchLinks: Array.from(document.querySelectorAll("[data-language-switch]")),
    themeToggleButtons: Array.from(document.querySelectorAll("[data-theme-toggle]")),
    localeTextElements: Array.from(document.querySelectorAll("[data-locale-text]")),
    localeAriaLabelElements: Array.from(document.querySelectorAll("[data-locale-aria-label]")),
    localeAltElements: Array.from(document.querySelectorAll("[data-locale-alt]")),
    localeDataElement: document.getElementById("homepage-locale-data"),
  };

  function createPageUrl(language) {
    const path = language === "en" ? "./en/index.html" : "./index.html";
    const url = new URL(path, baseUrl);
    url.search = window.location.search;
    url.hash = window.location.hash || initialHash;
    return url.href;
  }

  return {
    document,
    window,
    history,
    rootElement,
    baseUrl,
    currentLanguage,
    initialHash,
    supportedLanguages: SUPPORTED_LANGUAGES,
    elements,
    createPageUrl,
  };
}
