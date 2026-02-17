(() => {
  const editorGrid = document.querySelector(".editor-grid");
  const textarea = document.querySelector("#markdownTextarea");
  const refreshButton = document.querySelector('[data-action="refresh-preview"]');
  const previewPane = document.querySelector("#previewPane");

  if (!editorGrid || !textarea) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const autoSize = (expanded) => {
    const maxHeight = expanded
      ? clamp(Math.round(window.innerHeight * 0.66), 360, 720)
      : clamp(Math.round(window.innerHeight * 0.44), 220, 460);
    const minHeight = expanded ? 320 : 220;

    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const setExpanded = (expanded) => {
    editorGrid.classList.toggle("focus-markdown", expanded);
    textarea.classList.toggle("is-expanded", expanded);
    autoSize(expanded);
  };

  const flash = () => {
    textarea.classList.add("is-flash");
    window.setTimeout(() => textarea.classList.remove("is-flash"), 520);
  };

  const locateMarkdown = () => {
    setExpanded(true);
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.focus();
    flash();
  };

  const locateByIndex = (index) => {
    const safeIndex = clamp(index, 0, textarea.value.length);
    const computed = window.getComputedStyle(textarea);
    const fontSize = parseFloat(computed.fontSize) || 14;
    const lineHeightRaw = computed.lineHeight;
    const lineHeight =
      lineHeightRaw && lineHeightRaw !== "normal"
        ? parseFloat(lineHeightRaw)
        : Math.round(fontSize * 1.5);

    const before = textarea.value.slice(0, safeIndex);
    const lineNumber = before.split("\n").length;

    setExpanded(true);
    textarea.focus({ preventScroll: true });
    textarea.setSelectionRange(safeIndex, safeIndex);
    textarea.scrollTop = Math.max(0, (lineNumber - 1) * lineHeight - textarea.clientHeight * 0.35);
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    flash();
  };

  const normalizeText = (text) =>
    (text || "")
      .replace(/\u00A0/g, " ")
      .trim()
      .replace(/\s+/g, " ");

  const findHeadingIndex = (headingText) => {
    const target = normalizeText(headingText);
    if (!target) return null;

    const lines = textarea.value.split("\n");
    let offset = 0;
    for (const line of lines) {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (match) {
        const title = normalizeText(match[2]);
        if (title === target) return offset;
      }
      offset += line.length + 1;
    }
    return null;
  };

  textarea.addEventListener("focus", () => setExpanded(true));
  textarea.addEventListener("blur", () => setExpanded(false));
  textarea.addEventListener("input", () =>
    autoSize(editorGrid.classList.contains("focus-markdown")),
  );

  if (refreshButton) {
    refreshButton.addEventListener("click", () => locateByIndex(textarea.selectionStart ?? 0));
  }

  if (previewPane) {
    previewPane.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const heading =
        target.closest("h1,h2,h3,h4,h5,h6") ||
        previewPane.querySelector("h1,h2,h3,h4,h5,h6");

      const headingText = heading ? heading.textContent : "";
      const index = findHeadingIndex(headingText);
      if (index === null) {
        locateByIndex(textarea.selectionStart ?? 0);
        return;
      }

      locateByIndex(index);
    });
  }

  window.addEventListener("resize", () =>
    autoSize(editorGrid.classList.contains("focus-markdown")),
  );

  autoSize(false);
})();
