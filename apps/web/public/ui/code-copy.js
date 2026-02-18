(() => {
  const textFromCodeBlock = (code) => {
    if (!code) return "";
    const lines = Array.from(code.querySelectorAll(".code-line"));
    if (lines.length) {
      return lines
        .map((line) => line.querySelector(".code-text")?.textContent?.trimEnd() ?? "")
        .join("\n");
    }
    return code.textContent ?? "";
  };

  const copyText = async (text) => {
    const s = String(text ?? "");
    if (!s) return false;
    try {
      await navigator.clipboard.writeText(s);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = s;
        ta.setAttribute("readonly", "true");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        ta.style.top = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return !!ok;
      } catch {
        return false;
      }
    }
  };

  document.addEventListener("click", async (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const button = target.closest("button[data-copy]") || target.closest("[data-copy]");
    if (!(button instanceof HTMLElement)) return;

    const code = button.closest(".code-block")?.querySelector("code");
    const text = textFromCodeBlock(code);
    if (!text) return;

    e.preventDefault();
    e.stopPropagation();

    const ok = await copyText(text);
    const prev = button.textContent ?? "";
    if (ok) {
      button.classList.add("copied");
      button.textContent = "已复制";
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.textContent = prev || "复制";
      }, 1400);
    } else {
      button.textContent = "复制失败";
      window.setTimeout(() => {
        button.textContent = prev || "复制";
      }, 1400);
    }
  });
})();

