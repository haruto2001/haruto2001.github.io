import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderPageContent } from "./static-page-content.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const templatePath = path.join(rootDir, "templates", "page.html");
const manifestOutputPath = path.join(rootDir, "manifest.webmanifest");
const sitemapOutputPath = path.join(rootDir, "sitemap.xml");
const robotsOutputPath = path.join(rootDir, "robots.txt");
const siteMetaPath = path.join(rootDir, "data", "site-meta.json");
const SUPPORTED_LANGUAGES = ["ja", "en"];
const contentHashDirectories = [
  path.join(rootDir, "data"),
  path.join(rootDir, "locales"),
];
const contentHashFiles = [
  path.join(rootDir, "site.config.json"),
  path.join(rootDir, "styles.css"),
  path.join(rootDir, "main.js"),
  templatePath,
  path.join(rootDir, "scripts", "app-context.js"),
  path.join(rootDir, "scripts", "build-pages.mjs"),
  path.join(rootDir, "scripts", "locale-store.js"),
  path.join(rootDir, "scripts", "navigation-controller.js"),
  path.join(rootDir, "scripts", "section-config.js"),
  path.join(rootDir, "scripts", "static-page-content.js"),
  path.join(rootDir, "scripts", "theme-controller.js"),
  path.join(rootDir, "scripts", "typography-controller.js"),
  path.join(rootDir, "assets", "icons", "avatar.png"),
];
const contentHashIgnoredPaths = new Set([siteMetaPath]);
const localeMeta = {
  ja: {
    ogLocale: "ja_JP",
    ogAlternateLocale: "en_US",
  },
  en: {
    ogLocale: "en_US",
    ogAlternateLocale: "ja_JP",
  },
};

function isLocalizedValueObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    SUPPORTED_LANGUAGES.every((language) => language in value) &&
    Object.keys(value).every((key) => SUPPORTED_LANGUAGES.includes(key))
  );
}

const pageConfigs = {
  ja: {
    outputPath: path.join(rootDir, "index.html"),
    stylesPath: "./styles.css",
    scriptPath: "./main.js",
    avatarPath: "./assets/icons/avatar.png",
    themeLightIconPath: "./assets/icons/light_mode.svg",
    themeDarkIconPath: "./assets/icons/dark_mode.svg",
    faviconIcoPath: "./assets/icons/favicon.ico",
    favicon16Path: "./assets/icons/favicon-16x16.png",
    favicon32Path: "./assets/icons/favicon-32x32.png",
    appleTouchIconPath: "./assets/icons/apple-touch-icon.png",
    manifestPath: "./manifest.webmanifest",
    languageLinks: {
      ja: "./index.html",
      en: "./en/index.html",
    },
  },
  en: {
    outputPath: path.join(rootDir, "en", "index.html"),
    stylesPath: "../styles.css",
    scriptPath: "../main.js",
    avatarPath: "../assets/icons/avatar.png",
    themeLightIconPath: "../assets/icons/light_mode.svg",
    themeDarkIconPath: "../assets/icons/dark_mode.svg",
    faviconIcoPath: "../assets/icons/favicon.ico",
    favicon16Path: "../assets/icons/favicon-16x16.png",
    favicon32Path: "../assets/icons/favicon-32x32.png",
    appleTouchIconPath: "../assets/icons/apple-touch-icon.png",
    manifestPath: "../manifest.webmanifest",
    languageLinks: {
      ja: "../index.html",
      en: "./index.html",
    },
  },
};

function replacePlaceholders(template, replacements) {
  return Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, value),
    template,
  );
}

function indent(text, size) {
  const padding = " ".repeat(size);
  return text
    .split("\n")
    .map((line) => (line ? `${padding}${line}` : line))
    .join("\n");
}

async function loadLocale(language) {
  const localePath = path.join(rootDir, "locales", `${language}.json`);
  return JSON.parse(await readFile(localePath, "utf8"));
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function resolveLocalizedValue(value, language) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveLocalizedValue(item, language));
  }

  if (isLocalizedValueObject(value)) {
    return resolveLocalizedValue(value[language], language);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveLocalizedValue(entryValue, language)]),
    );
  }

  return value;
}

function renderNavigationButtons(locale) {
  return [
    ["education", locale.sections.education],
    ["publications", locale.sections.publications],
    ["awards", locale.sections.awards],
    ["career", locale.sections.career],
  ]
    .map(
      ([id, label]) => `<a
  href="#${id}"
  class="site-nav-button"
  data-target="${id}"
  data-locale-text="sections.${id}"
>${label}</a>`,
    )
    .map((markup) => indent(markup, 10))
    .join("\n");
}

function escapeJsonForScript(value) {
  return value.replaceAll("<", "\\u003c");
}

function escapeHtmlAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toPageRelativePath(outputPath, value) {
  if (typeof value !== "string" || value.length === 0) {
    return value ?? "";
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith("#") || value.startsWith("/")) {
    return value;
  }

  const outputDir = path.dirname(outputPath);
  const absoluteTarget = path.resolve(rootDir, value);
  const relativePath = path.relative(outputDir, absoluteTarget).split(path.sep).join("/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function buildPageTitle(profile, locale) {
  return `${profile.name} | ${locale.pageTitle}`;
}

function normalizeDescription(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildMetaDescription(profile) {
  const source =
    (typeof profile.metaDescription === "string" && profile.metaDescription) ||
    (Array.isArray(profile.introduction) ? profile.introduction[0] : "") ||
    "";
  const normalized = normalizeDescription(source);
  if (normalized.length <= 160) {
    return normalized;
  }

  return `${normalized.slice(0, 157).trimEnd()}...`;
}

function createSiteUrl(pathName, siteUrl) {
  return new URL(pathName, siteUrl).href;
}

function createSocialImageUrl(siteConfig) {
  return new URL(siteConfig.socialImagePath, siteConfig.siteUrl).href;
}

function renderManifest(siteConfig) {
  return JSON.stringify(
    {
      name: siteConfig.siteName,
      short_name: siteConfig.shortName,
      start_url: "/",
      display: "standalone",
      background_color: siteConfig.backgroundColor,
      theme_color: siteConfig.themeColorLight,
      icons: [
        {
          src: "/assets/icons/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/assets/icons/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    null,
    2,
  );
}

function formatTokyoDate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createStructuredData({ profile, pageUrl, imageUrl }) {
  const sameAs = Array.isArray(profile.links)
    ? profile.links
        .map((link) => link?.url)
        .filter((url) => typeof url === "string" && /^https?:\/\//.test(url))
    : [];

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: pageUrl,
    image: imageUrl,
    description: buildMetaDescription(profile),
    affiliation: {
      "@type": "Organization",
      name: profile.affiliation,
    },
  };

  if (sameAs.length > 0) {
    structuredData.sameAs = sameAs;
  }

  return JSON.stringify(structuredData);
}

async function collectFilesRecursively(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const filePaths = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (contentHashIgnoredPaths.has(entryPath)) {
        return [];
      }

      if (entry.isDirectory()) {
        return collectFilesRecursively(entryPath);
      }

      return [entryPath];
    }),
  );

  return filePaths.flat().sort((left, right) => left.localeCompare(right));
}

async function collectContentHashSourcePaths() {
  const directoryFiles = await Promise.all(contentHashDirectories.map(collectFilesRecursively));
  return [...contentHashFiles, ...directoryFiles.flat()].sort((left, right) => left.localeCompare(right));
}

async function computeContentHash(filePaths) {
  const hash = createHash("sha256");

  for (const filePath of filePaths) {
    const relativePath = path.relative(rootDir, filePath).split(path.sep).join("/");
    const content = await readFile(filePath);
    hash.update(`${relativePath}\n`);
    hash.update(content);
    hash.update("\n");
  }

  return hash.digest("hex");
}

async function syncSiteMeta() {
  const currentMeta = await loadJson(siteMetaPath);
  const sourcePaths = await collectContentHashSourcePaths();
  const nextContentHash = await computeContentHash(sourcePaths);
  const nextMeta =
    currentMeta.contentHash === nextContentHash &&
    typeof currentMeta.lastUpdated === "string" &&
    currentMeta.lastUpdated
      ? currentMeta
      : {
          lastUpdated: formatTokyoDate(),
          contentHash: nextContentHash,
        };

  if (
    nextMeta.lastUpdated !== currentMeta.lastUpdated ||
    nextMeta.contentHash !== currentMeta.contentHash
  ) {
    await writeFile(siteMetaPath, `${JSON.stringify(nextMeta, null, 2)}\n`);
  }

  return nextMeta;
}

async function buildPage(language, siteConfig, siteMeta) {
  const locale = await loadLocale(language);
  const config = pageConfigs[language];
  const template = await readFile(templatePath, "utf8");
  const rawProfile = await loadJson(path.join(rootDir, "data", "profile.json"));
  const rawRecordsByType = {
    education: await loadJsonl(path.join(rootDir, "data", "education.jsonl")),
    awards: await loadJsonl(path.join(rootDir, "data", "awards.jsonl")),
    career: await loadJsonl(path.join(rootDir, "data", "career.jsonl")),
    publications: await loadJsonl(path.join(rootDir, "data", "publications.jsonl")),
  };
  const profile = resolveLocalizedValue(rawProfile, language);
  const recordsByType = Object.fromEntries(
    Object.entries(rawRecordsByType).map(([key, records]) => [
      key,
      records.map((record) => resolveLocalizedValue(record, language)),
    ]),
  );
  const pageContent = renderPageContent({
    locale,
    profile,
    recordsByType,
    updatedAt: siteMeta.lastUpdated,
    resolveUrl: (value) => toPageRelativePath(config.outputPath, value),
  });
  const pagePath = language === "en" ? "/en/" : "/";
  const canonicalUrl = createSiteUrl(pagePath, siteConfig.siteUrl);
  const jaCanonicalUrl = createSiteUrl("/", siteConfig.siteUrl);
  const enCanonicalUrl = createSiteUrl("/en/", siteConfig.siteUrl);
  const ogImageUrl = createSocialImageUrl(siteConfig);
  const metaDescription = buildMetaDescription(profile);
  const pageTitle = buildPageTitle(profile, locale);
  const isJapanese = language === "ja";
  const structuredDataJson = escapeJsonForScript(
    createStructuredData({
      profile,
      pageUrl: canonicalUrl,
      imageUrl: ogImageUrl,
    }),
  );
  const metadata = localeMeta[language];

  const html = replacePlaceholders(template, {
    lang: language,
    pageTitle: escapeHtmlAttribute(pageTitle),
    metaDescription: escapeHtmlAttribute(metaDescription),
    siteName: escapeHtmlAttribute(siteConfig.siteName),
    canonicalUrl: escapeHtmlAttribute(canonicalUrl),
    jaCanonicalUrl: escapeHtmlAttribute(jaCanonicalUrl),
    enCanonicalUrl: escapeHtmlAttribute(enCanonicalUrl),
    ogTitle: escapeHtmlAttribute(pageTitle),
    ogImageUrl: escapeHtmlAttribute(ogImageUrl),
    ogLocale: metadata.ogLocale,
    ogAlternateLocale: metadata.ogAlternateLocale,
    personStructuredDataJson: structuredDataJson,
    faviconIcoPath: config.faviconIcoPath,
    favicon16Path: config.favicon16Path,
    favicon32Path: config.favicon32Path,
    appleTouchIconPath: config.appleTouchIconPath,
    manifestPath: config.manifestPath,
    themeColorLight: siteConfig.themeColorLight,
    themeColorDark: siteConfig.themeColorDark,
    skipToContentLabel: locale.labels.skipToContent,
    sectionNavigationLabel: locale.labels.sectionNavigation,
    stylesPath: config.stylesPath,
    navigationButtons: renderNavigationButtons(locale),
    jaHref: config.languageLinks.ja,
    enHref: config.languageLinks.en,
    jaCurrentClass: isJapanese ? " is-current" : "",
    enCurrentClass: isJapanese ? "" : " is-current",
    jaAriaCurrent: isJapanese ? ' aria-current="page"' : "",
    enAriaCurrent: isJapanese ? "" : ' aria-current="page"',
    avatarPath: config.avatarPath,
    themeLightIconPath: config.themeLightIconPath,
    themeDarkIconPath: config.themeDarkIconPath,
    avatarAlt: locale.labels.avatarAlt,
    name: pageContent.name,
    affiliation: pageContent.affiliation,
    position: pageContent.position,
    introductionHtml: pageContent.introductionHtml,
    linksLabel: locale.labels.links,
    linksHtml: pageContent.linksHtml,
    themeToggleLabel: locale.labels.themeToggle,
    contentSections: indent(pageContent.contentSections, 8),
    updatedAtText: pageContent.updatedAtText,
    localeDataJson: escapeJsonForScript(JSON.stringify(locale)),
    scriptPath: config.scriptPath,
  });

  await mkdir(path.dirname(config.outputPath), { recursive: true });
  await writeFile(config.outputPath, html);

  return {
    language,
    url: canonicalUrl,
    updatedAt: siteMeta.lastUpdated,
  };
}

function renderSitemap(entries) {
  const urls = entries
    .map(({ url, updatedAt }) => {
      const lastmod = updatedAt ? `\n    <lastmod>${escapeXml(updatedAt)}</lastmod>` : "";
      return `  <url>\n    <loc>${escapeXml(url)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function renderRobots(siteConfig) {
  const sitemapUrl = new URL("/sitemap.xml", siteConfig.siteUrl).href;
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}

const siteConfig = await loadJson(path.join(rootDir, "site.config.json"));
const siteMeta = await syncSiteMeta();
const pageEntries = await Promise.all(
  Object.keys(pageConfigs).map((language) => buildPage(language, siteConfig, siteMeta)),
);
await writeFile(manifestOutputPath, `${renderManifest(siteConfig)}\n`);
await writeFile(sitemapOutputPath, renderSitemap(pageEntries));
await writeFile(robotsOutputPath, renderRobots(siteConfig));
