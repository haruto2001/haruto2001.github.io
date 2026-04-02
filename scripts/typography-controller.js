const LATIN_SEGMENT_PATTERN =
  /((?=[A-Za-z0-9])[A-Za-z0-9][A-Za-z0-9 !-/:-@[-`{-~]*|[A-Za-z]+(?:\s+[A-Za-z]+)+)/g;
const LATIN_DETECTION_PATTERN =
  /((?=[A-Za-z0-9])[A-Za-z0-9][A-Za-z0-9 !-/:-@[-`{-~]*|[A-Za-z]+(?:\s+[A-Za-z]+)+)/;

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  if (parent.closest(".latin-text, script, style, noscript")) {
    return true;
  }

  return parent.classList.contains("link-icon");
}

function createLatinFragment(document, text) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(LATIN_SEGMENT_PATTERN)) {
    const [value] = match;
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      fragment.append(document.createTextNode(text.slice(lastIndex, startIndex)));
    }

    const span = document.createElement("span");
    span.className = "latin-text";
    span.textContent = value;
    fragment.append(span);
    lastIndex = startIndex + value.length;
  }

  if (lastIndex < text.length) {
    fragment.append(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

export function createTypographyController(context) {
  const { document } = context;

  function apply(root = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent || !LATIN_DETECTION_PATTERN.test(node.textContent) || shouldSkipNode(node)) {
        continue;
      }
      targets.push(node);
    }

    targets.forEach((node) => {
      node.replaceWith(createLatinFragment(document, node.textContent ?? ""));
    });
  }

  return {
    apply,
  };
}
