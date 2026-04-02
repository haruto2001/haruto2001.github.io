const DEFAULT_LOCALES = {
  ja: {
    pageTitle: "研究者プロフィール",
    labels: {
      sectionNavigation: "ページ内セクションナビゲーション",
      language: "言語",
      links: "リンク",
      themeToggle: "テーマ",
      themeLight: "ライト",
      themeDark: "ダーク",
      switchToLight: "ライトモードに切り替え",
      switchToDark: "ダークモードに切り替え",
      skipToContent: "本文へスキップ",
      current: "現在",
      awardRate: "受賞率",
      lastUpdated: "最終更新",
      emptyState: "項目はまだありません。",
      configMissing: "表示設定が見つかりません。",
      loadError: "データを読み込めませんでした。",
      avatarAlt: "吉田遥音のアバター",
    },
    sections: {
      education: "学歴",
      publications: "業績",
      awards: "受賞",
      career: "経歴",
    },
    publicationGroups: {
      conferencePeerReviewed: "会議（査読あり）",
      workshopPeerReviewed: "ワークショップ（査読あり）",
      conferenceNotPeerReviewed: "会議（査読なし）",
      workshopNotPeerReviewed: "ワークショップ（査読なし）",
      journal: "ジャーナル",
      preprint: "プレプリント",
    },
  },
  en: {
    pageTitle: "Research Profile",
    labels: {
      sectionNavigation: "Section navigation",
      language: "Language",
      links: "Links",
      themeToggle: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      switchToLight: "Switch to light mode",
      switchToDark: "Switch to dark mode",
      skipToContent: "Skip to main content",
      current: "Present",
      awardRate: "Award rate",
      lastUpdated: "Last updated",
      emptyState: "No entries yet.",
      configMissing: "Display configuration was not found.",
      loadError: "Failed to load the data.",
      avatarAlt: "Avatar of Haruto Yoshida",
    },
    sections: {
      education: "Education",
      publications: "Publications",
      awards: "Awards",
      career: "Career",
    },
    publicationGroups: {
      conferencePeerReviewed: "Conference (Peer Reviewed)",
      workshopPeerReviewed: "Workshop (Peer Reviewed)",
      conferenceNotPeerReviewed: "Conference (Not Peer Reviewed)",
      workshopNotPeerReviewed: "Workshop (Not Peer Reviewed)",
      journal: "Journal",
      preprint: "Preprint",
    },
  },
};

export function createLocaleStore(context) {
  let dictionary = {};
  const defaultDictionary = DEFAULT_LOCALES[context.currentLanguage] ?? DEFAULT_LOCALES.ja;

  function readPath(source, path) {
    return path.split(".").reduce((current, key) => current?.[key], source);
  }

  function getValue(path, fallback = "") {
    const value = readPath(dictionary, path);
    if (typeof value === "string") {
      return value;
    }

    const defaultValue = readPath(defaultDictionary, path);
    return typeof defaultValue === "string" ? defaultValue : fallback;
  }

  function applyLocale() {
    context.elements.localeTextElements.forEach((element) => {
      element.textContent = getValue(element.dataset.localeText, element.textContent ?? "");
    });

    context.elements.localeAriaLabelElements.forEach((element) => {
      element.setAttribute(
        "aria-label",
        getValue(
          element.dataset.localeAriaLabel,
          element.getAttribute("aria-label") ?? "",
        ),
      );
    });

    context.elements.localeAltElements.forEach((element) => {
      element.setAttribute(
        "alt",
        getValue(element.dataset.localeAlt, element.getAttribute("alt") ?? ""),
      );
    });
  }

  async function initialize() {
    try {
      const source = context.elements.localeDataElement?.textContent ?? "";
      dictionary = source ? JSON.parse(source) : {};
    } catch (error) {
      console.error(error);
    }

    applyLocale();
  }

  function getCurrentLabel() {
    return getValue("labels.current");
  }

  return {
    initialize,
    getValue,
    getCurrentLabel,
  };
}
