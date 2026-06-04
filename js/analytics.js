/**
 * 分析埋点脚本
 * 追踪 PV、UV、停留时长
 */

(function() {
  'use strict';

  const API_BASE = '/api';
  const SESSION_KEY = 'chuhai_session';
  const VISITOR_KEY = 'chuhai_visitor';

  // 生成唯一标识
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // 获取或创建 Session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = generateId();
      sessionStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  }

  // 获取或创建 Visitor ID (用于 UV)
  function getVisitorId() {
    let visitorId = localStorage.getItem(VISITOR_KEY);
    if (!visitorId) {
      visitorId = generateId();
      localStorage.setItem(VISITOR_KEY, visitorId);
    }
    return visitorId;
  }

  // 获取当前页面路径
  function getPagePath() {
    return window.location.pathname;
  }

  // 发送追踪数据
  async function track(type, data = {}) {
    const payload = {
      type,
      page: getPagePath(),
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      timestamp: Date.now(),
      referrer: document.referrer || 'direct',
      userAgent: navigator.userAgent,
      ...data
    };

    try {
      await fetch(`${API_BASE}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (error) {
      // 静默失败，不影响用户体验
      console.debug('Tracking failed:', error);
    }
  }

  // 页面可见性变化处理
  let pageVisible = true;
  let hiddenTime = 0;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenTime = Date.now();
      pageVisible = false;
    } else {
      if (hiddenTime) {
        const visibleDuration = Date.now() - hiddenTime;
        // 只在标签页重新可见时增加时长
        hiddenTime = 0;
      }
      pageVisible = true;
    }
  });

  // 记录页面进入时间
  const pageStartTime = Date.now();

  // 获取页面标题（用于文章阅读统计）
  function getPageTitle() {
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim().substring(0, 200);
    return document.title || '';
  }

  // 发送 PV
  track('pv', { url: window.location.href });

  // 页面加载时发送基本 PV（含标题）
  window.addEventListener('load', () => {
    track('pv', { pageTitle: getPageTitle() });
  });

  // 页面离开时发送停留时长
  window.addEventListener('beforeunload', () => {
    const duration = Math.round((Date.now() - pageStartTime) / 1000);
    track('duration', { duration });
  });

  // 页面切换（对于 SPA 应用）
  if ('onpagehide' in window) {
    window.addEventListener('pagehide', () => {
      const duration = Math.round((Date.now() - pageStartTime) / 1000);
      track('duration', { duration });
    });
  }

  // ========== 购买链接点击追踪 ==========
  function trackBuyClick(e) {
    const link = e.currentTarget;
    const href = link.getAttribute('href') || '';
    if (!href.includes('anhao.remecc.com')) return;

    const linkText = link.textContent.trim().substring(0, 100);
    const linkPosition = link.closest('.article-detail-cta') ? 'article-bottom-cta'
      : link.closest('.cta-card') ? 'sidebar-cta'
      : link.closest('.nav-link-cta') ? 'header-nav'
      : link.closest('.article-detail-content') ? 'article-inline'
      : 'other';

    // 用 sendBeacon 保证页面跳转前数据发出
    const payload = {
      type: 'buy_click',
      page: getPagePath(),
      sessionId: getSessionId(),
      visitorId: getVisitorId(),
      timestamp: Date.now(),
      referrer: document.referrer || 'direct',
      userAgent: navigator.userAgent,
      buyLink: href,
      linkText: linkText,
      linkPosition: linkPosition
    };

    try {
      navigator.sendBeacon(`${API_BASE}/track`, JSON.stringify(payload));
    } catch (err) {
      // sendBeacon 失败时用 fetch + keepalive
      fetch(`${API_BASE}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    }
  }

  // 监听所有指向购买站的链接
  function bindBuyLinkTracking() {
    document.querySelectorAll('a[href*="anhao.remecc.com"]').forEach(link => {
      link.removeEventListener('click', trackBuyClick);
      link.addEventListener('click', trackBuyClick);
    });
  }

  // 页面加载后绑定
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindBuyLinkTracking);
  } else {
    bindBuyLinkTracking();
  }

  // 对于动态加载的内容，用 MutationObserver 自动绑定
  const observer = new MutationObserver(() => { bindBuyLinkTracking(); });
  observer.observe(document.body, { childList: true, subtree: true });

  // 导出给外部使用
  window.siteAnalytics = {
    track,
    getSessionId,
    getVisitorId,
    bindBuyLinkTracking
  };

  // 尝试获取统计数据（可选功能）
  window.siteAnalytics.fetchStats = async (days = 7) => {
    try {
      const response = await fetch(`${API_BASE}/stats?days=${days}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.debug('Failed to fetch stats:', error);
    }
    return null;
  };
})();
