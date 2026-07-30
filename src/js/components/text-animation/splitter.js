import {
  ARIA,
  CLASS_NAMES,
  CSS_PROPERTIES,
  DEFAULTS,
  ORDERS,
  UNITS,
} from "./constants";
import {
  createElement,
  normalizeText,
  segmentGraphemes,
  segmentWords,
  setCssNumber,
} from "./utils";

/* ==========================================================================
   Split Registry
   ========================================================================== */

/**
 * Original nodes are moved into a detached fragment instead of cloned.
 *
 * Restoring those exact nodes preserves nested element identity, event
 * listeners, application references, and framework bindings.
 */

const splitRecords = new WeakMap();

/* ==========================================================================
   Unit Indexes
   ========================================================================== */

function getOrderedIndexes(length, order) {
  const indexes = Array.from(
    {
      length,
    },
    (_, index) => index,
  );

  if (order === ORDERS.reverse) {
    return indexes.reverse();
  }

  if (order === ORDERS.center) {
    const center = (length - 1) / 2;

    return indexes.slice().sort((first, second) => {
      const firstDistance = Math.abs(first - center);
      const secondDistance = Math.abs(second - center);

      if (firstDistance === secondDistance) {
        return first - second;
      }

      return firstDistance - secondDistance;
    });
  }

  return indexes;
}

function assignUnitIndexes(units, order) {
  const orderedIndexes = getOrderedIndexes(units.length, order);

  orderedIndexes.forEach((originalIndex, animationIndex) => {
    const unit = units[originalIndex];

    unit.dataset.textAnimationIndex = String(animationIndex);

    setCssNumber(unit, CSS_PROPERTIES.index, animationIndex);
  });
}

/* ==========================================================================
   Original Content
   ========================================================================== */

function detachOriginalContent(element) {
  const fragment = element.ownerDocument.createDocumentFragment();

  while (element.firstChild) {
    fragment.append(element.firstChild);
  }

  return fragment;
}

function getFragmentText(fragment) {
  return normalizeText(fragment.textContent || "");
}

/* ==========================================================================
   Content Wrapper
   ========================================================================== */

function createContentWrapper(element) {
  return createElement(
    "span",
    {
      className: CLASS_NAMES.content,
    },
    element.ownerDocument,
  );
}

/* ==========================================================================
   Accessible Name
   ========================================================================== */

function applyAccessibleName(element, text) {
  const originalLabel = element.getAttribute(ARIA.label);

  if (!originalLabel && text) {
    element.setAttribute(ARIA.label, text);
  }

  return originalLabel;
}

/* ==========================================================================
   Whole-content Preparation
   ========================================================================== */

/**
 * Whole-content reveal animation keeps the original nodes intact and simply
 * wraps them in the visual content container.
 */

function prepareWholeContent(element) {
  const wrapper = createContentWrapper(element);

  while (element.firstChild) {
    wrapper.append(element.firstChild);
  }

  element.append(wrapper);

  return {
    wrapper,
    units: [],
    text: normalizeText(wrapper.textContent || ""),
    originalFragment: null,
    originalLabel: element.getAttribute(ARIA.label),
    unit: UNITS.none,
  };
}

/* ==========================================================================
   Word Splitting
   ========================================================================== */

