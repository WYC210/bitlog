(function () {
  var root = document.getElementById("tool-root");
  if (!root) return;

  var slug = (location.pathname.split("/").filter(Boolean).pop() || "").trim();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function ensureStyle() {
    if (document.getElementById("blt-style")) return;
    var s = document.createElement("style");
    s.id = "blt-style";
    s.textContent = [
      ".blt{max-width:980px;margin:0 auto;font-family:var(--font)}",
      ".blt *{box-sizing:border-box}",
      ".blt-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:12px 0}",
      ".blt-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
      ".blt-in{flex:1;min-width:240px;padding:10px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface-2);color:var(--text);outline:none}",
      ".blt-in:focus{box-shadow:var(--focus);border-color:rgba(75,107,255,.7)}",
      ".blt-btn{padding:9px 12px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;box-shadow:var(--shadow-soft)}",
      ".blt-btn.primary{background:var(--primary);border-color:transparent;color:#fff}",
      ".blt-card{border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:var(--shadow-soft);overflow:hidden}",
      ".blt-h{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--border);background:linear-gradient(180deg, rgba(75,107,255,.10), transparent)}",
      ".blt-out{padding:12px}",
      ".blt-pre{margin:0;white-space:pre-wrap;word-break:break-word;background:var(--bg-soft);border:1px solid var(--border);border-radius:12px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;line-height:1.5}",
      ".blt-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
      "@media(max-width:780px){.blt-grid2{grid-template-columns:1fr}}",
      ".blt-img{max-width:100%;border-radius:12px;border:1px solid var(--border)}",
      ".blt-err{color:var(--danger);font-weight:800}",
      ".blt-small{font-size:12px;color:var(--muted)}"
    ].join("");
    document.head.appendChild(s);
  }

  ensureStyle();

  function mount(html) {
    root.innerHTML = '<div class="blt">' + html + "</div>";
  }

  if (slug === "text-formatter") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><span class="blt-small">自动清除换行/制表符/多余空格</span></div><div class="blt-row"><button id="copy" class="blt-btn">复制结果</button></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输入</span></div><div class="blt-out"><textarea id="in" class="blt-in" style="min-height:260px;width:100%" placeholder="粘贴文本..."></textarea></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输出</span></div><div class="blt-out"><pre id="out" class="blt-pre" style="min-height:260px"></pre></div></div>',
        "</div>"
      ].join("")
    );
    var inp = document.getElementById("in");
    var out = document.getElementById("out");
    function fmt(t) {
      return String(t || "")
        .replace(/[\r\n]+/g, "")
        .replace(/\t+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    inp.oninput = function () {
      out.textContent = fmt(inp.value);
    };
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(out.textContent || "");
      } catch (e) {}
    };
    return;
  }

  if (slug === "json-formatter") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><input id="indent" class="blt-in" style="min-width:110px;flex:0" value="2" placeholder="缩进"></div><div class="blt-row"><button id="copy" class="blt-btn">复制格式化</button></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输入 JSON</span></div><div class="blt-out"><textarea id="in" class="blt-in" style="min-height:260px;width:100%" placeholder="{&quot;a&quot;:1}"></textarea></div></div>',
        '<div class="blt-card"><div class="blt-h"><span id="msg" class="blt-small"></span></div><div class="blt-out"><pre id="out" class="blt-pre" style="min-height:260px"></pre></div></div>',
        "</div>"
      ].join("")
    );
    var jin = document.getElementById("in");
    var jout = document.getElementById("out");
    var msg = document.getElementById("msg");
    function render() {
      var n = Number(document.getElementById("indent").value || "2");
      if (!Number.isFinite(n) || n < 0 || n > 8) n = 2;
      var t = String(jin.value || "").trim();
      if (!t) {
        jout.textContent = "";
        msg.textContent = "";
        return;
      }
      try {
        var obj = JSON.parse(t);
        jout.textContent = JSON.stringify(obj, null, n);
        msg.textContent = "OK";
        msg.style.color = "var(--success)";
      } catch (e) {
        jout.textContent = "";
        msg.textContent = "JSON 错误: " + (e && e.message ? e.message : "");
        msg.style.color = "var(--danger)";
      }
    }
    jin.oninput = render;
    document.getElementById("indent").oninput = render;
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(jout.textContent || "");
      } catch (e) {}
    };
    render();
    return;
  }

  if (slug === "xml-formatter") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><span class="blt-small">DOMParser + 简单缩进格式化</span></div><div class="blt-row"><button id="copy" class="blt-btn">复制格式化</button></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输入 XML</span></div><div class="blt-out"><textarea id="in" class="blt-in" style="min-height:260px;width:100%" placeholder="&lt;root&gt;&lt;/root&gt;"></textarea></div></div>',
        '<div class="blt-card"><div class="blt-h"><span id="msg" class="blt-small"></span></div><div class="blt-out"><pre id="out" class="blt-pre" style="min-height:260px"></pre></div></div>',
        "</div>"
      ].join("")
    );
    var xin = document.getElementById("in");
    var xout = document.getElementById("out");
    var xmsg = document.getElementById("msg");
    function formatXml(xml) {
      var reg = /(>)(<)(\/*)/g;
      xml = xml.replace(reg, "$1\n$2$3");
      var pad = 0;
      var lines = xml.split("\n");
      var r = [];
      for (var i = 0; i < lines.length; i++) {
        var node = lines[i];
        if (node.match(/^<\//) && pad > 0) pad--;
        r.push(new Array(pad + 1).join("  ") + node);
        if (node.match(/^<[^!?][^>]*[^\/]>.*/g) && !node.match(/<\/.*>$/)) pad++;
      }
      return r.join("\n").trim();
    }
    function renderXml() {
      var t = String(xin.value || "").trim();
      if (!t) {
        xout.textContent = "";
        xmsg.textContent = "";
        return;
      }
      try {
        var p = new DOMParser();
        var doc = p.parseFromString(t, "text/xml");
        var pe = doc.querySelector("parsererror");
        if (pe) throw new Error(pe.textContent || "XML parse error");
        var s = new XMLSerializer();
        xout.textContent = formatXml(s.serializeToString(doc));
        xmsg.textContent = "OK";
        xmsg.style.color = "var(--success)";
      } catch (e) {
        xout.textContent = "";
        xmsg.textContent = "XML 错误: " + (e && e.message ? e.message : "");
        xmsg.style.color = "var(--danger)";
      }
    }
    xin.oninput = renderXml;
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(xout.textContent || "");
      } catch (e) {}
    };
    renderXml();
    return;
  }

  if (slug === "text-diff") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><span class="blt-small">逐行对比（相同/修改/新增/删除）</span></div><div class="blt-row"><button id="copy" class="blt-btn">复制结果(JSON)</button></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">左侧</span></div><div class="blt-out"><textarea id="l" class="blt-in" style="min-height:220px;width:100%" placeholder="文本 A"></textarea></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">右侧</span></div><div class="blt-out"><textarea id="r" class="blt-in" style="min-height:220px;width:100%" placeholder="文本 B"></textarea></div></div>',
        "</div>",
        '<div style="height:10px"></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">结果</span></div><div class="blt-out"><pre id="out" class="blt-pre"></pre></div></div>'
      ].join("")
    );
    var L = document.getElementById("l");
    var R = document.getElementById("r");
    var D = document.getElementById("out");
    var last = [];
    function diff(a, b) {
      var la = String(a || "").split("\n");
      var lb = String(b || "").split("\n");
      var m = Math.max(la.length, lb.length);
      var out2 = [];
      for (var i = 0; i < m; i++) {
        var x = la[i];
        var y = lb[i];
        if (x == null && y != null) out2.push({ type: "added", right: y });
        else if (x != null && y == null) out2.push({ type: "removed", left: x });
        else if (x === y) out2.push({ type: "same", left: x, right: y });
        else out2.push({ type: "modified", left: x, right: y });
      }
      return out2;
    }
    function renderDiff() {
      last = diff(L.value, R.value);
      D.textContent = JSON.stringify(last, null, 2);
    }
    L.oninput = renderDiff;
    R.oninput = renderDiff;
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(JSON.stringify(last, null, 2));
      } catch (e) {}
    };
    renderDiff();
    return;
  }

  if (slug === "table-converter") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><span class="blt-small">CSV/TSV → Markdown 表格</span></div><div class="blt-row"><button id="copy" class="blt-btn">复制 Markdown</button></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输入（CSV/TSV）</span></div><div class="blt-out"><textarea id="in" class="blt-in" style="min-height:220px;width:100%" placeholder="a,b,c\\n1,2,3"></textarea></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输出（Markdown）</span></div><div class="blt-out"><pre id="out" class="blt-pre" style="min-height:220px"></pre></div></div>',
        "</div>"
      ].join("")
    );
    var tin = document.getElementById("in");
    var tout = document.getElementById("out");
    function parse(text) {
      var t = String(text || "").trim();
      if (!t) return [];
      var delim = t.indexOf("\t") !== -1 ? "\t" : ",";
      var lines = t.split(/\r?\n/).filter(Boolean);
      return lines.map(function (line) {
        return line.split(delim).map(function (x) {
          return x.trim();
        });
      });
    }
    function toMd(rows) {
      if (!rows.length) return "";
      var cols = Math.max.apply(
        null,
        rows.map(function (r) {
          return r.length;
        })
      );
      function cell(v) {
        return String(v == null ? "" : v).replace(/\|/g, "\\|");
      }
      var head = rows[0] || [];
      while (head.length < cols) head.push("");
      var h = "| " + head.map(cell).join(" | ") + " |";
      var div = "| " + new Array(cols).fill("---").join(" | ") + " |";
      var body = rows.slice(1).map(function (r) {
        while (r.length < cols) r.push("");
        return "| " + r.map(cell).join(" | ") + " |";
      });
      return [h, div].concat(body).join("\n");
    }
    function renderTable() {
      tout.textContent = toMd(parse(tin.value));
    }
    tin.oninput = renderTable;
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(tout.textContent || "");
      } catch (e) {}
    };
    renderTable();
    return;
  }

  if (slug === "image-comparison") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row">',
        '<input id="a" class="blt-in" style="min-width:220px;flex:0" type="file" accept="image/*">',
        '<input id="b" class="blt-in" style="min-width:220px;flex:0" type="file" accept="image/*">',
        '</div><div class="blt-row"><input id="rng" type="range" min="0" max="100" value="50" style="width:220px"></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">对比</span></div><div class="blt-out">',
        '<div style="position:relative;max-width:100%;aspect-ratio:16/9;background:var(--bg-soft);border:1px solid var(--border);border-radius:12px;overflow:hidden">',
        '<img id="ia" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" />',
        '<div id="clip" style="position:absolute;inset:0;overflow:hidden">',
        '<img id="ib" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" />',
        "</div></div></div></div>"
      ].join("")
    );
    var a = document.getElementById("a");
    var b = document.getElementById("b");
    var rng = document.getElementById("rng");
    var ia = document.getElementById("ia");
    var ib = document.getElementById("ib");
    var clip = document.getElementById("clip");
    function setClip() {
      clip.style.width = String(rng.value || "50") + "%";
    }
    function load(file, img) {
      if (!file) return;
      var r = new FileReader();
      r.onload = function (e) {
        img.src = String(e.target.result || "");
      };
      r.readAsDataURL(file);
    }
    a.onchange = function () {
      load(a.files && a.files[0], ia);
    };
    b.onchange = function () {
      load(b.files && b.files[0], ib);
    };
    rng.oninput = setClip;
    setClip();
    return;
  }

  if (slug === "image-converter") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row">',
        '<input id="f" class="blt-in" style="min-width:260px;flex:0" type="file" accept="image/*">',
        '<select id="fmt" class="blt-in" style="min-width:140px;flex:0"><option value="image/png">png</option><option value="image/jpeg">jpeg</option><option value="image/webp">webp</option></select>',
        '<input id="q" class="blt-in" style="min-width:160px;flex:0" type="range" min="0.1" max="1" step="0.05" value="0.85">',
        '</div><div class="blt-row"><button id="go" class="blt-btn primary">转换</button><a id="dl" class="blt-btn" href="#" style="text-decoration:none;display:none">下载</a><span id="msg" class="blt-small"></span></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">原图</span></div><div class="blt-out"><img id="prev" class="blt-img" /></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">转换后</span></div><div class="blt-out"><img id="out" class="blt-img" /></div></div>',
        "</div>"
      ].join("")
    );
    var f = document.getElementById("f");
    var fmt = document.getElementById("fmt");
    var q = document.getElementById("q");
    var prev = document.getElementById("prev");
    var outImg = document.getElementById("out");
    var dl = document.getElementById("dl");
    var msg2 = document.getElementById("msg");
    var img2 = new Image();
    var src = "";
    f.onchange = function () {
      var file = f.files && f.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function (e) {
        src = String(e.target.result || "");
        prev.src = src;
        outImg.src = "";
        dl.style.display = "none";
        msg2.textContent = "";
      };
      r.readAsDataURL(file);
    };
    document.getElementById("go").onclick = function () {
      if (!src) {
        msg2.textContent = "请先选择图片";
        return;
      }
      msg2.textContent = "转换中...";
      img2.onload = function () {
        var c = document.createElement("canvas");
        c.width = img2.width;
        c.height = img2.height;
        var ctx = c.getContext("2d");
        ctx.drawImage(img2, 0, 0);
        var mime = fmt.value || "image/png";
        var quality = Number(q.value || "0.85");
        c.toBlob(
          function (blob) {
            if (!blob) {
              msg2.textContent = "转换失败";
              return;
            }
            var url = URL.createObjectURL(blob);
            outImg.src = url;
            dl.href = url;
            dl.download = "converted." + (mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png");
            dl.style.display = "inline-flex";
            msg2.textContent = "完成: " + Math.round(blob.size / 1024) + "KB";
          },
          mime,
          quality
        );
      };
      img2.src = src;
    };
    return;
  }

  if (slug === "image-editor") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row">',
        '<input id="f" class="blt-in" style="min-width:260px;flex:0" type="file" accept="image/*">',
        '<button id="crop" class="blt-btn">裁剪选区</button>',
        '<button id="reset" class="blt-btn">重置</button>',
        '<a id="dl" class="blt-btn" href="#" style="text-decoration:none;display:none">下载 PNG</a>',
        '</div><div class="blt-row"><span id="msg" class="blt-small"></span></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">画布（拖拽框选裁剪区域）</span></div><div class="blt-out">',
        '<canvas id="cv" style="max-width:100%;border-radius:12px;border:1px solid var(--border);background:var(--bg-soft)"></canvas>',
        "</div></div>"
      ].join("")
    );
    var file2 = document.getElementById("f");
    var cv = document.getElementById("cv");
    var ctx2 = cv.getContext("2d");
    var dl2 = document.getElementById("dl");
    var msg3 = document.getElementById("msg");
    var img3 = new Image();
    var orig = null;
    var sel = null;
    var drag = false;
    var start = null;

    function draw() {
      if (!img3.width) {
        ctx2.clearRect(0, 0, cv.width, cv.height);
        return;
      }
      ctx2.clearRect(0, 0, cv.width, cv.height);
      ctx2.drawImage(img3, 0, 0);
      if (sel) {
        ctx2.save();
        ctx2.strokeStyle = "rgba(75,107,255,.9)";
        ctx2.lineWidth = 2;
        ctx2.setLineDash([6, 4]);
        ctx2.strokeRect(sel.x, sel.y, sel.w, sel.h);
        ctx2.restore();
      }
    }

    file2.onchange = function () {
      var file = file2.files && file2.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function (e) {
        img3.onload = function () {
          cv.width = img3.width;
          cv.height = img3.height;
          orig = img3.src;
          sel = null;
          draw();
          dl2.style.display = "none";
          msg3.textContent = img3.width + "×" + img3.height;
        };
        img3.src = String(e.target.result || "");
      };
      r.readAsDataURL(file);
    };

    cv.onmousedown = function (e) {
      if (!img3.width) return;
      drag = true;
      var rect = cv.getBoundingClientRect();
      start = {
        x: (e.clientX - rect.left) * (cv.width / rect.width),
        y: (e.clientY - rect.top) * (cv.height / rect.height)
      };
      sel = { x: start.x, y: start.y, w: 0, h: 0 };
      draw();
    };

    window.addEventListener("mousemove", function (e) {
      if (!drag || !start) return;
      var rect = cv.getBoundingClientRect();
      var x = (e.clientX - rect.left) * (cv.width / rect.width);
      var y = (e.clientY - rect.top) * (cv.height / rect.height);
      sel.w = x - start.x;
      sel.h = y - start.y;
      if (sel.w < 0) {
        sel.x = x;
        sel.w = start.x - x;
      } else sel.x = start.x;
      if (sel.h < 0) {
        sel.y = y;
        sel.h = start.y - y;
      } else sel.y = start.y;
      draw();
    });
    window.addEventListener("mouseup", function () {
      drag = false;
      start = null;
    });

    document.getElementById("crop").onclick = function () {
      if (!sel || sel.w < 2 || sel.h < 2) {
        msg3.textContent = "请先框选区域";
        return;
      }
      var c = document.createElement("canvas");
      c.width = Math.round(sel.w);
      c.height = Math.round(sel.h);
      c
        .getContext("2d")
        .drawImage(cv, Math.round(sel.x), Math.round(sel.y), Math.round(sel.w), Math.round(sel.h), 0, 0, c.width, c.height);
      cv.width = c.width;
      cv.height = c.height;
      ctx2 = cv.getContext("2d");
      ctx2.drawImage(c, 0, 0);
      sel = null;
      draw();
      cv.toBlob(
        function (blob) {
          var url = URL.createObjectURL(blob);
          dl2.href = url;
          dl2.download = "edited.png";
          dl2.style.display = "inline-flex";
        },
        "image/png"
      );
      msg3.textContent = "已裁剪: " + cv.width + "×" + cv.height;
    };

    document.getElementById("reset").onclick = function () {
      if (!orig) return;
      img3.src = orig;
      img3.onload = function () {
        cv.width = img3.width;
        cv.height = img3.height;
        ctx2 = cv.getContext("2d");
        sel = null;
        draw();
        msg3.textContent = img3.width + "×" + img3.height;
      };
    };

    return;
  }

  if (slug === "video-aspect") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row">',
        '<input id="f" class="blt-in" style="min-width:260px;flex:0" type="file" accept="video/*">',
        '<select id="ratio" class="blt-in" style="min-width:140px;flex:0"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="4:3">4:3</option><option value="1:1">1:1</option></select>',
        '<input id="color" class="blt-in" style="min-width:120px;flex:0;padding:0;height:40px" type="color" value="#000000">',
        '</div><div class="blt-row"><button id="go" class="blt-btn primary">生成（WebM）</button><a id="dl" class="blt-btn" href="#" style="text-decoration:none;display:none">下载</a><span id="msg" class="blt-small"></span></div></div>',
        '<div class="blt-grid2">',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">预览</span></div><div class="blt-out"><video id="v" controls style="max-width:100%;border-radius:12px;border:1px solid var(--border)"></video></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">输出</span></div><div class="blt-out"><video id="out" controls style="max-width:100%;border-radius:12px;border:1px solid var(--border)"></video></div></div>',
        '</div><canvas id="cv" style="display:none"></canvas>'
      ].join("")
    );
    var vf = document.getElementById("f");
    var ratio = document.getElementById("ratio");
    var color = document.getElementById("color");
    var v = document.getElementById("v");
    var outv = document.getElementById("out");
    var canv = document.getElementById("cv");
    var vdl = document.getElementById("dl");
    var vmsg = document.getElementById("msg");
    var srcUrl = "";

    vf.onchange = function () {
      var file = vf.files && vf.files[0];
      if (!file) return;
      if (srcUrl) URL.revokeObjectURL(srcUrl);
      srcUrl = URL.createObjectURL(file);
      v.src = srcUrl;
      outv.src = "";
      vdl.style.display = "none";
      vmsg.textContent = "";
    };

    document.getElementById("go").onclick = async function () {
      if (!srcUrl) {
        vmsg.textContent = "请先选择视频";
        return;
      }
      vmsg.textContent = "处理中...";
      vdl.style.display = "none";
      outv.src = "";

      var parts = String(ratio.value || "16:9").split(":");
      var rw = Number(parts[0]) || 16;
      var rh = Number(parts[1]) || 9;
      var targetRatio = rw / rh;

      await v.play().catch(function () {});
      v.pause();
      v.currentTime = 0;

      var vw = v.videoWidth || 0;
      var vh = v.videoHeight || 0;
      if (!vw || !vh) {
        vmsg.textContent = "无法读取视频尺寸";
        return;
      }

      var cw = vw;
      var ch = vh;
      if (vw / vh > targetRatio) ch = Math.round(vw / targetRatio);
      else cw = Math.round(vh * targetRatio);

      canv.width = cw;
      canv.height = ch;
      var ctx = canv.getContext("2d");
      var stream = canv.captureStream(30);
      var rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
      var chunks = [];
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onstop = function () {
        var blob = new Blob(chunks, { type: "video/webm" });
        var url = URL.createObjectURL(blob);
        outv.src = url;
        vdl.href = url;
        vdl.download = "aspect.webm";
        vdl.style.display = "inline-flex";
        vmsg.textContent = "完成: " + Math.round(blob.size / 1024) + "KB";
      };

      rec.start();
      await v.play().catch(function () {});

      function frame() {
        if (v.paused || v.ended) {
          rec.stop();
          return;
        }
        ctx.fillStyle = String(color.value || "#000");
        ctx.fillRect(0, 0, cw, ch);
        var x = (cw - vw) / 2;
        var y = (ch - vh) / 2;
        ctx.drawImage(v, x, y, vw, vh);
        requestAnimationFrame(frame);
      }

      frame();
    };

    return;
  }

  if (slug === "math-formula") {
    mount(
      [
        '<div class="blt-bar"><div class="blt-row"><span class="blt-small">LaTeX 输入（当前不做渲染预览）</span></div><div class="blt-row"><button id="copy" class="blt-btn">复制 LaTeX</button></div></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">LaTeX</span></div><div class="blt-out"><textarea id="in" class="blt-in" style="min-height:220px;width:100%" placeholder="\\\\frac{-b \\\\pm \\\\sqrt{b^2-4ac}}{2a}"></textarea></div></div>',
        '<div style="height:10px"></div>',
        '<div class="blt-card"><div class="blt-h"><span class="blt-small">提示</span></div><div class="blt-out"><pre class="blt-pre">后续可接入 KaTeX/MathJax 实现实时预览。</pre></div></div>'
      ].join("")
    );
    var min = document.getElementById("in");
    document.getElementById("copy").onclick = function () {
      try {
        navigator.clipboard.writeText(String(min.value || ""));
      } catch (e) {}
    };
    return;
  }

  mount(
    '<div class="blt-card"><div class="blt-out"><div class="blt-err">该工具暂未实现</div><div class="blt-small">slug = ' +
      esc(slug) +
      "</div></div></div>"
  );
})();

