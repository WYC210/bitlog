(function () {
  var root = document.getElementById('tool-root');
  if (!root) return;

  // ── State ──────────────────────────────────────────────────────────────────
  var mode = 'single'; // 'single' | 'double' | 'challenge'
  var gameSpeed = 'normal'; // 'slow' | 'normal' | 'fast'
  var gameStarted = false;
  var gameOver = false;
  var score = 0, score1 = 0, score2 = 0;
  var currentLevel = 1, currentSpeed = 150;
  var gameMessage = '';
  var levelUpTimer = null;
  var engine = null;

  // ── Styles (injected once) ─────────────────────────────────────────────────
  var styleEl = document.createElement('style');
  styleEl.textContent = [
    '#snake-wrap{max-width:860px;margin:0 auto;padding:12px;font-family:system-ui,sans-serif;color:#e2e8f0}',
    '#snake-wrap *{box-sizing:border-box}',
    '.sn-row{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}',
    '.sn-title{text-align:center;margin-bottom:8px}',
    '.sn-title h1{font-size:1.6rem;font-weight:700;margin:0 0 4px}',
    '.sn-title p{font-size:.9rem;color:#94a3b8;margin:0}',
    '.sn-score{text-align:center;font-size:1.1rem;font-weight:600;margin-bottom:8px}',
    '.sn-score .p1{color:#4ade80}.sn-score .p2{color:#60a5fa}',
    '.sn-badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;background:#1e3a5f;color:#93c5fd;margin:0 4px}',
    '.sn-badge.orange{background:#431407;color:#fdba74}',
    '.sn-hint{font-size:.72rem;color:#64748b;text-align:center;margin-top:2px}',
    '.sn-btn-group{display:inline-flex;background:#1e293b;border-radius:8px;padding:3px;gap:2px}',
    '.sn-btn{padding:6px 14px;border:none;border-radius:6px;cursor:pointer;font-size:.85rem;background:transparent;color:#94a3b8;transition:background .15s,color .15s}',
    '.sn-btn:hover{background:#334155;color:#e2e8f0}',
    '.sn-btn.active{background:#3b82f6;color:#fff}',
    '.sn-btn.green{background:#22c55e;color:#fff;font-weight:700;font-size:1rem;padding:10px 28px}',
    '.sn-btn.green:hover{background:#16a34a}',
    '.sn-btn.blue{background:#3b82f6;color:#fff;font-weight:700;font-size:1rem;padding:10px 28px}',
    '.sn-btn.blue:hover{background:#2563eb}',
    '.sn-msg{text-align:center;padding:10px 16px;border-radius:8px;margin-bottom:8px;font-weight:600}',
    '.sn-msg.levelup{background:#14532d;color:#86efac;animation:sn-pulse 1s infinite}',
    '.sn-msg.gameover{background:#450a0a;color:#fca5a5}',
    '.sn-msg.gameover p{margin:4px 0;font-size:.85rem;color:#f87171}',
    '@keyframes sn-pulse{0%,100%{opacity:1}50%{opacity:.6}}',
    '.sn-canvas-wrap{display:flex;justify-content:center;margin-bottom:10px}',
    '#snake-canvas{border:2px solid #334155;border-radius:8px;background:#000;max-width:95vw;height:auto;touch-action:none;display:block}',
    '.sn-dpad{display:grid;grid-template-columns:repeat(3,48px);grid-template-rows:repeat(2,48px);gap:4px;justify-content:center;margin-bottom:10px}',
    '.sn-dpad button{width:48px;height:48px;border:none;border-radius:8px;background:#1e293b;color:#e2e8f0;font-size:1.2rem;cursor:pointer;transition:background .1s;-webkit-tap-highlight-color:transparent}',
    '.sn-dpad button:active{background:#3b82f6}',
    '.sn-dpad .empty{background:transparent;pointer-events:none}',
    '.sn-controls{text-align:center;font-size:.8rem;color:#64748b;line-height:1.7}',
    '.sn-mode-tabs{display:flex;gap:6px;justify-content:center;margin-bottom:12px;flex-wrap:wrap}',
    '.sn-mode-tab{padding:6px 16px;border:2px solid #334155;border-radius:8px;cursor:pointer;font-size:.85rem;background:transparent;color:#94a3b8;transition:all .15s}',
    '.sn-mode-tab.active{border-color:#3b82f6;color:#60a5fa;background:#1e3a5f}',
  ].join('');
  document.head.appendChild(styleEl);

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    root.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.id = 'snake-wrap';

    // Mode tabs (only before game starts)
    if (!gameStarted) {
      var tabs = document.createElement('div');
      tabs.className = 'sn-mode-tabs';
      [['single','单人模式'],['double','双人模式'],['challenge','闯关模式']].forEach(function(m) {
        var btn = document.createElement('button');
        btn.className = 'sn-mode-tab' + (mode === m[0] ? ' active' : '');
        btn.textContent = m[1];
        btn.onclick = function() { mode = m[0]; render(); };
        tabs.appendChild(btn);
      });
      wrap.appendChild(tabs);
    }

    // Title
    var titleDiv = document.createElement('div');
    titleDiv.className = 'sn-title';
    titleDiv.innerHTML = '<h1>🐍 贪吃蛇游戏</h1><p>' + {
      single: '单人模式 - 使用方向键或WASD控制',
      double: '双人模式 - 玩家1: WASD, 玩家2: 方向键',
      challenge: '闯关模式 - 随着得分提高，游戏速度越来越快！'
    }[mode] + '</p>';
    wrap.appendChild(titleDiv);

    // Score
    var scoreDiv = document.createElement('div');
    scoreDiv.className = 'sn-score';
    if (mode === 'double') {
      scoreDiv.innerHTML = '<span class="p1">玩家1: ' + score1 + '</span> &nbsp;|&nbsp; <span class="p2">玩家2: ' + score2 + '</span>';
    } else {
      var html = '得分: ' + score;
      if (mode === 'challenge' && gameStarted) {
        html += '<br><span class="sn-badge">🏆 第 ' + currentLevel + ' 关</span>';
        html += '<span class="sn-badge orange">⚡ ' + (Math.round(1000/currentSpeed*10)/10) + '/s</span>';
        html += '<div class="sn-hint">每5分升级一关，速度会越来越快！</div>';
      }
      scoreDiv.innerHTML = html;
    }
    wrap.appendChild(scoreDiv);

    // Speed selector (before game)
    if (!gameStarted) {
      var speedRow = document.createElement('div');
      speedRow.className = 'sn-row';
      var grp = document.createElement('div');
      grp.className = 'sn-btn-group';
      [['slow','🐌 慢速'],['normal','🚶 正常'],['fast','🏃 快速']].forEach(function(s) {
        var b = document.createElement('button');
        b.className = 'sn-btn' + (gameSpeed === s[0] ? ' active' : '');
        b.textContent = s[1];
        b.onclick = function() { gameSpeed = s[0]; render(); };
        grp.appendChild(b);
      });
      speedRow.appendChild(grp);
      wrap.appendChild(speedRow);
      if (mode === 'challenge') {
        var warn = document.createElement('div');
        warn.className = 'sn-hint';
        warn.style.marginBottom = '8px';
        warn.textContent = '⚠️ 闯关模式：游戏会随着得分自动加速！';
        wrap.appendChild(warn);
      }
    }

    // Start / Reset button
    var btnRow = document.createElement('div');
    btnRow.className = 'sn-row';
    var actionBtn = document.createElement('button');
    if (!gameStarted) {
      actionBtn.className = 'sn-btn green';
      actionBtn.textContent = '🎮 开始游戏';
      actionBtn.onclick = startGame;
    } else {
      actionBtn.className = 'sn-btn blue';
      actionBtn.textContent = '🔄 重新开始';
      actionBtn.onclick = resetGame;
    }
    btnRow.appendChild(actionBtn);
    wrap.appendChild(btnRow);

    // Level-up message
    if (gameStarted && !gameOver) {
      var luDiv = document.createElement('div');
      luDiv.id = 'sn-levelup';
      luDiv.style.display = 'none';
      luDiv.className = 'sn-msg levelup';
      wrap.appendChild(luDiv);
    }

    // Game over message
    if (gameOver) {
      var goDiv = document.createElement('div');
      goDiv.className = 'sn-msg gameover';
      var goHtml = '🎯 ' + gameMessage;
      if (mode === 'double') {
        goHtml += '<p>玩家1: ' + score1 + ' | 玩家2: ' + score2 + '</p>';
      } else {
        goHtml += '<p>最终得分: ' + score + '</p>';
        if (mode === 'challenge') goHtml += '<p>闯关至第 ' + currentLevel + ' 关</p>';
      }
      goDiv.innerHTML = goHtml;
      wrap.appendChild(goDiv);
    }

    // Canvas
    var canvasWrap = document.createElement('div');
    canvasWrap.className = 'sn-canvas-wrap';
    var canvas = document.createElement('canvas');
    canvas.id = 'snake-canvas';
    canvas.width = 800;
    canvas.height = 600;
    canvasWrap.appendChild(canvas);
    wrap.appendChild(canvasWrap);

    // D-pad (always shown for touch)
    var dpad = document.createElement('div');
    dpad.className = 'sn-dpad';
    var dpadLayout = [
      {dir:'',label:''},
      {dir:'up',label:'↑'},
      {dir:'',label:''},
      {dir:'left',label:'←'},
      {dir:'down',label:'↓'},
      {dir:'right',label:'→'},
    ];
    dpadLayout.forEach(function(cell) {
      if (!cell.dir) {
        var empty = document.createElement('div');
        empty.className = 'empty';
        dpad.appendChild(empty);
      } else {
        var b = document.createElement('button');
        b.textContent = cell.label;
        b.addEventListener('touchstart', function(e) { e.preventDefault(); handleDpad(cell.dir); }, {passive:false});
        b.addEventListener('mousedown', function(e) { e.preventDefault(); handleDpad(cell.dir); });
        dpad.appendChild(b);
      }
    });
    wrap.appendChild(dpad);

    // Controls hint
    var ctrlDiv = document.createElement('div');
    ctrlDiv.className = 'sn-controls';
    if (mode === 'single' || mode === 'challenge') {
      ctrlDiv.innerHTML = '🖥️ 电脑：方向键 或 WASD &nbsp;|&nbsp; 📱 手机：滑动屏幕 或 点击虚拟按键';
    } else {
      ctrlDiv.innerHTML = '🎮 玩家1 (绿色)：WASD &nbsp;|&nbsp; 🎮 玩家2 (蓝色)：方向键 &nbsp;|&nbsp; 📱 手机：滑动控制玩家1';
    }
    wrap.appendChild(ctrlDiv);

    root.appendChild(wrap);

    // Init engine on canvas
    if (gameStarted && engine) {
      engine.attachCanvas(canvas);
    }
  }

  // ── D-pad handler ──────────────────────────────────────────────────────────
  function handleDpad(dir) {
    if (!engine || engine.isGameOver) return;
    if (mode === 'double') {
      if (dir === 'up' && engine.direction1 !== 'down') engine.nextDirection1 = 'up';
      if (dir === 'down' && engine.direction1 !== 'up') engine.nextDirection1 = 'down';
      if (dir === 'left' && engine.direction1 !== 'right') engine.nextDirection1 = 'left';
      if (dir === 'right' && engine.direction1 !== 'left') engine.nextDirection1 = 'right';
    } else {
      if (dir === 'up' && engine.direction !== 'down') engine.nextDirection = 'up';
      if (dir === 'down' && engine.direction !== 'up') engine.nextDirection = 'down';
      if (dir === 'left' && engine.direction !== 'right') engine.nextDirection = 'left';
      if (dir === 'right' && engine.direction !== 'left') engine.nextDirection = 'right';
    }
  }

  // ── Game control ───────────────────────────────────────────────────────────
  function startGame() {
    score = 0; score1 = 0; score2 = 0;
    gameOver = false; gameMessage = '';
    currentLevel = 1;
    var speedMap = {slow:200, normal:150, fast:100};
    currentSpeed = speedMap[gameSpeed];
    gameStarted = true;
    render();
    var canvas = document.getElementById('snake-canvas');
    engine = new SnakeEngine(canvas, mode);
    engine.setSpeed(gameSpeed);
    engine.onScoreUpdate = function(s, s1, s2) {
      if (mode === 'double') { score1 = s1||0; score2 = s2||0; }
      else { score = s; }
      updateScoreDisplay();
    };
    engine.onGameOver = function(msg) {
      gameOver = true;
      gameMessage = msg || '游戏结束！';
      render();
    };
    engine.onSpeedChange = function(newSpeed, level) {
      var prevLevel = currentLevel;
      currentSpeed = newSpeed;
      currentLevel = level;
      updateScoreDisplay();
      if (level > prevLevel) showLevelUp(level);
    };
    engine.start();
  }

  function resetGame() {
    if (engine) engine.stop();
    engine = null;
    gameStarted = false;
    gameOver = false;
    score = 0; score1 = 0; score2 = 0;
    gameMessage = '';
    currentLevel = 1;
    render();
  }

  function updateScoreDisplay() {
    var el = root.querySelector('.sn-score');
    if (!el) return;
    if (mode === 'double') {
      el.innerHTML = '<span class="p1">玩家1: ' + score1 + '</span> &nbsp;|&nbsp; <span class="p2">玩家2: ' + score2 + '</span>';
    } else {
      var html = '得分: ' + score;
      if (mode === 'challenge' && gameStarted) {
        html += '<br><span class="sn-badge">🏆 第 ' + currentLevel + ' 关</span>';
        html += '<span class="sn-badge orange">⚡ ' + (Math.round(1000/currentSpeed*10)/10) + '/s</span>';
        html += '<div class="sn-hint">每5分升级一关，速度会越来越快！</div>';
      }
      el.innerHTML = html;
    }
  }

  function showLevelUp(level) {
    var el = document.getElementById('sn-levelup');
    if (!el) return;
    el.textContent = '🎉 恭喜升级到第 ' + level + ' 关！';
    el.style.display = 'block';
    if (levelUpTimer) clearTimeout(levelUpTimer);
    levelUpTimer = setTimeout(function() {
      var e2 = document.getElementById('sn-levelup');
      if (e2) e2.style.display = 'none';
    }, 3000);
  }

  // ── Snake Engine ───────────────────────────────────────────────────────────
  function SnakeEngine(canvas, gameMode) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = gameMode;
    this.gridSize = 20;

    this.snake = [{x:400,y:300}];
    this.direction = 'right'; this.nextDirection = 'right';
    this.previousSnake = [{x:400,y:300}];

    this.snake1 = [{x:200,y:300}]; this.snake2 = [{x:600,y:300}];
    this.direction1 = 'right'; this.direction2 = 'left';
    this.nextDirection1 = 'right'; this.nextDirection2 = 'left';
    this.previousSnake1 = [{x:200,y:300}]; this.previousSnake2 = [{x:600,y:300}];

    this.food = {x:400,y:200};
    this.logicInterval = null;
    this.animationFrameId = null;
    this.logicSpeed = 150;
    this.initialLogicSpeed = 150;
    this.lastLogicUpdateTime = 0;
    this.isGameOver = false;
    this.lastInputTime1 = 0; this.lastInputTime2 = 0;
    this.inputDelay = 100;

    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.onSpeedChange = null;

    this._keyHandler = null;
    this._bindControls();
  }

  SnakeEngine.prototype.attachCanvas = function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  };

  SnakeEngine.prototype._bindControls = function() {
    var self = this;
    this._keyHandler = function(e) {
      if (self.isGameOver) return;
      var t = Date.now();
      var keys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','W','s','S','a','A','d','D'];
      if (keys.indexOf(e.key) !== -1) e.preventDefault();

      if (self.mode === 'double') {
        switch (e.key) {
          case 'w': case 'W':
            if (t - self.lastInputTime1 < self.inputDelay) return;
            if (self.direction1 !== 'down') self.nextDirection1 = 'up';
            self.lastInputTime1 = t; break;
          case 's': case 'S':
            if (t - self.lastInputTime1 < self.inputDelay) return;
            if (self.direction1 !== 'up') self.nextDirection1 = 'down';
            self.lastInputTime1 = t; break;
          case 'a': case 'A':
            if (t - self.lastInputTime1 < self.inputDelay) return;
            if (self.direction1 !== 'right') self.nextDirection1 = 'left';
            self.lastInputTime1 = t; break;
          case 'd': case 'D':
            if (t - self.lastInputTime1 < self.inputDelay) return;
            if (self.direction1 !== 'left') self.nextDirection1 = 'right';
            self.lastInputTime1 = t; break;
          case 'ArrowUp':
            if (t - self.lastInputTime2 < self.inputDelay) return;
            if (self.direction2 !== 'down') self.nextDirection2 = 'up';
            self.lastInputTime2 = t; break;
          case 'ArrowDown':
            if (t - self.lastInputTime2 < self.inputDelay) return;
            if (self.direction2 !== 'up') self.nextDirection2 = 'down';
            self.lastInputTime2 = t; break;
          case 'ArrowLeft':
            if (t - self.lastInputTime2 < self.inputDelay) return;
            if (self.direction2 !== 'right') self.nextDirection2 = 'left';
            self.lastInputTime2 = t; break;
          case 'ArrowRight':
            if (t - self.lastInputTime2 < self.inputDelay) return;
            if (self.direction2 !== 'left') self.nextDirection2 = 'right';
            self.lastInputTime2 = t; break;
        }
      } else {
        if (t - self.lastInputTime1 < self.inputDelay) return;
        self.lastInputTime1 = t;
        switch (e.key) {
          case 'ArrowUp': case 'w': case 'W':
            if (self.direction !== 'down') self.nextDirection = 'up'; break;
          case 'ArrowDown': case 's': case 'S':
            if (self.direction !== 'up') self.nextDirection = 'down'; break;
          case 'ArrowLeft': case 'a': case 'A':
            if (self.direction !== 'right') self.nextDirection = 'left'; break;
          case 'ArrowRight': case 'd': case 'D':
            if (self.direction !== 'left') self.nextDirection = 'right'; break;
        }
      }
    };
    document.addEventListener('keydown', this._keyHandler);

    // Touch swipe on canvas
    var touchStartX = 0, touchStartY = 0;
    var minSwipe = 30;
    var self2 = this;
    this.canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, {passive: false});
    this.canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      if (self2.isGameOver) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      var dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) < minSwipe) return;
        var dir = dx > 0 ? 'right' : 'left';
        if (self2.mode === 'double') {
          if (dir === 'right' && self2.direction1 !== 'left') self2.nextDirection1 = 'right';
          if (dir === 'left' && self2.direction1 !== 'right') self2.nextDirection1 = 'left';
        } else {
          if (dir === 'right' && self2.direction !== 'left') self2.nextDirection = 'right';
          if (dir === 'left' && self2.direction !== 'right') self2.nextDirection = 'left';
        }
      } else {
        if (Math.abs(dy) < minSwipe) return;
        var dir2 = dy > 0 ? 'down' : 'up';
        if (self2.mode === 'double') {
          if (dir2 === 'down' && self2.direction1 !== 'up') self2.nextDirection1 = 'down';
          if (dir2 === 'up' && self2.direction1 !== 'down') self2.nextDirection1 = 'up';
        } else {
          if (dir2 === 'down' && self2.direction !== 'up') self2.nextDirection = 'down';
          if (dir2 === 'up' && self2.direction !== 'down') self2.nextDirection = 'up';
        }
      }
    }, {passive: false});
  };

  SnakeEngine.prototype.generateFood = function() {
    var x, y, attempts = 0;
    do {
      x = Math.floor(Math.random() * (this.canvas.width / this.gridSize)) * this.gridSize;
      y = Math.floor(Math.random() * (this.canvas.height / this.gridSize)) * this.gridSize;
      attempts++;
    } while (this._foodOnSnake(x, y) && attempts < 100);
    return {x: x, y: y};
  };

  SnakeEngine.prototype._foodOnSnake = function(x, y) {
    var check = function(seg) { return seg.x === x && seg.y === y; };
    if (this.mode === 'double') {
      return this.snake1.some(check) || this.snake2.some(check);
    }
    return this.snake.some(check);
  };

  SnakeEngine.prototype.update = function() {
    if (this.mode === 'double') this._updateDouble();
    else this._updateSingle();
  };

  SnakeEngine.prototype._updateSingle = function() {
    this.previousSnake = JSON.parse(JSON.stringify(this.snake));
    this.direction = this.nextDirection;
    var head = {x: this.snake[0].x, y: this.snake[0].y};
    if (this.direction === 'up') head.y -= this.gridSize;
    else if (this.direction === 'down') head.y += this.gridSize;
    else if (this.direction === 'left') head.x -= this.gridSize;
    else head.x += this.gridSize;

    if (head.x < 0 || head.x >= this.canvas.width || head.y < 0 || head.y >= this.canvas.height ||
        this.snake.some(function(s) { return s.x === head.x && s.y === head.y; })) {
      this._gameOver(); return;
    }
    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      var newScore = this.snake.length - 1;
      if (this.onScoreUpdate) this.onScoreUpdate(newScore);
      this.food = this.generateFood();
      this._adjustSpeed(newScore);
    } else {
      this.snake.pop();
    }
  };

  SnakeEngine.prototype._updateDouble = function() {
    this.previousSnake1 = JSON.parse(JSON.stringify(this.snake1));
    this.previousSnake2 = JSON.parse(JSON.stringify(this.snake2));
    this.direction1 = this.nextDirection1;
    this.direction2 = this.nextDirection2;

    var h1 = {x: this.snake1[0].x, y: this.snake1[0].y};
    if (this.direction1 === 'up') h1.y -= this.gridSize;
    else if (this.direction1 === 'down') h1.y += this.gridSize;
    else if (this.direction1 === 'left') h1.x -= this.gridSize;
    else h1.x += this.gridSize;

    var h2 = {x: this.snake2[0].x, y: this.snake2[0].y};
    if (this.direction2 === 'up') h2.y -= this.gridSize;
    else if (this.direction2 === 'down') h2.y += this.gridSize;
    else if (this.direction2 === 'left') h2.x -= this.gridSize;
    else h2.x += this.gridSize;

    var d1 = this._checkCollision(h1, this.snake1, this.snake2);
    var d2 = this._checkCollision(h2, this.snake2, this.snake1);
    if (d1 && d2) { this._gameOver('平局！'); return; }
    if (d1) { this._gameOver('玩家2获胜！'); return; }
    if (d2) { this._gameOver('玩家1获胜！'); return; }

    this.snake1.unshift(h1);
    this.snake2.unshift(h2);
    var foodEaten = false;
    var s1 = this.snake1.length - 1, s2 = this.snake2.length - 1;
    if (h1.x === this.food.x && h1.y === this.food.y) { s1 = this.snake1.length; foodEaten = true; } else { this.snake1.pop(); }
    if (h2.x === this.food.x && h2.y === this.food.y) { s2 = this.snake2.length; foodEaten = true; } else { this.snake2.pop(); }
    if (foodEaten) { this.food = this.generateFood(); if (this.onScoreUpdate) this.onScoreUpdate(0, s1, s2); }
  };

  SnakeEngine.prototype._checkCollision = function(head, own, other) {
    if (head.x < 0 || head.x >= this.canvas.width || head.y < 0 || head.y >= this.canvas.height) return true;
    if (own.slice(1).some(function(s) { return s.x === head.x && s.y === head.y; })) return true;
    if (other && other.some(function(s) { return s.x === head.x && s.y === head.y; })) return true;
    return false;
  };

  SnakeEngine.prototype.render = function() {
    if (this.isGameOver) { this.animationFrameId = null; return; }
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    var t = Date.now();
    var p = Math.min(1, Math.max(0, (t - this.lastLogicUpdateTime) / this.logicSpeed));
    if (this.mode === 'double') {
      this._drawSnake(this.snake1, this.previousSnake1, p, '#2E7D32', '#4CAF50');
      this._drawSnake(this.snake2, this.previousSnake2, p, '#1565C0', '#2196F3');
    } else {
      this._drawSnake(this.snake, this.previousSnake, p, '#2E7D32', '#4CAF50');
    }
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(this.food.x, this.food.y, this.gridSize - 1, this.gridSize - 1);
    var self = this;
    this.animationFrameId = requestAnimationFrame(function() { self.render(); });
  };

  SnakeEngine.prototype._drawSnake = function(snake, prev, p, headColor, bodyColor) {
    var gs = this.gridSize;
    var ctx = this.ctx;
    snake.forEach(function(seg, i) {
      var ix, iy;
      if (i < prev.length) {
        ix = prev[i].x + (seg.x - prev[i].x) * p;
        iy = prev[i].y + (seg.y - prev[i].y) * p;
      } else { ix = seg.x; iy = seg.y; }
      ctx.fillStyle = i === 0 ? headColor : bodyColor;
      ctx.fillRect(ix, iy, gs - 1, gs - 1);
    });
  };

  SnakeEngine.prototype._gameOver = function(msg) {
    this.stop();
    this.isGameOver = true;
    if (this.onGameOver) this.onGameOver(msg);
  };

  SnakeEngine.prototype._adjustSpeed = function(score) {
    if (this.mode !== 'challenge') return;
    var level = Math.floor(score / 5) + 1;
    var reduction = Math.min((level - 1) * 8, this.initialLogicSpeed - 50);
    var newSpeed = this.initialLogicSpeed - reduction;
    if (newSpeed !== this.logicSpeed) {
      this.logicSpeed = newSpeed;
      this._resetInterval();
      if (this.onSpeedChange) this.onSpeedChange(newSpeed, level);
    }
  };

  SnakeEngine.prototype._resetInterval = function() {
    if (!this.logicInterval) return;
    clearInterval(this.logicInterval);
    var self = this;
    this.logicInterval = setInterval(function() {
      if (!self.isGameOver) { self.update(); self.lastLogicUpdateTime = Date.now(); }
    }, this.logicSpeed);
  };

  SnakeEngine.prototype.setSpeed = function(speed) {
    var map = {slow:200, normal:150, fast:100};
    this.logicSpeed = map[speed] || 150;
    this.initialLogicSpeed = this.logicSpeed;
  };

  SnakeEngine.prototype.start = function() {
    this.isGameOver = false;
    this.lastLogicUpdateTime = Date.now();
    var self = this;
    this.logicInterval = setInterval(function() {
      if (!self.isGameOver) { self.update(); self.lastLogicUpdateTime = Date.now(); }
    }, this.logicSpeed);
    this.render();
  };

  SnakeEngine.prototype.stop = function() {
    if (this.logicInterval) { clearInterval(this.logicInterval); this.logicInterval = null; }
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    if (this._keyHandler) { document.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
  };

  // ── Boot ───────────────────────────────────────────────────────────────────
  render();

  // Cleanup on page unload / navigation
  window.addEventListener('beforeunload', function() { if (engine) engine.stop(); });
})();
