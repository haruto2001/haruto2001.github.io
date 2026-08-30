import { sectionDefinitions } from "./section-config.js";

const PUBLICATION_GROUPS = [
  {
    titleKey: "publicationGroups.conferencePeerReviewed",
    match: (record) => record.type === "conference" && record.review === true,
  },
  {
    titleKey: "publicationGroups.workshopPeerReviewed",
    match: (record) => record.type === "workshop" && record.review === true,
  },
  {
    titleKey: "publicationGroups.conferenceNotPeerReviewed",
    match: (record) => record.type === "conference" && record.review === false,
  },
  {
    titleKey: "publicationGroups.workshopNotPeerReviewed",
    match: (record) => record.type === "workshop" && record.review === false,
  },
  {
    titleKey: "publicationGroups.journal",
    match: (record) => record.type === "journal",
  },
  {
    titleKey: "publicationGroups.preprint",
    match: (record) => record.type === "preprint",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createJoinedSuffix(values) {
  return values.filter(Boolean).join(", ");
}

function normalizeDateValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (value == null || typeof value !== "string") {
    return Number.NEGATIVE_INFINITY;
  }

  const match = value.match(/^(\d{4})(?:-(\d{2}))?$/);
  if (!match) {
    return Number.NEGATIVE_INFINITY;
  }

  const [, year, month = "00"] = match;
  return Number(`${year}${month}`);
}

function compareDescending(left, right) {
  return normalizeDateValue(right) - normalizeDateValue(left);
}

function compareTimelineRecords(left, right) {
  const leftEnd = left.isCurrent ? Number.POSITIVE_INFINITY : normalizeDateValue(left.end);
  const rightEnd = right.isCurrent ? Number.POSITIVE_INFINITY : normalizeDateValue(right.end);

  return compareDescending(left.start, right.start) || rightEnd - leftEnd;
}

function compareAwardRecords(left, right) {
  return compareDescending(left.date, right.date);
}

function normalizeMonthValue(value) {
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 0;
}

function comparePublicationRecords(left, right) {
  return (
    compareDescending(left.year, right.year) ||
    normalizeMonthValue(right.month) - normalizeMonthValue(left.month)
  );
}

function createLinkedHtml(text, url, resolveUrl, attributes = "") {
  if (!text) {
    return "";
  }

  if (!url) {
    return escapeHtml(text);
  }

  const href = escapeHtml(resolveUrl(url));
  return `<a href="${href}"${attributes}>${escapeHtml(text)}</a>`;
}

function renderTimelineRecord(record, labelKey, currentLabel, resolveUrl) {
  const suffix = createJoinedSuffix([record.position, record.note]);
  const endLabel = record.isCurrent ? currentLabel : record.end;
  const main = `${escapeHtml(record.start)} - ${escapeHtml(endLabel)}: `;
  const label = createLinkedHtml(record[labelKey], record.url, resolveUrl);
  const tail = suffix ? `, ${escapeHtml(suffix)}` : "";

  return `${main}${label}${tail}`;
}

function renderAwardRecord(record, locale, resolveUrl) {
  const title = createLinkedHtml(record.title, record.url, resolveUrl);
  const rate = record.rate
    ? `, ${escapeHtml(locale.labels.awardRate)}: ${escapeHtml(record.rate)}`
    : "";
  const note = record.note ? `, ${escapeHtml(record.note)}` : "";
  return `${escapeHtml(record.date)}: ${title}, ${escapeHtml(record.organization)}${rate}${note}`;
}

function renderAuthors(authors, selfAuthorIndices = []) {
  if (!Array.isArray(authors)) {
    return escapeHtml(authors);
  }

  const selfIndices = new Set(
    Array.isArray(selfAuthorIndices)
      ? selfAuthorIndices.filter((value) => Number.isInteger(value) && value >= 0)
      : [],
  );

  return authors
    .map((author, index) =>
      selfIndices.has(index)
        ? `<span class="author-self">${escapeHtml(author)}</span>`
        : escapeHtml(author),
    )
    .join(", ");
}

function renderPublicationRecord(record, resolveUrl) {
  const authors = renderAuthors(record.authors, record.selfAuthorIndices);
  const title = createLinkedHtml(record.title, record.url, resolveUrl);
  const note = record.note ? ` ${escapeHtml(record.note)}` : "";
  return `${authors}. ${title}. ${escapeHtml(record.venue)}. ${escapeHtml(record.year)}.${note}`;
}

function renderRecordList(items, emptyMessage) {
  if (items.length === 0) {
    return `<ul class="record-list"><li class="record-empty">${escapeHtml(emptyMessage)}</li></ul>`;
  }

  const listItems = items
    .map((item) => `<li class="record-item"><p class="record-main">${item}</p></li>`)
    .join("");

  return `<ul class="record-list">${listItems}</ul>`;
}

function renderPublicationGroups(records, locale, resolveUrl) {
  const groups = PUBLICATION_GROUPS
    .map((group) => ({
      title: locale.publicationGroups[group.titleKey.split(".").at(-1)],
      records: records.filter(group.match),
    }))
    .filter((group) => group.records.length > 0);

  if (groups.length === 0) {
    return `<p class="record-empty">${escapeHtml(locale.labels.emptyState)}</p>`;
  }

  return groups
    .map((group) => {
      const items = group.records.map((record) => renderPublicationRecord(record, resolveUrl));
      return `<section class="publication-group"><h3 class="publication-group-title">${escapeHtml(group.title)}</h3>${renderRecordList(items, locale.labels.emptyState)}</section>`;
    })
    .join("");
}

function renderSection(section, locale, recordsByType, resolveUrl) {
  const records = Array.isArray(recordsByType[section.recordType]) ? [...recordsByType[section.recordType]] : [];

  if (section.recordType === "education") {
    records.sort(compareTimelineRecords);
  } else if (section.recordType === "awards") {
    records.sort(compareAwardRecords);
  } else if (section.recordType === "career") {
    records.sort(compareTimelineRecords);
  } else if (section.recordType === "publications") {
    records.sort(comparePublicationRecords);
  }

  let body = "";
  if (section.recordType === "education") {
    body = renderRecordList(
      records.map((record) =>
        renderTimelineRecord(record, "affiliation", locale.labels.current, resolveUrl),
      ),
      locale.labels.emptyState,
    );
  } else if (section.recordType === "awards") {
    body = renderRecordList(
      records.map((record) => renderAwardRecord(record, locale, resolveUrl)),
      locale.labels.emptyState,
    );
  } else if (section.recordType === "career") {
    body = renderRecordList(
      records.map((record) =>
        renderTimelineRecord(record, "organization", locale.labels.current, resolveUrl),
      ),
      locale.labels.emptyState,
    );
  } else if (section.recordType === "publications") {
    body = `<div class="publication-groups">${renderPublicationGroups(records, locale, resolveUrl)}</div>`;
  }

  return `<section id="${escapeHtml(section.id)}" class="section">
  <div class="section-heading">
    <h2 data-locale-text="sections.${escapeHtml(section.key)}">${escapeHtml(locale.sections[section.key])}</h2>
  </div>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function renderIntroduction(introduction = []) {
  return Array.isArray(introduction)
    ? introduction.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
    : "";
}

function renderProfileLinks(links = [], resolveUrl) {
  const items = Array.isArray(links) ? links : [];
  const textLinks = [];
  const iconLinks = [];

  items.forEach((link) => {
    const href = escapeHtml(resolveUrl(link.url));
    const ariaLabel = escapeHtml(link.label);

    if (link.icon) {
      const iconUrl = escapeHtml(resolveUrl(link.icon));
      iconLinks.push(
        `<a href="${href}" aria-label="${ariaLabel}" class="icon-link"><span class="link-icon" aria-hidden="true" style="--icon-url: url(&quot;${iconUrl}&quot;)"></span><span class="sr-only">${ariaLabel}</span></a>`,
      );
      return;
    }

    textLinks.push(`<a href="${href}">${ariaLabel}</a>`);
  });

  const blocks = [];
  if (textLinks.length > 0) {
    blocks.push(`<div class="profile-links-text">${textLinks.join("")}</div>`);
  }
  if (iconLinks.length > 0) {
    blocks.push(`<div class="profile-links-icons">${iconLinks.join("")}</div>`);
  }

  return blocks.join("");
}

export function renderPageContent({ locale, profile, recordsByType, updatedAt, resolveUrl }) {
  return {
    name: escapeHtml(profile.name),
    affiliation: escapeHtml(profile.affiliation),
    position: escapeHtml(profile.position),
    introductionHtml: renderIntroduction(profile.introduction),
    linksHtml: renderProfileLinks(profile.links, resolveUrl),
    updatedAtText: updatedAt
      ? escapeHtml(`${locale.labels.lastUpdated}: ${updatedAt}`)
      : "",
    contentSections: sectionDefinitions
      .map((section) => renderSection(section, locale, recordsByType, resolveUrl))
      .join("\n\n"),
  };
}
