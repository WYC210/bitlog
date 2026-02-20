// Dashboard Widgets JavaScript - Glassmorphism Style
(function () {
  'use strict';

  // Configuration
  const CONFIG = {
    refreshIntervals: {
      weather: 30 * 60 * 1000,  // 30 minutes
      github: 60 * 60 * 1000,   // 1 hour
      news: 15 * 60 * 1000,     // 15 minutes
    },
    animationDuration: 500,
    staggerDelay: 100,
  };

  // State management
  const state = {
    isLoading: false,
    lastUpdate: {},
    cache: {},
  };

  // Utility functions
  const utils = {
    formatNumber(num) {
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
      }
      return num.toString();
    },

    formatTime(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diff = Math.floor((now - date) / 1000);

      if (diff < 60) return '刚刚';
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      if (diff < 604800) return `${Math.floor(diff / 86400)}天前`;
      return date.toLocaleDateString('zh-CN');
    },

    debounce(fn, delay) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    throttle(fn, delay) {
      let lastCall = 0;
      return function (...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          fn.apply(this, args);
        }
      };
    },

    getWeatherIcon(code) {
      const icons = {
        '01d': '☀️', '01n': '🌙',
        '02d': '⛅', '02n': '☁️',
        '03d': '☁️', '03n': '☁️',
        '04d': '☁️', '04n': '☁️',
        '09d': '🌧️', '09n': '🌧️',
        '10d': '🌦️', '10n': '🌧️',
        '11d': '⛈️', '11n': '⛈️',
        '13d': '❄️', '13n': '❄️',
        '50d': '🌫️', '50n': '🌫️',
      };
      return icons[code] || '🌤️';
    },

    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        color: #333;
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
      `;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    setLoading(element, isLoading) {
      if (isLoading) {
        element.setAttribute('data-loading', 'true');
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';
      } else {
        element.removeAttribute('data-loading');
        element.style.opacity = '1';
        element.style.pointerEvents = 'auto';
      }
    },
  };

  // Weather Widget
  const weatherWidget = {
    async fetch() {
      // Mock data - replace with real API
      return {
        temp: 22,
        condition: '晴朗',
        airQuality: '良好',
        humidity: 65,
        windSpeed: 12,
        uvIndex: '中等',
        icon: '01d',
      };
    },

    async update() {
      const container = document.querySelector('.weather-card-main');
      if (!container) return;

      try {
        utils.setLoading(container.closest('.glass-card'), true);

        const data = await this.fetch();

        // Update temperature
        const tempEl = document.querySelector('.weather-card-temp');
        if (tempEl) {
          tempEl.textContent = `${data.temp}°`;
        }

        // Update description
        const descEl = document.querySelector('.weather-card-desc');
        if (descEl) {
          descEl.textContent = `${data.condition} · 空气${data.airQuality}`;
        }

        // Update icon
        const iconEl = document.querySelector('.weather-card-icon');
        if (iconEl) {
          iconEl.textContent = utils.getWeatherIcon(data.icon);
        }

        // Update details
        const detailValues = document.querySelectorAll('.weather-detail-value');
        if (detailValues.length >= 3) {
          detailValues[0].textContent = `${data.humidity}%`;
          detailValues[1].textContent = data.windSpeed;
          detailValues[2].textContent = data.uvIndex;
        }

        state.lastUpdate.weather = Date.now();
        utils.showToast('天气数据已更新', 'success');
      } catch (error) {
        console.error('Failed to update weather:', error);
        utils.showToast('天气数据更新失败', 'error');
      } finally {
        utils.setLoading(container.closest('.glass-card'), false);
      }
    },
  };

  // GitHub Trending Widget
  const githubWidget = {
    async fetch() {
      // Mock data - replace with real API
      return [
        {
          name: 'anthropics/claude-code',
          description: 'Official CLI for Claude AI assistant',
          stars: 2300,
          language: 'TypeScript',
          url: 'https://github.com/anthropics/claude-code',
        },
        {
          name: 'vercel/next.js',
          description: 'The React Framework for Production',
          stars: 1800,
          language: 'JavaScript',
          url: 'https://github.com/vercel/next.js',
        },
        {
          name: 'microsoft/vscode',
          description: 'Visual Studio Code',
          stars: 1500,
          language: 'TypeScript',
          url: 'https://github.com/microsoft/vscode',
        },
      ];
    },

    render(repos) {
      return repos.map(repo => `
        <a href="${repo.url}" target="_blank" rel="noopener noreferrer" class="glass-list-item">
          <div class="glass-list-item-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </div>
          <div class="glass-list-item-content">
            <div class="glass-list-item-title">${repo.name}</div>
            <div class="glass-list-item-subtitle">
              <span>${repo.language}</span>
              <span>•</span>
              <span>${repo.description.substring(0, 30)}...</span>
            </div>
          </div>
          <div class="glass-list-item-meta">⭐ ${utils.formatNumber(repo.stars)}</div>
        </a>
      `).join('');
    },

    async update() {
      const container = document.querySelector('.glass-card .glass-list');
      if (!container) return;

      try {
        utils.setLoading(container.closest('.glass-card'), true);

        const repos = await this.fetch();
        container.innerHTML = this.render(repos);

        state.lastUpdate.github = Date.now();
        utils.showToast('GitHub 趋势已更新', 'success');
      } catch (error) {
        console.error('Failed to update GitHub trending:', error);
        utils.showToast('GitHub 趋势更新失败', 'error');
      } finally {
        utils.setLoading(container.closest('.glass-card'), false);
      }
    },
  };

  // News Widget
  const newsWidget = {
    async fetch() {
      // Mock data - replace with real API
      return [
        {
          title: 'Claude Code 发布重大更新',
          source: 'TechCrunch',
          time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          url: '#',
        },
        {
          title: 'React 19 正式版即将发布',
          source: 'Dev.to',
          time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          url: '#',
        },
        {
          title: 'TypeScript 5.5 Beta 发布',
          source: 'Microsoft',
          time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          url: '#',
        },
      ];
    },

    render(articles) {
      return articles.map(article => `
        <a href="${article.url}" class="glass-list-item" target="_blank" rel="noopener noreferrer">
          <div class="glass-list-item-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="glass-list-item-content">
            <div class="glass-list-item-title">${article.title}</div>
            <div class="glass-list-item-subtitle">
              <span>${article.source}</span>
              <span>•</span>
              <span>${utils.formatTime(article.time)}</span>
            </div>
          </div>
        </a>
      `).join('');
    },

    async update() {
      const containers = document.querySelectorAll('.glass-card .glass-list');
      const newsContainer = Array.from(containers).find(el =>
        el.closest('.glass-card').querySelector('.glass-card-title')?.textContent.includes('新闻')
      );

      if (!newsContainer) return;

      try {
        utils.setLoading(newsContainer.closest('.glass-card'), true);

        const articles = await this.fetch();
        newsContainer.innerHTML = this.render(articles);

        state.lastUpdate.news = Date.now();
        utils.showToast('新闻已更新', 'success');
      } catch (error) {
        console.error('Failed to update news:', error);
        utils.showToast('新闻更新失败', 'error');
      } finally {
        utils.setLoading(newsContainer.closest('.glass-card'), false);
      }
    },
  };

  // Animation Controller
  const animations = {
    fadeInCards() {
      const cards = document.querySelectorAll('.glass-card');

      cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        setTimeout(() => {
          card.style.transition = `opacity ${CONFIG.animationDuration}ms ease, transform ${CONFIG.animationDuration}ms ease`;
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, index * CONFIG.staggerDelay);
      });
    },

    pulseCard(card) {
      card.style.animation = 'pulse 0.5s ease';
      setTimeout(() => {
        card.style.animation = '';
      }, 500);
    },
  };

  // Event Handlers
  const eventHandlers = {
    setupRefreshButtons() {
      const refreshButtons = document.querySelectorAll('.glass-btn');

      refreshButtons.forEach(button => {
        if (button.textContent.includes('刷新')) {
          button.addEventListener('click', async (e) => {
            e.preventDefault();

            const card = button.closest('.glass-card');
            const title = card.querySelector('.glass-card-title')?.textContent.trim();

            if (title.includes('天气')) {
              await weatherWidget.update();
            } else if (title.includes('GitHub')) {
              await githubWidget.update();
            } else if (title.includes('新闻')) {
              await newsWidget.update();
            }

            animations.pulseCard(card);
          });
        }
      });
    },

    setupHoverEffects() {
      const cards = document.querySelectorAll('.glass-card');

      cards.forEach(card => {
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-8px) scale(1.02)';
        });

        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
        });
      });
    },

    setupKeyboardNavigation() {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + R: Refresh all widgets
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
          e.preventDefault();
          this.refreshAll();
        }
      });
    },

    async refreshAll() {
      utils.showToast('正在刷新所有组件...', 'info');

      await Promise.all([
        weatherWidget.update(),
        githubWidget.update(),
        newsWidget.update(),
      ]);

      utils.showToast('所有组件已刷新', 'success');
    },
  };

  // Auto Refresh
  const autoRefresh = {
    timers: {},

    start() {
      // Weather auto-refresh
      this.timers.weather = setInterval(() => {
        weatherWidget.update();
      }, CONFIG.refreshIntervals.weather);

      // GitHub auto-refresh
      this.timers.github = setInterval(() => {
        githubWidget.update();
      }, CONFIG.refreshIntervals.github);

      // News auto-refresh
      this.timers.news = setInterval(() => {
        newsWidget.update();
      }, CONFIG.refreshIntervals.news);
    },

    stop() {
      Object.values(this.timers).forEach(timer => clearInterval(timer));
      this.timers = {};
    },
  };

  // Initialization
  function init() {
    // Check if we're on a page with dashboard widgets
    if (!document.querySelector('.glass-card')) {
      return;
    }

    // Run animations
    animations.fadeInCards();

    // Setup event handlers
    eventHandlers.setupRefreshButtons();
    eventHandlers.setupHoverEffects();
    eventHandlers.setupKeyboardNavigation();

    // Initial data load
    setTimeout(() => {
      weatherWidget.update();
      githubWidget.update();
      newsWidget.update();
    }, 1000);

    // Start auto-refresh
    autoRefresh.start();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      autoRefresh.stop();
    });

    // Expose API for manual control
    window.dashboardWidgets = {
      weather: weatherWidget,
      github: githubWidget,
      news: newsWidget,
      refreshAll: () => eventHandlers.refreshAll(),
      utils,
    };

    console.log('✨ Dashboard widgets initialized');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    @keyframes pulse {
      0%, 100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }
  `;
  document.head.appendChild(style);
})();
