import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const LANGUAGES = ["ja", "en"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalLocalizedString(value, { allowEmpty = true } = {}) {
  const source = isObject(value) ? value : {};
  const localized = {};

  LANGUAGES.forEach((language) => {
    const entry = typeof source[language] === "string" ? source[language] : "";
    localized[language] = allowEmpty ? entry : entry.trim();
  });

  return localized;
}

function pickString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function pickNullableString(value) {
  return value == null ? null : pickString(value);
}

function canonicalizeForId(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeForId);
  }

  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, canonicalizeForId(value[key])]),
    );
  }

  return value;
}

function createRecordId(prefix, seed, record) {
  const normalizedSeed = pickString(seed, "item").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  const hash = createHash("sha256")
    .update(JSON.stringify(canonicalizeForId(record)))
    .digest("hex")
    .slice(0, 8);

  return [prefix, normalizedSeed || "item", hash].join("-");
}

function formatProfile(profile) {
  const source = isObject(profile) ? profile : {};
  const metaDescription = canonicalLocalizedString(source.metaDescription, { allowEmpty: false });
  const hasMetaDescription = LANGUAGES.some((language) => metaDescription[language].trim().length > 0);

  return {
    name: canonicalLocalizedString(source.name, { allowEmpty: false }),
    affiliation: canonicalLocalizedString(source.affiliation, { allowEmpty: false }),
    position: canonicalLocalizedString(source.position, { allowEmpty: false }),
    ...(hasMetaDescription ? { metaDescription } : {}),
    introduction: {
      ja: Array.isArray(source.introduction?.ja) ? source.introduction.ja.map((value) => pickString(value)) : [],
      en: Array.isArray(source.introduction?.en) ? source.introduction.en.map((value) => pickString(value)) : [],
    },
    links: Array.isArray(source.links)
      ? source.links.map((link) => {
          const formattedLink = {
            label: canonicalLocalizedString(link?.label, { allowEmpty: false }),
            url: pickString(link?.url),
          };

          if (typeof link?.icon === "string" && link.icon !== "") {
            formattedLink.icon = link.icon;
          }

          return formattedLink;
        })
      : [],
  };
}

function formatEducationRecord(record) {
  const baseRecord = {
    start: pickString(record?.start),
    end: pickNullableString(record?.end),
    isCurrent: record?.isCurrent === true ? true : undefined,
    affiliation: canonicalLocalizedString(record?.affiliation, { allowEmpty: false }),
    position: canonicalLocalizedString(record?.position, { allowEmpty: false }),
    url: pickString(record?.url),
    note: canonicalLocalizedString(record?.note, { allowEmpty: true }),
  };
  const id = pickString(record?.id) || createRecordId("education", baseRecord.start, baseRecord);

  return {
    id,
    start: baseRecord.start,
    end: baseRecord.end,
    ...(baseRecord.isCurrent ? { isCurrent: true } : {}),
    affiliation: baseRecord.affiliation,
    position: baseRecord.position,
    url: baseRecord.url,
    note: baseRecord.note,
  };
}

function formatCareerRecord(record) {
  const baseRecord = {
    start: pickString(record?.start),
    end: pickNullableString(record?.end),
    isCurrent: record?.isCurrent === true ? true : undefined,
    organization: canonicalLocalizedString(record?.organization, { allowEmpty: false }),
    position: canonicalLocalizedString(record?.position, { allowEmpty: false }),
    url: pickString(record?.url),
    note: canonicalLocalizedString(record?.note, { allowEmpty: true }),
  };
  const id = pickString(record?.id) || createRecordId("career", baseRecord.start, baseRecord);

  return {
    id,
    start: baseRecord.start,
    end: baseRecord.end,
    ...(baseRecord.isCurrent ? { isCurrent: true } : {}),
    organization: baseRecord.organization,
    position: baseRecord.position,
    url: baseRecord.url,
    note: baseRecord.note,
  };
}

