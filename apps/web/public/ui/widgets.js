// Widget System JavaScript
(function () {
  'use strict';

  // Update date widget
  function updateDateWidget() {
    const now = new Date();
    const dayEl = document.getElementById('currentDay');
    const weekdayEl = document.getElementById('currentWeekday');
    const dateEl = document.getElementById('currentDate');

    if (dayEl) {
      dayEl.textContent = now.getDate();
    }

    if (weekdayEl) {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      weekdayEl.textContent = weekdays[now.getDay()];
    }

    if (dateEl) {
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      dateEl.textContent = `${year}年${month}月`;
    }
  }

  // Fetch weather data (placeholder - replace with real API)
  async function fetchWeather() {
    // This is a placeholder. Replace with actual weather API call
    // Example: OpenWeatherMap, WeatherAPI, etc.
    return {
      temp: 22,
      condition: '晴朗',
      airQuality: '良好',
      humidity: 65,
      windSpeed: 12,
      uvIndex: '中等',
      icon: '☀️'
    };
  }

  // Update weather widget
  async function updateWeatherWidget() {
    try {
      const weather = await fetchWeather();

      const iconEl = document.querySelector('.weather-icon');
      const tempEl = document.querySelector('.weather-temp');
      const descEl = document.querySelector('.weather-desc');
      const detailEls = document.querySelectorAll('.weather-detail-value');

      if (iconEl) iconEl.textContent = weather.icon;
      if (tempEl) tempEl.textContent = `${weather.temp}°C`;
      if (descEl) descEl.textContent = `${weather.condition} · 空气${weather.airQuality}`;

      if (detailEls.length >= 3) {
        detailEls[0].textContent = `${weather.humidity}%`;
        detailEls[1].textContent = `${weather.windSpeed}km/h`;
        detailEls[2].textContent = weather.uvIndex;
      }
    } catch (error) {
      console.error('Failed to fetch weather:', error);
    }
  }

  // Fetch GitHub trending (placeholder - replace with real API)
  async function fetchGitHubTrending() {
    // This is a placeholder. Replace with GitHub API or trending API
    return [
      {
        name: 'anthropics/claude-code',
        description: 'Official CLI for Claude AI assistant',
        stars: '2.3k',
        language: 'TypeScript',
        url: 'https://github.com/anthropics/claude-code'
      },
      {
        name: 'vercel/next.js',
        description: 'The React Framework for Production',
        stars: '1.8k',
        language: 'JavaScript',
        url: 'https://github.com/vercel/next.js'
      },
      {
        name: 'microsoft/vscode',
        description: 'Visual Studio Code',
        stars: '1.5k',
        language: 'TypeScript',
        url: 'https://github.com/microsoft/vscode'
      }
    ];
  }

  // Update GitHub trending widget
  async function updateGitHubTrending() {
    try {
      const trending = await fetchGitHubTrending();
      const listEl = document.querySelector('.trending-list');

      if (!listEl) return;

      listEl.innerHTML = trending.map(repo => `
        <a class="trending-item" href="${repo.url}" target="_blank" rel="noopener noreferrer">
          <div class="trending-item-header">
            <div class="trending-item-avatar"></div>
            <div class="trending-item-name">${repo.name}</div>
          </div>
          <div class="trending-item-desc">${repo.description}</div>
          <div class="trending-item-stats">
            <span class="trending-stat">
              <svg class="trending-stat-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"></path>
              </svg>
              ${repo.stars}
            </span>
            <span class="trending-stat">${repo.language}</span>
          </div>
        </a>
      `).join('');
    } catch (error) {
      console.error('Failed to fetch GitHub trending:', error);
    }
  }

  // Fetch news (placeholder - replace with real API)
  async function fetchNews() {
    // This is a placeholder. Replace with news API
    return [
      {
        title: 'Claude Code 发布重大更新，支持更多编程语言',
        source: 'TechCrunch',
        time: '2小时前',
        url: '#'
      },
      {
        title: 'React 19 正式版即将发布，带来全新特性',
        source: 'Dev.to',
        time: '5小时前',
        url: '#'
      },
      {
        title: 'TypeScript 5.5 Beta 版本发布',
        source: 'Microsoft',
        time: '1天前',
        url: '#'
      }
    ];
  }

  // Update news widget
  async function updateNewsWidget() {
    try {
      const news = await fetchNews();
      const listEl = document.querySelector('.news-list');

      if (!listEl) return;

      listEl.innerHTML = news.map(item => `
        <a class="news-item" href="${item.url}" target="_blank" rel="noopener noreferrer">
          <div class="news-item-title">${item.title}</div>
          <div class="news-item-meta">
            <span class="news-item-source">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10"></circle>
              </svg>
              ${item.source}
            </span>
            <span class="news-item-time">${item.time}</span>
          </div>
        </a>
      `).join('');
    } catch (error) {
      console.error('Failed to fetch news:', error);
    }
  }

  // Refresh button handler
  function setupRefreshButtons() {
    const refreshButtons = document.querySelectorAll('.widget-action');

    refreshButtons.forEach(button => {
      if (button.textContent.includes('刷新')) {
        button.addEventListener('click', async (e) => {
          e.preventDefault();
          const widget = button.closest('.widget');

          // Add loading state
          button.style.opacity = '0.5';
          button.style.pointerEvents = 'none';

          // Determine which widget to refresh
          const title = widget.querySelector('.widget-title')?.textContent.trim();

          if (title.includes('天气')) {
            await updateWeatherWidget();
          } else if (title.includes('GitHub')) {
            await updateGitHubTrending();
          } else if (title.includes('新闻')) {
            await updateNewsWidget();
          }

          // Remove loading state
          button.style.opacity = '1';
          button.style.pointerEvents = 'auto';
        });
      }
    });
  }

  // Initialize map (placeholder)
  function initializeMap() {
    const mapContainer = document.querySelector('.map-container');
    if (!mapContainer) return;

    // This is a placeholder. Replace with actual map library (Leaflet, Mapbox, etc.)
    const placeholder = mapContainer.querySelector('.map-placeholder');
    if (placeholder) {
      setTimeout(() => {
        placeholder.textContent = '🗺️ 地图功能开发中';
      }, 1000);
    }
  }

  // Animate widgets on scroll
  function setupScrollAnimations() {
    const widgets = document.querySelectorAll('.widget');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    widgets.forEach((widget, index) => {
      widget.style.opacity = '0';
      widget.style.transform = 'translateY(20px)';
      widget.style.transition = `opacity 0.4s ease ${index * 0.1}s, transform 0.4s ease ${index * 0.1}s`;
      observer.observe(widget);
    });
  }

  // Auto-refresh widgets periodically
  function setupAutoRefresh() {
    // Refresh weather every 30 minutes
    setInterval(updateWeatherWidget, 30 * 60 * 1000);

    // Refresh GitHub trending every hour
    setInterval(updateGitHubTrending, 60 * 60 * 1000);

    // Refresh news every 15 minutes
    setInterval(updateNewsWidget, 15 * 60 * 1000);

    // Update date every minute
    setInterval(updateDateWidget, 60 * 1000);
  }

  // Initialize all widgets
  function initWidgets() {
    updateDateWidget();
    updateWeatherWidget();
    updateGitHubTrending();
    updateNewsWidget();
    initializeMap();
    setupRefreshButtons();
    setupScrollAnimations();
    setupAutoRefresh();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidgets);
  } else {
    initWidgets();
  }

  // Expose refresh functions globally for manual refresh
  window.widgetRefresh = {
    weather: updateWeatherWidget,
    github: updateGitHubTrending,
    news: updateNewsWidget,
    date: updateDateWidget,
    all: initWidgets
  };
})();
