import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const LANGUAGES = ["ja", "en"];
const TIMELINE_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const FULL_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PUBLICATION_TYPES = new Set(["conference", "workshop", "journal", "preprint"]);
const HEX_COLOR_PATTERN = /^#(?:[a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/;

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalString(value) {
  return value === undefined || typeof value === "string";
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isLocalizedValueObject(value) {
  return (
    isObject(value) &&
    LANGUAGES.every((language) => language in value) &&
    Object.keys(value).every((key) => LANGUAGES.includes(key))
  );
}

function normalizePath(filePath) {
  return path.relative(rootDir, filePath) || ".";
}

function createValidator() {
  const errors = [];

  function addError(filePath, message) {
    errors.push(`${normalizePath(filePath)}: ${message}`);
  }

  function assert(condition, filePath, message) {
    if (!condition) {
      addError(filePath, message);
    }
  }

  return {
    errors,
    addError,
    assert,
  };
}

async function readJson(filePath, validator) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    validator.addError(filePath, `failed to read file (${error.message})`);
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    validator.addError(filePath, `invalid JSON (${error.message})`);
    return null;
  }
}

async function readJsonl(filePath, validator) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    validator.addError(filePath, `failed to read file (${error.message})`);
    return [];
  }

  const records = [];
  const lines = text.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    try {
      records.push({
        line: index + 1,
        value: JSON.parse(trimmed),
      });
    } catch (error) {
      validator.addError(filePath, `line ${index + 1}: invalid JSON (${error.message})`);
    }
  });

  return records;
}

function createRecordPath(filePath, line) {
  return `${normalizePath(filePath)}:${line}`;
}

function parseTimelineValue(value) {
  if (!TIMELINE_DATE_PATTERN.test(value)) {
    return Number.NaN;
  }

  const [year, month] = value.split("-").map(Number);
  return year * 100 + month;
}

function isValidUrlLike(value) {
  if (typeof value !== "string") {
    return false;
  }

  if (value === "") {
    return true;
  }

  if (value.startsWith("./") || value.startsWith("../") || value.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function isAbsoluteUrlLike(value) {
  return typeof value === "string" && /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value);
}

function resolveProjectPath(value) {
  if (typeof value !== "string" || value.length === 0 || isAbsoluteUrlLike(value)) {
    return null;
  }

  if (value.startsWith("/")) {
    return path.join(rootDir, value);
  }

  return path.resolve(rootDir, value);
}

function validateLocalizedStrings(value, filePath, fieldName, validator, { allowEmpty = false } = {}) {
  validator.assert(
    isLocalizedValueObject(value),
    filePath,
    `\`${fieldName}\` must be an object with ${LANGUAGES.join("/")} keys`,
  );
  if (!isLocalizedValueObject(value)) {
    return;
  }

  LANGUAGES.forEach((language) => {
    const entry = value[language];
    validator.assert(
      typeof entry === "string" && (allowEmpty || entry.trim().length > 0),
      filePath,
      `\`${fieldName}.${language}\` must be ${allowEmpty ? "a string" : "a non-empty string"}`,
    );
  });
}

function validateLocalizedStringArrays(value, filePath, fieldName, validator) {
  validator.assert(
    isLocalizedValueObject(value),
    filePath,
    `\`${fieldName}\` must be an object with ${LANGUAGES.join("/")} keys`,
  );
  if (!isLocalizedValueObject(value)) {
    return;
  }

  LANGUAGES.forEach((language) => {
    const entry = value[language];
    validator.assert(Array.isArray(entry), filePath, `\`${fieldName}.${language}\` must be an array`);
    if (!Array.isArray(entry)) {
      return;
    }

    entry.forEach((paragraph, index) => {
      validator.assert(
        isNonEmptyString(paragraph),
        filePath,
        `\`${fieldName}.${language}[${index}]\` must be a non-empty string`,
      );
    });
  });
}

function validateRecordId(id, recordPath, validator, seenIds) {
  validator.assert(isNonEmptyString(id), recordPath, "`id` must be a non-empty string");
  validator.assert(
    typeof id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id),
    recordPath,
    "`id` must use lowercase letters, numbers, and hyphens",
  );

  if (typeof id !== "string" || id.length === 0) {
    return;
  }

  if (seenIds.has(id)) {
    validator.addError(recordPath, `\`id\` is duplicated (${id})`);
    return;
  }

  seenIds.add(id);
}

