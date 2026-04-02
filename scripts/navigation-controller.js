export function createNavigationController(context) {
  const { history, rootElement, window: windowObject } = context;
  const { headerElement, languageSwitchLinks, navigationElement } = context.elements;
  const navigationLinks = navigationElement
    ? Array.from(navigationElement.querySelectorAll("a.site-nav-button[data-target]"))
    : [];

  function replaceCurrentUrlHash(hash = "") {
    history.replaceState(
      null,
      "",
      `${windowObject.location.pathname}${windowObject.location.search}${hash}`,
    );
  }

  function syncLanguageSwitchLinks() {
    languageSwitchLinks.forEach((link) => {
      const language = link.dataset.languageSwitch;
      if (!context.supportedLanguages.has(language)) {
        return;
      }

      link.href = context.createPageUrl(language);

      if (language === context.currentLanguage) {
        link.classList.add("is-current");
        link.setAttribute("aria-current", "page");
        return;
      }

      link.classList.remove("is-current");
      link.removeAttribute("aria-current");
    });
  }

  function syncHeaderHeight() {
    if (!headerElement) {
      return 0;
    }

    const headerHeight = Math.ceil(headerElement.getBoundingClientRect().height);
    rootElement.style.setProperty("--header-height", `${headerHeight}px`);
    return headerHeight;
  }

  function getHeaderOffset() {
    return syncHeaderHeight();
  }

  function resetScrollToTop() {
    windowObject.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function scrollToSection(sectionId, options = {}) {
    const { behavior = "smooth", updateHash = false } = options;
    const section = context.document.getElementById(sectionId);
    if (!section) {
      return;
    }

    syncHeaderHeight();
    section.scrollIntoView({ block: "start", behavior });

    if (updateHash) {
      replaceCurrentUrlHash(`#${sectionId}`);
      syncLanguageSwitchLinks();
    }

    syncCurrentSectionLink(sectionId);
  }

  function syncCurrentSectionLink(currentSectionId = null) {
    navigationLinks.forEach((link) => {
      const isCurrent = Boolean(currentSectionId) && link.dataset.target === currentSectionId;
      link.classList.toggle("is-current-section", isCurrent);

      if (isCurrent) {
        link.setAttribute("aria-current", "location");
        return;
      }

      link.removeAttribute("aria-current");
    });
  }

  function detectCurrentSectionId() {
    const threshold = windowObject.scrollY + getHeaderOffset() + 48;
    let currentSectionId = null;

    const viewportBottom = Math.ceil(windowObject.scrollY + windowObject.innerHeight);
    const documentHeight = Math.floor(
      Math.max(
        context.document.documentElement.scrollHeight,
        context.document.body?.scrollHeight ?? 0,
      ),
    );

    navigationLinks.forEach((link) => {
      const sectionId = link.dataset.target;
      const section = sectionId ? context.document.getElementById(sectionId) : null;
      if (!section) {
        return;
      }

      const sectionTop = windowObject.scrollY + section.getBoundingClientRect().top;
      if (sectionTop <= threshold) {
        currentSectionId = sectionId;
      }
    });

    if (viewportBottom >= documentHeight - 2) {
      const hashSectionId = windowObject.location.hash.startsWith("#")
        ? windowObject.location.hash.slice(1)
        : "";

      if (hashSectionId && navigationLinks.some((link) => link.dataset.target === hashSectionId)) {
        return hashSectionId;
      }
    }

    return currentSectionId;
  }

  function updateCurrentSectionFromScroll() {
    syncCurrentSectionLink(detectCurrentSectionId());
  }

  function restoreInitialScroll() {
    if (!context.initialHash) {
      resetScrollToTop();
      syncLanguageSwitchLinks();
      updateCurrentSectionFromScroll();
      return;
    }

    const sectionId = context.initialHash.startsWith("#")
      ? context.initialHash.slice(1)
      : context.initialHash;

    replaceCurrentUrlHash(context.initialHash);
    scrollToSection(sectionId, { behavior: "auto" });
    syncLanguageSwitchLinks();
    updateCurrentSectionFromScroll();
  }

  function initializeHeaderLayout() {
    syncHeaderHeight();

    if (headerElement && typeof windowObject.ResizeObserver === "function") {
      const observer = new windowObject.ResizeObserver(() => {
        syncHeaderHeight();
      });
      observer.observe(headerElement);
      return;
    }

    windowObject.addEventListener("resize", syncHeaderHeight);
  }

  function initializeNavigation() {
    if (navigationElement) {
      navigationElement.addEventListener("click", (event) => {
        const link = event.target.closest("a.site-nav-button[data-target]");
        if (!link?.dataset.target) {
          return;
        }

        event.preventDefault();
        scrollToSection(link.dataset.target, { updateHash: true });
      });
    }

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    windowObject.addEventListener("scroll", updateCurrentSectionFromScroll, { passive: true });
    windowObject.addEventListener("hashchange", () => {
      syncLanguageSwitchLinks();
      updateCurrentSectionFromScroll();
    });
    updateCurrentSectionFromScroll();
  }

  return {
    initializeHeaderLayout,
    initializeNavigation,
    restoreInitialScroll,
    syncLanguageSwitchLinks,
  };
}
