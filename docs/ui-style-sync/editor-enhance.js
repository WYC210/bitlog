(() => {
  const editorGrid = document.querySelector(".editor-grid");
  const textarea = document.querySelector("#markdownTextarea");
  const refreshButton = document.querySelector('[data-action="refresh-preview"]');

  if (!editorGrid || !textarea) return;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const autoSize = (expanded) => {
    const maxHeight = expanded
      ? clamp(Math.round(window.innerHeight * 0.66), 360, 720)
      : clamp(Math.round(window.innerHeight * 0.44), 220, 460);

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
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

  textarea.addEventListener("focus", () => setExpanded(true));
  textarea.addEventListener("blur", () => setExpanded(false));
  textarea.addEventListener("input", () =>
    autoSize(editorGrid.classList.contains("focus-markdown")),
  );

  if (refreshButton) {
    refreshButton.addEventListener("click", () => locateMarkdown());
  }

  window.addEventListener("resize", () =>
    autoSize(editorGrid.classList.contains("focus-markdown")),
  );

  autoSize(false);
})();

