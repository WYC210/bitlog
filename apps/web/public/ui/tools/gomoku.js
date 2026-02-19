(function () {
  var root = document.getElementById('tool-root');
  if (!root) return;

  var BOARD_SIZE = 15;

  // ── State ──────────────────────────────────────────────────────────────────
  var mode = 'ai'; // 'ai' | 'pvp'
  var board = emptyBoard();
  var currentPlayer = 'black'; // 'black' | 'white'
  var winner = null;
  var gameStarted = false;
  var isThinking = false;

  function emptyBoard() {
    var b = [];
    for (var i = 0; i < BOARD_SIZE; i++) {
      b.push(new Array(BOARD_SIZE).fill(null));
    }
    return b;
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#gomoku-wrap{max-width:680px;margin:0 auto;padding:12px;font-family:system-ui,sans-serif;color:#e2e8f0}',
    '#gomoku-wrap *{box-sizing:border-box}',
    '.gm-mode-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:12px}',
    '.gm-mode-tab{padding:6px 20px;border:2px solid #334155;border-radius:8px;cursor:pointer;font-size:.9rem;background:transparent;color:#94a3b8;transition:all .15s}',
    '.gm-mode-tab.active{border-color:#3b82f6;color:#60a5fa;background:#1e3a5f}',
    '.gm-title{text-align:center;margin-bottom:10px}',
    '.gm-title h1{font-size:1.5rem;font-weight:700;margin:0 0 2px}',
    '.gm-title p{font-size:.85rem;color:#94a3b8;margin:0}',
    '.gm-row{display:flex;justify-content:center;margin-bottom:10px;gap:8px;flex-wrap:wrap}',
    '.gm-btn{padding:8px 24px;border:none;border-radius:8px;cursor:pointer;font-size:.95rem;font-weight:600;transition:background .15s}',
    '.gm-btn.green{background:#22c55e;color:#fff}.gm-btn.green:hover{background:#16a34a}',
    '.gm-btn.blue{background:#3b82f6;color:#fff}.gm-btn.blue:hover{background:#2563eb}',
    '.gm-status{text-align:center;padding:6px 16px;border-radius:8px;margin-bottom:8px;font-weight:600;font-size:.9rem}',
    '.gm-status.turn{background:#1e3a5f;color:#93c5fd}',
    '.gm-status.win{background:#14532d;color:#86efac;font-size:1rem}',
    '.gm-status.thinking{background:#1c1917;color:#fbbf24}',
    '.gm-hint{text-align:center;font-size:.78rem;color:#64748b;margin-bottom:8px}',
    '.gm-board-wrap{display:flex;justify-content:center;margin-bottom:8px}',
    '#gomoku-board{background:#92400e;border-radius:8px;padding:8px;cursor:pointer;touch-action:manipulation;display:block}',
  ].join('');
  document.head.appendChild(styleEl);

  // ── Canvas board ───────────────────────────────────────────────────────────
  var CELL = 36; // px per cell
  var PAD = 20;  // padding around grid
  var CANVAS_SIZE = PAD * 2 + CELL * (BOARD_SIZE - 1);

  function drawBoard(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    for (var i = 0; i < BOARD_SIZE; i++) {
      var x = PAD + i * CELL;
      var y = PAD + i * CELL;
      ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, PAD + (BOARD_SIZE-1)*CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(PAD + (BOARD_SIZE-1)*CELL, y); ctx.stroke();
    }

    // Star points
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    [3,7,11].forEach(function(r) {
      [3,7,11].forEach(function(c) {
        ctx.beginPath();
        ctx.arc(PAD + c*CELL, PAD + r*CELL, 3, 0, Math.PI*2);
        ctx.fill();
      });
    });

    // Pieces
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        var cell = board[row][col];
        if (!cell) continue;
        var cx = PAD + col * CELL;
        var cy = PAD + row * CELL;
        var r = CELL * 0.42;
        var grad = ctx.createRadialGradient(cx - r*0.3, cy - r*0.3, r*0.1, cx, cy, r);
        if (cell === 'black') {
          grad.addColorStop(0, '#555'); grad.addColorStop(1, '#111');
        } else {
          grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#ccc');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI*2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = cell === 'black' ? '#000' : '#aaa';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function canvasToCell(canvas, clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = canvas.width / rect.width;
    var scaleY = canvas.height / rect.height;
    var x = (clientX - rect.left) * scaleX;
    var y = (clientY - rect.top) * scaleY;
    var col = Math.round((x - PAD) / CELL);
    var row = Math.round((y - PAD) / CELL);
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
    return {row: row, col: col};
  }

  // ── Game logic ─────────────────────────────────────────────────────────────
  function checkWinner(b, row, col, player) {
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (var d = 0; d < dirs.length; d++) {
      var dx = dirs[d][0], dy = dirs[d][1];
      var count = 1;
      for (var i = 1; i < 5; i++) {
        var nr = row + dx*i, nc = col + dy*i;
        if (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE&&b[nr][nc]===player) count++;
        else break;
      }
      for (var i = 1; i < 5; i++) {
        var nr = row - dx*i, nc = col - dy*i;
        if (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE&&b[nr][nc]===player) count++;
        else break;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  function evaluatePosition(b, row, col, player) {
    var score = 0;
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (var d = 0; d < dirs.length; d++) {
      var dx = dirs[d][0], dy = dirs[d][1];
      var count = 1, blocked = 0;
      for (var i = 1; i < 5; i++) {
        var nr = row + dx*i, nc = col + dy*i;
        if (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE) {
          if (b[nr][nc]===player) count++;
          else if (b[nr][nc]!==null) { blocked++; break; }
          else break;
        } else { blocked++; break; }
      }
      for (var i = 1; i < 5; i++) {
        var nr = row - dx*i, nc = col - dy*i;
        if (nr>=0&&nr<BOARD_SIZE&&nc>=0&&nc<BOARD_SIZE) {
          if (b[nr][nc]===player) count++;
          else if (b[nr][nc]!==null) { blocked++; break; }
          else break;
        } else { blocked++; break; }
      }
      if (count>=5) score+=100000;
      else if (count===4&&blocked===0) score+=10000;
      else if (count===4&&blocked===1) score+=1000;
      else if (count===3&&blocked===0) score+=1000;
      else if (count===3&&blocked===1) score+=100;
      else if (count===2&&blocked===0) score+=100;
      else if (count===2&&blocked===1) score+=10;
    }
    return score;
  }

  function getAIMove(b) {
    var bestScore = -1, bestRow = -1, bestCol = -1;
    for (var row = 0; row < BOARD_SIZE; row++) {
      for (var col = 0; col < BOARD_SIZE; col++) {
        if (b[row][col] !== null) continue;
        var aiScore = evaluatePosition(b, row, col, 'white');
        var blockScore = evaluatePosition(b, row, col, 'black');
        var total = aiScore + blockScore * 0.8;
        if (total > bestScore) { bestScore = total; bestRow = row; bestCol = col; }
      }
    }
    return bestRow >= 0 ? {row: bestRow, col: bestCol} : null;
  }

  function makeMove(row, col) {
    if (!gameStarted || winner || isThinking) return;
    if (board[row][col] !== null) return;

    board[row][col] = currentPlayer;
    var canvas = document.getElementById('gomoku-canvas');
    if (canvas) drawBoard(canvas);

    if (checkWinner(board, row, col, currentPlayer)) {
      winner = currentPlayer;
      render();
      return;
    }

    var nextPlayer = currentPlayer === 'black' ? 'white' : 'black';
    currentPlayer = nextPlayer;
    updateStatus();

    if (mode === 'ai' && nextPlayer === 'white') {
      isThinking = true;
      updateStatus();
      var snap = board.map(function(r) { return r.slice(); });
      setTimeout(function() {
        var move = getAIMove(snap);
        if (move) {
          board[move.row][move.col] = 'white';
          var c2 = document.getElementById('gomoku-canvas');
          if (c2) drawBoard(c2);
          if (checkWinner(board, move.row, move.col, 'white')) {
            winner = 'white';
            isThinking = false;
            render();
            return;
          }
        }
        currentPlayer = 'black';
        isThinking = false;
        updateStatus();
      }, 400);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function updateStatus() {
    var el = document.getElementById('gm-status');
    if (!el) return;
    if (winner) {
      el.className = 'gm-status win';
      var wname = winner === 'black' ? '黑棋' : '白棋';
      el.textContent = '🎉 ' + wname + '获胜！' + (mode === 'ai' ? (winner === 'black' ? ' 恭喜战胜AI！' : ' AI获胜，再接再厉！') : '');
    } else if (isThinking) {
      el.className = 'gm-status thinking';
      el.textContent = '🤔 AI思考中...';
    } else if (gameStarted) {
      el.className = 'gm-status turn';
      el.textContent = (currentPlayer === 'black' ? '⚫ 黑棋' : '⚪ 白棋') + '回合';
    } else {
      el.className = 'gm-status turn';
      el.textContent = '点击开始游戏';
    }
  }

  function render() {
    root.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.id = 'gomoku-wrap';

    // Mode tabs (only before game)
    if (!gameStarted) {
      var tabs = document.createElement('div');
      tabs.className = 'gm-mode-tabs';
      [['ai','人机对战'],['pvp','双人对战']].forEach(function(m) {
        var btn = document.createElement('button');
        btn.className = 'gm-mode-tab' + (mode === m[0] ? ' active' : '');
        btn.textContent = m[1];
        btn.onclick = function() { mode = m[0]; render(); };
        tabs.appendChild(btn);
      });
      wrap.appendChild(tabs);
    }

    // Title
    var titleDiv = document.createElement('div');
    titleDiv.className = 'gm-title';
    titleDiv.innerHTML = '<h1>⚫ 五子棋</h1><p>' + (mode === 'ai' ? '人机对战' : '双人对战') + '</p>';
    wrap.appendChild(titleDiv);

    // Status
    var statusEl = document.createElement('div');
    statusEl.id = 'gm-status';
    wrap.appendChild(statusEl);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.className = 'gm-row';
    var btn = document.createElement('button');
    if (!gameStarted) {
      btn.className = 'gm-btn green'; btn.textContent = '🎮 开始游戏';
      btn.onclick = function() {
        board = emptyBoard(); currentPlayer = 'black'; winner = null;
        gameStarted = true; isThinking = false; render();
      };
    } else {
      btn.className = 'gm-btn blue'; btn.textContent = '🔄 重新开始';
      btn.onclick = function() {
        board = emptyBoard(); currentPlayer = 'black'; winner = null;
        isThinking = false; render();
      };
    }
    btnRow.appendChild(btn);
    wrap.appendChild(btnRow);

    // Hint
    var hint = document.createElement('div');
    hint.className = 'gm-hint';
    hint.textContent = '🎯 点击棋盘落子，先连成五子者获胜' + (mode === 'ai' ? '　⚫ 你执黑棋先手' : '');
    wrap.appendChild(hint);

    // Canvas
    var boardWrap = document.createElement('div');
    boardWrap.className = 'gm-board-wrap';
    var canvas = document.createElement('canvas');
    canvas.id = 'gomoku-canvas';
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    canvas.style.maxWidth = '95vw';
    canvas.style.height = 'auto';
    canvas.style.borderRadius = '8px';
    canvas.style.display = 'block';

    canvas.addEventListener('click', function(e) {
      var cell = canvasToCell(canvas, e.clientX, e.clientY);
      if (cell) makeMove(cell.row, cell.col);
    });
    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      var cell = canvasToCell(canvas, t.clientX, t.clientY);
      if (cell) makeMove(cell.row, cell.col);
    }, {passive: false});

    boardWrap.appendChild(canvas);
    wrap.appendChild(boardWrap);
    root.appendChild(wrap);

    drawBoard(canvas);
    updateStatus();
  }

  render();
})();