function createWordUnits({ text, locale, wrapper, documentReference }) {
  const units = [];

  segmentWords(text, locale).forEach((segment) => {
    if (segment.isWhitespace) {
      const space = createElement(
        "span",
        {
          className: CLASS_NAMES.space,
          text: segment.value,
          attributes: {
            [ARIA.hidden]: "true",
          },
        },
        documentReference,
      );

      wrapper.append(space);
      return;
    }

    const word = createElement(
      "span",
      {
        className: `${CLASS_NAMES.unit} ${CLASS_NAMES.word}`,
        text: segment.value,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      documentReference,
    );

    units.push(word);
    wrapper.append(word);
  });

  return units;
}

/* ==========================================================================
   Character Splitting
   ========================================================================== */

function createCharacterUnits({ text, locale, wrapper, documentReference }) {
  const units = [];

  segmentGraphemes(text, locale).forEach((grapheme) => {
    const isWhitespace = /^\s$/u.test(grapheme);

    const character = createElement(
      "span",
      {
        className: [
          CLASS_NAMES.unit,
          CLASS_NAMES.character,
          isWhitespace ? CLASS_NAMES.whitespace : "",
        ]
          .filter(Boolean)
          .join(" "),
        text: grapheme,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      documentReference,
    );

    if (!isWhitespace) {
      units.push(character);
    }

    wrapper.append(character);
  });

  return units;
}

/* ==========================================================================
   Line Measurement
   ========================================================================== */

function getRoundedBlockPosition(element) {
  return Math.round(element.getBoundingClientRect().top * 2) / 2;
}

function collectMeasuredLines(tokens) {
  const lines = [];
  const tolerance = 1;

  tokens.forEach((token) => {
    const position = getRoundedBlockPosition(token);

    const currentLine = lines.at(-1);

    if (!currentLine || Math.abs(currentLine.position - position) > tolerance) {
      lines.push({
        position,
        tokens: [token],
      });

      return;
    }

    currentLine.tokens.push(token);
  });

  return lines;
}

/* ==========================================================================
   Line Splitting
   ========================================================================== */

/**
 * Lines are determined from temporary word tokens after they participate in
 * the browser's real layout.
 *
 * Rebuilding line wrappers can theoretically alter wrapping by a fraction of a
 * pixel. The wrapper uses the full available inline size to minimize that
 * difference.
 */

function createLineUnits({ text, locale, wrapper, documentReference }) {
  const measurementTokens = [];

  segmentWords(text, locale).forEach((segment) => {
    const token = createElement(
      "span",
      {
        className: segment.isWhitespace ? CLASS_NAMES.space : CLASS_NAMES.word,
        text: segment.value,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      documentReference,
    );

    wrapper.append(token);

    if (!segment.isWhitespace) {
      measurementTokens.push(token);
    }
  });

  if (measurementTokens.length === 0) {
    return [];
  }

  const measuredLines = collectMeasuredLines(measurementTokens);

  const lineUnits = measuredLines.map(() =>
    createElement(
      "span",
      {
        className: CLASS_NAMES.line,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      documentReference,
    ),
  );

  /**
   * Associate every node—including spaces—with the closest measured line.
   */

  const childNodes = Array.from(wrapper.childNodes);

  let lineIndex = 0;
  let nextLineFirstToken = measuredLines[lineIndex + 1]?.tokens[0] || null;

  childNodes.forEach((node) => {
    if (node === nextLineFirstToken) {
      lineIndex += 1;

      nextLineFirstToken = measuredLines[lineIndex + 1]?.tokens[0] || null;
    }

    lineUnits[lineIndex].append(node);
  });

  wrapper.replaceChildren();

  lineUnits.forEach((line) => {
    const clip = createElement(
      "span",
      {
        className: CLASS_NAMES.lineClip,
        attributes: {
          [ARIA.hidden]: "true",
        },
      },
      documentReference,
    );

    line.classList.add(CLASS_NAMES.unit);

    clip.append(line);
    wrapper.append(clip);
  });

  return lineUnits;
}

/* ==========================================================================
   Split Preparation
   ========================================================================== */

export function prepareSplitText(
  element,
  {
    unit = UNITS.none,
    locale = DEFAULTS.locale,
    order = ORDERS.normal,
    unitLimit = DEFAULTS.unitLimit,
  } = {},
) {
  if (!element || splitRecords.has(element)) {
    return splitRecords.get(element) || null;
  }

  if (unit === UNITS.none) {
    const wholeRecord = prepareWholeContent(element);

    splitRecords.set(element, wholeRecord);

    return wholeRecord;
  }

  const originalFragment = detachOriginalContent(element);
  const text = getFragmentText(originalFragment);

  if (!text) {
    element.append(originalFragment);

    return null;
  }

  const wrapper = createContentWrapper(element);
  const originalLabel = applyAccessibleName(element, text);

  element.append(wrapper);

  let units = [];

  if (unit === UNITS.words) {
    units = createWordUnits({
      text,
      locale,
      wrapper,
      documentReference: element.ownerDocument,
    });
  }

  if (unit === UNITS.characters) {
    units = createCharacterUnits({
      text,
      locale,
      wrapper,
      documentReference: element.ownerDocument,
    });
  }

  if (unit === UNITS.lines) {
    units = createLineUnits({
      text,
      locale,
      wrapper,
      documentReference: element.ownerDocument,
    });
  }

  const exceededUnitLimit = units.length > unitLimit;

  if (exceededUnitLimit) {
    wrapper.textContent = text;
    units = [];

    element.classList.add(CLASS_NAMES.unitLimit);
  }

  assignUnitIndexes(units, order);

  const record = {
    wrapper,
    units,
    text,
    unit,
    order,
    originalFragment,
    originalLabel,
    exceededUnitLimit,
  };

  splitRecords.set(element, record);

  return record;
}

/* ==========================================================================
   Line Refresh
   ========================================================================== */

/**
 * Line wrapping may change after a responsive resize or font load.
 *
 * The exact original nodes are temporarily restored before rebuilding the
 * measured line structure.
 */

export function refreshSplitLines(
  element,
  {
    locale = DEFAULTS.locale,
    order = ORDERS.normal,
    unitLimit = DEFAULTS.unitLimit,
  } = {},
) {
  const record = splitRecords.get(element);

  if (!record || record.unit !== UNITS.lines) {
    return record || null;
  }

  const text = record.text;
  const originalFragment = record.originalFragment;
  const originalLabel = record.originalLabel;

  record.wrapper.remove();

  const wrapper = createContentWrapper(element);

  element.append(wrapper);

  let units = createLineUnits({
    text,
    locale,
    wrapper,
    documentReference: element.ownerDocument,
  });

  const exceededUnitLimit = units.length > unitLimit;

  if (exceededUnitLimit) {
    wrapper.textContent = text;
    units = [];

    element.classList.add(CLASS_NAMES.unitLimit);
  } else {
    element.classList.remove(CLASS_NAMES.unitLimit);
  }

  assignUnitIndexes(units, order);

  const updatedRecord = {
    wrapper,
    units,
    text,
    unit: UNITS.lines,
    order,
    originalFragment,
    originalLabel,
    exceededUnitLimit,
  };

  splitRecords.set(element, updatedRecord);

  return updatedRecord;
}

/* ==========================================================================
   Record Access
   ========================================================================== */

export function getSplitRecord(element) {
  return splitRecords.get(element) || null;
}

/* ==========================================================================
   Restoration
   ========================================================================== */

export function restoreSplitText(element) {
  const record = splitRecords.get(element);

  if (!record) {
    return false;
  }

  if (record.originalFragment) {
    element.replaceChildren(record.originalFragment);
  } else if (record.wrapper) {
    const fragment = element.ownerDocument.createDocumentFragment();

    while (record.wrapper.firstChild) {
      fragment.append(record.wrapper.firstChild);
    }

    element.replaceChildren(fragment);
  }

  if (record.originalLabel === null) {
    element.removeAttribute(ARIA.label);
  } else {
    element.setAttribute(ARIA.label, record.originalLabel);
  }

  element.classList.remove(CLASS_NAMES.unitLimit);

  splitRecords.delete(element);

  return true;
}

/* ==========================================================================
   Unit Count
   ========================================================================== */

export function getUnitCount(element) {
  return splitRecords.get(element)?.units.length || 0;
}
