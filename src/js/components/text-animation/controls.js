import { ARIA, SELECTORS } from "./constants";
import { isButtonElement, queryIncludingRoot, setPressed } from "./utils";

/* ==========================================================================
   Control Registry
   ========================================================================== */

const controlManagers = new WeakMap();

/* ==========================================================================
   Control Scope
   ========================================================================== */

const SCOPE_SELECTOR = [
  "[data-text-animation-scope]",
  "[data-text-animation-group]",
  ".card",
  "article",
  "section",
].join(", ");

/* ==========================================================================
   Controlled Element Resolution
   ========================================================================== */

function getAriaControlledElement(control) {
  const id = control.getAttribute("aria-controls")?.trim();

  if (!id) {
    return null;
  }

  return control.ownerDocument.getElementById(id);
}

function getControlScope(control) {
  return (
    getAriaControlledElement(control) ||
    control.closest(SCOPE_SELECTOR) ||
    control.ownerDocument
  );
}

function getControlledComponents(control) {
  const controlledElement = getAriaControlledElement(control);

  if (controlledElement?.matches?.(SELECTORS.component)) {
    return [controlledElement];
  }

  const scope = getControlScope(control);

  return queryIncludingRoot(scope, SELECTORS.component);
}

function getControlledGroups(control) {
  const controlledElement = getAriaControlledElement(control);

  if (controlledElement?.matches?.(SELECTORS.group)) {
    return [controlledElement];
  }

  const closestGroup = control.closest(SELECTORS.group);

  if (closestGroup) {
    return [closestGroup];
  }

  const scope = getControlScope(control);

  return queryIncludingRoot(scope, SELECTORS.group);
}

function getControlledRotator(control) {
  const controlledElement = getAriaControlledElement(control);

  if (controlledElement?.matches?.('[data-text-animation="rotate"]')) {
    return controlledElement;
  }

  const scope = getControlScope(control);

  return scope.querySelector?.('[data-text-animation="rotate"]') || null;
}

/* ==========================================================================
   Control Labels
   ========================================================================== */

function updateToggleLabel(
  control,
  paused,
  { pauseFallback = "Pause", resumeFallback = "Resume" } = {},
) {
  const pauseLabel = control.dataset.pauseLabel || pauseFallback;

  const resumeLabel = control.dataset.resumeLabel || resumeFallback;

  const nextLabel = paused ? resumeLabel : pauseLabel;

  /**
   * Only replace visible text when the button does not contain structured
   * icon markup. `aria-label` is always updated.
   */

  if (control.children.length === 0) {
    control.textContent = nextLabel;
  }

  control.setAttribute("aria-label", nextLabel);
  setPressed(control, paused);
}

/* ==========================================================================
   Text Animation Controls
   ========================================================================== */

export class TextAnimationControls {
  constructor(
    root = document,
    { getInstance, getGroup, getInstances, getGroups } = {},
  ) {
    if (!root?.addEventListener) {
      throw new TypeError("TextAnimationControls requires a DOM root.");
    }

    if (typeof getInstance !== "function") {
      throw new TypeError("TextAnimationControls requires getInstance().");
    }

    this.root = root;
    this.document =
      root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument;

    this.view = this.document.defaultView;

    this.getInstance = getInstance;

    this.getGroup = typeof getGroup === "function" ? getGroup : () => null;

    this.getInstances =
      typeof getInstances === "function" ? getInstances : () => [];

    this.getGroups = typeof getGroups === "function" ? getGroups : () => [];

    this.abortController = new this.view.AbortController();

    this.bindEvents();
  }

  /* ========================================================================
     Events
     ======================================================================== */

  bindEvents() {
    this.root.addEventListener(
      "click",
      (event) => {
        this.handleClick(event);
      },
      {
        signal: this.abortController.signal,
      },
    );
  }

  handleClick(event) {
    const control = event.target.closest(
      [
        SELECTORS.replay,
        SELECTORS.replayAll,
        SELECTORS.pauseAll,
        SELECTORS.rotateToggle,
        SELECTORS.rotatePrevious,
        SELECTORS.rotateNext,
      ].join(", "),
    );

    if (!control || !this.rootContains(control) || this.isDisabled(control)) {
      return;
    }

    event.preventDefault();

    if (control.matches(SELECTORS.replayAll)) {
      this.replayAll();
      return;
    }

    if (control.matches(SELECTORS.pauseAll)) {
      this.toggleAll(control);
      return;
    }

    if (control.matches(SELECTORS.replay)) {
      this.replayControl(control);
      return;
    }

    if (control.matches(SELECTORS.rotateToggle)) {
      this.toggleRotator(control);
      return;
    }

    if (control.matches(SELECTORS.rotatePrevious)) {
      this.previousPhrase(control);
      return;
    }

    if (control.matches(SELECTORS.rotateNext)) {
      this.nextPhrase(control);
    }
  }