async function validateProfile(validator) {
  const filePath = path.join(rootDir, "data", "profile.json");
  const profile = await readJson(filePath, validator);
  if (!isObject(profile)) {
    validator.addError(filePath, "profile must be a JSON object");
    return;
  }

  validateLocalizedStrings(profile.name, filePath, "name", validator);
  validateLocalizedStrings(profile.affiliation, filePath, "affiliation", validator);
  validateLocalizedStrings(profile.position, filePath, "position", validator);
  validator.assert(
    profile.updatedAt === undefined,
    filePath,
    "`updatedAt` is managed automatically in data/site-meta.json and must not be set here",
  );
  if (profile.metaDescription !== undefined) {
    validateLocalizedStrings(profile.metaDescription, filePath, "metaDescription", validator);
  }
  validateLocalizedStringArrays(profile.introduction, filePath, "introduction", validator);

  validator.assert(Array.isArray(profile.links), filePath, "`links` must be an array");
  if (!Array.isArray(profile.links)) {
    return;
  }

  for (const [index, link] of profile.links.entries()) {
    const recordPath = `${normalizePath(filePath)}:links[${index}]`;
    if (!isObject(link)) {
      validator.addError(recordPath, "link must be an object");
      continue;
    }

    validateLocalizedStrings(link.label, recordPath, "label", validator);
    validator.assert(isNonEmptyString(link.url), recordPath, "`url` must be a non-empty string");
    validator.assert(isValidUrlLike(link.url), recordPath, "`url` must be a valid http/https/mailto/relative URL");
    validator.assert(isOptionalString(link.icon), recordPath, "`icon` must be a string when present");

    if (typeof link.icon === "string" && link.icon !== "") {
      validator.assert(
        isValidUrlLike(link.icon),
        recordPath,
        "`icon` must be a valid relative or absolute URL",
      );

      const iconPath = resolveProjectPath(link.icon);
      if (iconPath) {
        try {
          await access(iconPath);
        } catch {
          validator.addError(recordPath, `icon file was not found (${link.icon})`);
        }
      }
    }
  }
}

async function validateSiteConfig(validator) {
  const filePath = path.join(rootDir, "site.config.json");
  const config = await readJson(filePath, validator);
  if (!isObject(config)) {
    validator.addError(filePath, "site config must be a JSON object");
    return;
  }

  validator.assert(isNonEmptyString(config.siteName), filePath, "`siteName` must be a non-empty string");
  validator.assert(isNonEmptyString(config.shortName), filePath, "`shortName` must be a non-empty string");
  validator.assert(isNonEmptyString(config.siteUrl), filePath, "`siteUrl` must be a non-empty string");
  if (typeof config.siteUrl === "string" && config.siteUrl) {
    validator.assert(
      isValidUrlLike(config.siteUrl) && /^https?:\/\//.test(config.siteUrl),
      filePath,
      "`siteUrl` must be an absolute http/https URL",
    );
  }

  validator.assert(
    typeof config.defaultLocale === "string" && LANGUAGES.includes(config.defaultLocale),
    filePath,
    `\`defaultLocale\` must be one of ${LANGUAGES.join("/")}`,
  );
  validator.assert(
    isNonEmptyString(config.socialImagePath),
    filePath,
    "`socialImagePath` must be a non-empty string",
  );
  validator.assert(
    typeof config.themeColorLight === "string" && HEX_COLOR_PATTERN.test(config.themeColorLight),
    filePath,
    "`themeColorLight` must be a hex color",
  );
  validator.assert(
    typeof config.themeColorDark === "string" && HEX_COLOR_PATTERN.test(config.themeColorDark),
    filePath,
    "`themeColorDark` must be a hex color",
  );
  validator.assert(
    typeof config.backgroundColor === "string" && HEX_COLOR_PATTERN.test(config.backgroundColor),
    filePath,
    "`backgroundColor` must be a hex color",
  );

  if (typeof config.socialImagePath === "string" && config.socialImagePath) {
    validator.assert(
      config.socialImagePath.startsWith("/"),
      filePath,
      "`socialImagePath` must start with /",
    );

    const socialImagePath = path.join(rootDir, config.socialImagePath);
    try {
      await access(socialImagePath);
    } catch {
      validator.addError(
        filePath,
        `social image file was not found (${config.socialImagePath})`,
      );
    }
  }
}

async function validateSiteMeta(validator) {
  const filePath = path.join(rootDir, "data", "site-meta.json");
  const siteMeta = await readJson(filePath, validator);
  if (!isObject(siteMeta)) {
    validator.addError(filePath, "site meta must be a JSON object");
    return;
  }

  validator.assert(
    typeof siteMeta.lastUpdated === "string" && FULL_DATE_PATTERN.test(siteMeta.lastUpdated),
    filePath,
    "`lastUpdated` must use YYYY-MM-DD format",
  );
  validator.assert(
    typeof siteMeta.contentHash === "string" && /^[a-f0-9]{64}$/i.test(siteMeta.contentHash),
    filePath,
    "`contentHash` must be a 64-character hexadecimal string",
  );
}

