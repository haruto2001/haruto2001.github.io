import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const SECTION_IDS = ["education", "publications", "awards", "career"];
const SUPPORTED_LANGUAGES = ["ja", "en"];

function isLocalizedValueObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    SUPPORTED_LANGUAGES.every((language) => language in value) &&
    Object.keys(value).every((key) => SUPPORTED_LANGUAGES.includes(key))
  );
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

function normalizeDescription(profile) {
  const source =
    (typeof profile.metaDescription === "string" && profile.metaDescription) ||
    (Array.isArray(profile.introduction) ? profile.introduction[0] : "") ||
    "";
  return source.replace(/\s+/g, " ").trim();
}

async function loadJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadText(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

function expectIncludes(errors, text, expected, label) {
  if (!text.includes(expected)) {
    errors.push(`${label}: missing "${expected}"`);
  }
}

function expectMatch(errors, text, pattern, label, message) {
  if (!pattern.test(text)) {
    errors.push(`${label}: ${message}`);
  }
}

function createPageExpectations(siteConfig, language, profile, siteMeta) {
  const isEnglish = language === "en";
  const canonicalUrl = new URL(isEnglish ? "/en/" : "/", siteConfig.siteUrl).href;
  const pagePath = isEnglish ? "en/index.html" : "index.html";
  const pageLabel = pagePath;
  const pageTitle = `${profile.name} | ${isEnglish ? "Research Profile" : "研究者プロフィール"}`;
  const metaDescription = normalizeDescription(profile);
  const ogImageUrl = new URL(siteConfig.socialImagePath, siteConfig.siteUrl).href;
  const pageHtmlLanguageSwitch = isEnglish
    ? {
        ja: "../index.html",
        en: "./index.html",
        faviconIco: "../assets/icons/favicon.ico",
        favicon16: "../assets/icons/favicon-16x16.png",
        favicon32: "../assets/icons/favicon-32x32.png",
        appleTouchIcon: "../assets/icons/apple-touch-icon.png",
        manifest: "../manifest.webmanifest",
      }
    : {
        ja: "./index.html",
        en: "./en/index.html",
        faviconIco: "./assets/icons/favicon.ico",
        favicon16: "./assets/icons/favicon-16x16.png",
        favicon32: "./assets/icons/favicon-32x32.png",
        appleTouchIcon: "./assets/icons/apple-touch-icon.png",
        manifest: "./manifest.webmanifest",
      };

  return {
    pagePath,
    pageLabel,
    pageTitle,
    metaDescription,
    canonicalUrl,
    ogImageUrl,
    name: profile.name,
    languageSwitch: pageHtmlLanguageSwitch,
    hreflangJa: new URL("/", siteConfig.siteUrl).href,
    hreflangEn: new URL("/en/", siteConfig.siteUrl).href,
    updatedAtText: `${isEnglish ? "Last updated" : "最終更新"}: ${siteMeta.lastUpdated}`,
    themeColorLight: siteConfig.themeColorLight,
    themeColorDark: siteConfig.themeColorDark,
  };
}

function checkPage(errors, html, expectation) {
  expectMatch(errors, html, /<html lang="(?:ja|en)">/, expectation.pageLabel, "missing html lang");
  expectIncludes(errors, html, `<title>${expectation.pageTitle}</title>`, expectation.pageLabel);
  expectIncludes(
    errors,
    html,
    `<meta name="description" content="${expectation.metaDescription}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="canonical" href="${expectation.canonicalUrl}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="alternate" hreflang="ja" href="${expectation.hreflangJa}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="alternate" hreflang="en" href="${expectation.hreflangEn}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<meta property="og:url" content="${expectation.canonicalUrl}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<meta property="og:image" content="${expectation.ogImageUrl}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<meta name="twitter:image" content="${expectation.ogImageUrl}">`,
    expectation.pageLabel,
  );
  expectIncludes(errors, html, `<h1 class="name">${expectation.name}</h1>`, expectation.pageLabel);
  expectIncludes(
    errors,
    html,
    `<a class="language-switch-link" data-language-switch="ja" href="${expectation.languageSwitch.ja}">日本語</a>`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<a class="language-switch-link" data-language-switch="en" href="${expectation.languageSwitch.en}">English</a>`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="icon" type="image/x-icon" href="${expectation.languageSwitch.faviconIco}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="icon" type="image/png" sizes="16x16" href="${expectation.languageSwitch.favicon16}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="icon" type="image/png" sizes="32x32" href="${expectation.languageSwitch.favicon32}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="apple-touch-icon" sizes="180x180" href="${expectation.languageSwitch.appleTouchIcon}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<link rel="manifest" href="${expectation.languageSwitch.manifest}">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<meta name="theme-color" content="${expectation.themeColorLight}" media="(prefers-color-scheme: light)">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<meta name="theme-color" content="${expectation.themeColorDark}" media="(prefers-color-scheme: dark)">`,
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    '<a class="skip-link" href="#main-content"',
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    '<main id="main-content" class="content" tabindex="-1">',
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    '<script type="application/json" id="homepage-locale-data">',
    expectation.pageLabel,
  );
  expectIncludes(
    errors,
    html,
    `<p>${expectation.updatedAtText}</p>`,
    expectation.pageLabel,
  );

  SECTION_IDS.forEach((sectionId) => {
    expectIncludes(
      errors,
      html,
      `href="#${sectionId}"`,
      expectation.pageLabel,
    );
  });

  if (html.includes("{{")) {
    errors.push(`${expectation.pageLabel}: unresolved template placeholder found`);
  }
}

function checkSitemap(errors, sitemap, siteConfig, siteMeta) {
  const sitemapLabel = "sitemap.xml";
  expectMatch(errors, sitemap, /<urlset[\s\S]*<\/urlset>/, sitemapLabel, "invalid sitemap wrapper");

  const jaUrl = new URL("/", siteConfig.siteUrl).href;
  const enUrl = new URL("/en/", siteConfig.siteUrl).href;
  expectIncludes(errors, sitemap, `<loc>${jaUrl}</loc>`, sitemapLabel);
  expectIncludes(errors, sitemap, `<loc>${enUrl}</loc>`, sitemapLabel);
  expectIncludes(errors, sitemap, `<lastmod>${siteMeta.lastUpdated}</lastmod>`, sitemapLabel);
}

function checkRobots(errors, robots, siteConfig) {
  const robotsLabel = "robots.txt";
  expectIncludes(errors, robots, "User-agent: *", robotsLabel);
  expectIncludes(errors, robots, "Allow: /", robotsLabel);
  expectIncludes(
    errors,
    robots,
    `Sitemap: ${new URL("/sitemap.xml", siteConfig.siteUrl).href}`,
    robotsLabel,
  );
}

function checkManifest(errors, manifest, siteConfig) {
  const manifestLabel = "manifest.webmanifest";
  expectIncludes(errors, manifest, `"name": "${siteConfig.siteName}"`, manifestLabel);
  expectIncludes(errors, manifest, `"short_name": "${siteConfig.shortName}"`, manifestLabel);
  expectIncludes(errors, manifest, `"start_url": "/"`, manifestLabel);
  expectIncludes(errors, manifest, `"display": "standalone"`, manifestLabel);
  expectIncludes(errors, manifest, `"background_color": "${siteConfig.backgroundColor}"`, manifestLabel);
  expectIncludes(errors, manifest, `"theme_color": "${siteConfig.themeColorLight}"`, manifestLabel);
  expectIncludes(errors, manifest, `"/assets/icons/android-chrome-192x192.png"`, manifestLabel);
  expectIncludes(errors, manifest, `"/assets/icons/android-chrome-512x512.png"`, manifestLabel);
}

async function main() {
  const siteConfig = await loadJson("site.config.json");
  const siteMeta = await loadJson("data/site-meta.json");
  const rawProfile = await loadJson("data/profile.json");
  const profiles = {
    ja: resolveLocalizedValue(rawProfile, "ja"),
    en: resolveLocalizedValue(rawProfile, "en"),
  };
  const pages = {
    ja: await loadText("index.html"),
    en: await loadText("en/index.html"),
  };
  const manifest = await loadText("manifest.webmanifest");
  const sitemap = await loadText("sitemap.xml");
  const robots = await loadText("robots.txt");
  const errors = [];

  checkPage(errors, pages.ja, createPageExpectations(siteConfig, "ja", profiles.ja, siteMeta));
  checkPage(errors, pages.en, createPageExpectations(siteConfig, "en", profiles.en, siteMeta));
  checkManifest(errors, manifest, siteConfig);
  checkSitemap(errors, sitemap, siteConfig, siteMeta);
  checkRobots(errors, robots, siteConfig);

  if (errors.length > 0) {
    console.error("Smoke test failed:\n");
    errors.forEach((error) => {
      console.error(`- ${error}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