  rootContains(element) {
    if (this.root.nodeType === Node.DOCUMENT_NODE) {
      return this.document.contains(element);
    }

    return this.root.contains(element);
  }

  isDisabled(control) {
    return Boolean(
      (isButtonElement(control) && control.disabled) ||
      control.getAttribute(ARIA.disabled) === "true",
    );
  }

  /* ========================================================================
     Replay
     ======================================================================== */

  replayControl(control) {
    const groupElements = getControlledGroups(control);

    const groups = groupElements
      .map((element) => this.getGroup(element))
      .filter(Boolean);

    if (groups.length > 0) {
      groups.forEach((group) => {
        group.replay();
      });

      return;
    }

    getControlledComponents(control)
      .map((element) => this.getInstance(element))
      .filter(Boolean)
      .forEach((instance) => {
        instance.replay();
      });
  }

  replayAll() {
    const groups = this.getGroups();

    const groupedInstances = new Set();

    groups.forEach((group) => {
      group.instances.forEach((instance) => {
        groupedInstances.add(instance);
      });

      group.replay();
    });

    this.getInstances().forEach((instance) => {
      if (!groupedInstances.has(instance)) {
        instance.replay();
      }
    });
  }

  /* ========================================================================
     Global Pause
     ======================================================================== */

  toggleAll(control) {
    const instances = this.getInstances();
    const groups = this.getGroups();

    const currentlyPaused = control.getAttribute(ARIA.pressed) === "true";

    const shouldPause = !currentlyPaused;

    groups.forEach((group) => {
      if (shouldPause) {
        group.pause();
      } else {
        group.resume();
      }
    });

    const groupedInstances = new Set();

    groups.forEach((group) => {
      group.instances.forEach((instance) => {
        groupedInstances.add(instance);
      });
    });

    instances.forEach((instance) => {
      if (groupedInstances.has(instance)) {
        return;
      }

      if (shouldPause) {
        instance.pause();
      } else {
        instance.resume();
      }
    });

    updateToggleLabel(control, shouldPause, {
      pauseFallback: "Pause animations",
      resumeFallback: "Resume animations",
    });
  }

  /* ========================================================================
     Rotator Controls
     ======================================================================== */

  getRotatorInstance(control) {
    const element = getControlledRotator(control);

    if (!element) {
      return null;
    }

    const instance = this.getInstance(element);

    if (
      !instance ||
      typeof instance.next !== "function" ||
      typeof instance.previous !== "function"
    ) {
      return null;
    }

    return instance;
  }

  toggleRotator(control) {
    const instance = this.getRotatorInstance(control);

    if (!instance) {
      return;
    }

    const paused = instance.togglePause();

    /**
     * `togglePause()` returns the operation result. Read the resulting state
     * from the instance to avoid confusing a successful resume with `false`.
     */

    void paused;

    updateToggleLabel(control, Boolean(instance.isPaused), {
      pauseFallback: "Pause",
      resumeFallback: "Resume",
    });
  }

  previousPhrase(control) {
    this.getRotatorInstance(control)?.previous({
      source: "control",
    });
  }

  nextPhrase(control) {
    this.getRotatorInstance(control)?.next({
      source: "control",
    });
  }

  /* ========================================================================
     Synchronization
     ======================================================================== */

  sync() {
    this.root.querySelectorAll?.(SELECTORS.rotateToggle).forEach((control) => {
      const instance = this.getRotatorInstance(control);

      updateToggleLabel(control, Boolean(instance?.isPaused), {
        pauseFallback: "Pause",
        resumeFallback: "Resume",
      });
    });
  }

  /* ========================================================================
     Destruction
     ======================================================================== */

  destroy() {
    this.abortController.abort();

    controlManagers.delete(this.root);
  }
}

/* ==========================================================================
   Initialization
   ========================================================================== */

export function initTextAnimationControls(root = document, callbacks = {}) {
  const existing = controlManagers.get(root);

  if (existing) {
    existing.sync();

    return existing;
  }

  const manager = new TextAnimationControls(root, callbacks);

  controlManagers.set(root, manager);

  return manager;
}

/* ==========================================================================
   Destruction
   ========================================================================== */

export function destroyTextAnimationControls(root = document) {
  const manager = controlManagers.get(root);

  if (!manager) {
    return false;
  }

  manager.destroy();

  return true;
}