function validateTimelineRecord(filePath, recordPath, record, labelKey, validator) {
  if (!isObject(record)) {
    validator.addError(recordPath, "record must be an object");
    return;
  }

  validator.assert(
    typeof record.start === "string" && TIMELINE_DATE_PATTERN.test(record.start),
    recordPath,
    "`start` must use YYYY-MM format",
  );
  validateLocalizedStrings(record[labelKey], recordPath, labelKey, validator);
  validator.assert(
    record.isCurrent === undefined || typeof record.isCurrent === "boolean",
    recordPath,
    "`isCurrent` must be a boolean when present",
  );
  if (record.position !== undefined) {
    validateLocalizedStrings(record.position, recordPath, "position", validator);
  }
  if (record.note !== undefined) {
    validateLocalizedStrings(record.note, recordPath, "note", validator, { allowEmpty: true });
  }
  validator.assert(
    isOptionalString(record.url) && isValidUrlLike(record.url ?? ""),
    recordPath,
    "`url` must be a valid http/https/mailto/relative URL when present",
  );

  if (record.isCurrent === true) {
    validator.assert(
      record.end == null,
      recordPath,
      "`end` must be null or omitted when `isCurrent` is true",
    );
    return;
  }

  validator.assert(
    typeof record.end === "string" && TIMELINE_DATE_PATTERN.test(record.end),
    recordPath,
    "`end` must use YYYY-MM format when `isCurrent` is not true",
  );

  if (
    typeof record.start === "string" &&
    TIMELINE_DATE_PATTERN.test(record.start) &&
    typeof record.end === "string" &&
    TIMELINE_DATE_PATTERN.test(record.end)
  ) {
    validator.assert(
      parseTimelineValue(record.start) <= parseTimelineValue(record.end),
      recordPath,
      "`start` must not be later than `end`",
    );
  }
}

async function validateTimelineFile(fileName, labelKey, validator) {
  const filePath = path.join(rootDir, "data", fileName);
  const records = await readJsonl(filePath, validator);
  const seenIds = new Set();
  records.forEach(({ line, value }) => {
    if (isObject(value)) {
      validateRecordId(value.id, createRecordPath(filePath, line), validator, seenIds);
    }
    validateTimelineRecord(filePath, createRecordPath(filePath, line), value, labelKey, validator);
  });
}

async function validateAwards(validator) {
  const filePath = path.join(rootDir, "data", "awards.jsonl");
  const records = await readJsonl(filePath, validator);
  const seenIds = new Set();

  records.forEach(({ line, value }) => {
    const recordPath = createRecordPath(filePath, line);
    if (!isObject(value)) {
      validator.addError(recordPath, "record must be an object");
      return;
    }

    validateRecordId(value.id, recordPath, validator, seenIds);
    validateLocalizedStrings(value.title, recordPath, "title", validator);
    validateLocalizedStrings(value.organization, recordPath, "organization", validator);
    validator.assert(
      typeof value.date === "string" && TIMELINE_DATE_PATTERN.test(value.date),
      recordPath,
      "`date` must use YYYY-MM format",
    );
    validator.assert(isOptionalString(value.rate), recordPath, "`rate` must be a string when present");
    if (value.note !== undefined) {
      validateLocalizedStrings(value.note, recordPath, "note", validator, { allowEmpty: true });
    }
    validator.assert(
      isOptionalString(value.url) && isValidUrlLike(value.url ?? ""),
      recordPath,
      "`url` must be a valid http/https/mailto/relative URL when present",
    );
  });
}