function formatAwardRecord(record) {
  const baseRecord = {
    title: canonicalLocalizedString(record?.title, { allowEmpty: false }),
    organization: canonicalLocalizedString(record?.organization, { allowEmpty: false }),
    date: pickString(record?.date),
    rate: pickString(record?.rate),
    url: pickString(record?.url),
    note: canonicalLocalizedString(record?.note, { allowEmpty: true }),
  };
  const id = pickString(record?.id) || createRecordId("award", baseRecord.date, baseRecord);

  return {
    id,
    title: baseRecord.title,
    organization: baseRecord.organization,
    date: baseRecord.date,
    rate: baseRecord.rate,
    url: baseRecord.url,
    note: baseRecord.note,
  };
}

function formatPublicationRecord(record) {
  const baseRecord = {
    authors: Array.isArray(record?.authors) ? record.authors.map((author) => pickString(author)) : [],
    selfAuthorIndices: Array.isArray(record?.selfAuthorIndices)
      ? record.selfAuthorIndices.filter((value) => Number.isInteger(value))
      : [],
    title: pickString(record?.title),
    venue: pickString(record?.venue),
    year: Number.isInteger(record?.year) ? record.year : null,
    month: Number.isInteger(record?.month) ? record.month : undefined,
    type: pickString(record?.type),
    review: record?.review === true,
    url: pickString(record?.url),
    note: pickString(record?.note),
  };
  const id = pickString(record?.id) || createRecordId("publication", String(baseRecord.year ?? "item"), baseRecord);

  return {
    id,
    authors: baseRecord.authors,
    selfAuthorIndices: baseRecord.selfAuthorIndices,
    title: baseRecord.title,
    venue: baseRecord.venue,
    year: baseRecord.year,
    ...(baseRecord.month ? { month: baseRecord.month } : {}),
    type: baseRecord.type,
    review: baseRecord.review,
    url: baseRecord.url,
    note: baseRecord.note,
  };
}

function collectCaseVariantWarnings(fileLabel, values) {
  const groups = new Map();

  values
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .forEach((value) => {
      const key = value.trim().toLowerCase();
      const variants = groups.get(key) ?? new Set();
      variants.add(value.trim());
      groups.set(key, variants);
    });

  return [...groups.values()]
    .filter((variants) => variants.size > 1)
    .map((variants) => `${fileLabel}: possible case/style variants detected -> ${[...variants].join(" / ")}`);
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(rootDir, relativePath), "utf8"));
}

async function readJsonl(relativePath) {
  const text = await readFile(path.join(rootDir, relativePath), "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function writeJson(relativePath, value) {
  await writeFile(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

async function writeJsonl(relativePath, records) {
  const lines = records.map((record) => JSON.stringify(record));
  await writeFile(path.join(rootDir, relativePath), `${lines.join("\n")}\n`);
}

async function main() {
  const warnings = [];

  const profile = formatProfile(await readJson("data/profile.json"));
  warnings.push(
    ...collectCaseVariantWarnings(
      "data/profile.json",
      (profile.links ?? []).flatMap((link) => [link.label?.en]),
    ),
  );
  await writeJson("data/profile.json", profile);

  const education = (await readJsonl("data/education.jsonl")).map(formatEducationRecord);
  warnings.push(
    ...collectCaseVariantWarnings(
      "data/education.jsonl",
      education.flatMap((record) => [record.position?.en, record.note?.en]),
    ),
  );
  await writeJsonl("data/education.jsonl", education);

  const career = (await readJsonl("data/career.jsonl")).map(formatCareerRecord);
  warnings.push(
    ...collectCaseVariantWarnings(
      "data/career.jsonl",
      career.flatMap((record) => [record.position?.en, record.note?.en]),
    ),
  );
  await writeJsonl("data/career.jsonl", career);

  const awards = (await readJsonl("data/awards.jsonl")).map(formatAwardRecord);
  warnings.push(
    ...collectCaseVariantWarnings(
      "data/awards.jsonl",
      awards.flatMap((record) => [record.title?.en, record.note?.en]),
    ),
  );
  await writeJsonl("data/awards.jsonl", awards);

  const publications = (await readJsonl("data/publications.jsonl")).map(formatPublicationRecord);
  warnings.push(
    ...collectCaseVariantWarnings(
      "data/publications.jsonl",
      publications.flatMap((record) => [record.note]),
    ),
  );
  await writeJsonl("data/publications.jsonl", publications);

  console.log("Data formatting completed.");
  if (warnings.length > 0) {
    console.warn("\nWarnings:");
    warnings.forEach((warning) => {
      console.warn(`- ${warning}`);
    });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