async function validatePublications(validator) {
  const filePath = path.join(rootDir, "data", "publications.jsonl");
  const records = await readJsonl(filePath, validator);
  const seenIds = new Set();

  records.forEach(({ line, value }) => {
    const recordPath = createRecordPath(filePath, line);
    if (!isObject(value)) {
      validator.addError(recordPath, "record must be an object");
      return;
    }

    validateRecordId(value.id, recordPath, validator, seenIds);
    validator.assert(Array.isArray(value.authors), recordPath, "`authors` must be an array");
    if (Array.isArray(value.authors)) {
      validator.assert(value.authors.length > 0, recordPath, "`authors` must not be empty");
      value.authors.forEach((author, index) => {
        validator.assert(
          isNonEmptyString(author),
          recordPath,
          `authors[${index}] must be a non-empty string`,
        );
      });
    }

    validator.assert(
      Array.isArray(value.selfAuthorIndices),
      recordPath,
      "`selfAuthorIndices` must be an array",
    );
    if (Array.isArray(value.selfAuthorIndices)) {
      const seen = new Set();
      value.selfAuthorIndices.forEach((authorIndex, index) => {
        validator.assert(
          Number.isInteger(authorIndex) && authorIndex >= 0,
          recordPath,
          `selfAuthorIndices[${index}] must be a non-negative integer`,
        );

        if (seen.has(authorIndex)) {
          validator.addError(recordPath, `selfAuthorIndices[${index}] is duplicated (${authorIndex})`);
        }
        seen.add(authorIndex);

        if (Array.isArray(value.authors)) {
          validator.assert(
            authorIndex < value.authors.length,
            recordPath,
            `selfAuthorIndices[${index}] is out of range`,
          );
        }
      });
    }

    validator.assert(isNonEmptyString(value.title), recordPath, "`title` must be a non-empty string");
    validator.assert(isNonEmptyString(value.venue), recordPath, "`venue` must be a non-empty string");
    validator.assert(
      Number.isInteger(value.year) && value.year >= 1900 && value.year <= 2100,
      recordPath,
      "`year` must be an integer between 1900 and 2100",
    );
    validator.assert(
      value.month === undefined ||
        (Number.isInteger(value.month) && value.month >= 1 && value.month <= 12),
      recordPath,
      "`month` must be an integer between 1 and 12 when present",
    );
    validator.assert(
      typeof value.type === "string" && PUBLICATION_TYPES.has(value.type),
      recordPath,
      "`type` must be one of conference/workshop/journal/preprint",
    );
    validator.assert(typeof value.review === "boolean", recordPath, "`review` must be a boolean");
    validator.assert(isOptionalString(value.note), recordPath, "`note` must be a string when present");
    validator.assert(
      isOptionalString(value.url) && isValidUrlLike(value.url ?? ""),
      recordPath,
      "`url` must be a valid http/https/mailto/relative URL when present",
    );
  });
}

function compareLocaleShape(left, right, leftName, rightName, validator, pathPrefix = "") {
  if (typeof left === "string" || typeof right === "string") {
    if (typeof left !== "string" || typeof right !== "string") {
      validator.addError(
        leftName,
        `${pathPrefix || "<root>"} has mismatched value types between ${leftName} and ${rightName}`,
      );
      return;
    }

    validator.assert(left.trim().length > 0, leftName, `${pathPrefix} must not be empty`);
    validator.assert(right.trim().length > 0, rightName, `${pathPrefix} must not be empty`);
    return;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      validator.addError(
        leftName,
        `${pathPrefix || "<root>"} has mismatched value types between ${leftName} and ${rightName}`,
      );
      return;
    }

    validator.assert(
      left.length === right.length,
      leftName,
      `${pathPrefix} must have the same array length in ${rightName}`,
    );
    return;
  }

  if (!isObject(left) || !isObject(right)) {
    validator.addError(
      leftName,
      `${pathPrefix || "<root>"} must be objects with matching keys in ${leftName} and ${rightName}`,
    );
    return;
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (!(key in left)) {
      validator.addError(leftName, `${nextPath} is missing`);
      continue;
    }
    if (!(key in right)) {
      validator.addError(rightName, `${nextPath} is missing`);
      continue;
    }

    compareLocaleShape(left[key], right[key], leftName, rightName, validator, nextPath);
  }
}

async function validateLocales(validator) {
  const jaPath = path.join(rootDir, "locales", "ja.json");
  const enPath = path.join(rootDir, "locales", "en.json");
  const ja = await readJson(jaPath, validator);
  const en = await readJson(enPath, validator);

  if (!isObject(ja)) {
    validator.addError(jaPath, "locale file must be a JSON object");
    return;
  }
  if (!isObject(en)) {
    validator.addError(enPath, "locale file must be a JSON object");
    return;
  }

  compareLocaleShape(ja, en, normalizePath(jaPath), normalizePath(enPath), validator);
}

async function main() {
  const validator = createValidator();

  await validateSiteConfig(validator);
  await validateSiteMeta(validator);
  await validateLocales(validator);
  await validateProfile(validator);
  await validateTimelineFile("education.jsonl", "affiliation", validator);
  await validateTimelineFile("career.jsonl", "organization", validator);
  await validateAwards(validator);
  await validatePublications(validator);

  if (validator.errors.length > 0) {
    console.error("Validation failed:\n");
    validator.errors.forEach((message) => {
      console.error(`- ${message}`);
    });
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
