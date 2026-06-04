/**
 * 主站 JS - 首页文章列表渲染与筛选
 */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('articlesGrid');
  const filterTabs = document.getElementById('filterTabs');
  let articles = [];
  let currentFilter = 'all';

  // 加载文章数据
  async function loadArticles() {
    try {
      const response = await fetch('data/articles.json');
      const data = await response.json();
      articles = data.articles;
      renderFilterTabs(data.categories);
      renderArticles(articles);
      updateStats();
    } catch (error) {
      console.error('加载文章失败:', error);
      grid.innerHTML = `
        <div class="empty-state">
          <div class="icon">😢</div>
          <h3>加载失败</h3>
          <p>请刷新页面重试</p>
        </div>
      `;
    }
  }

  // 渲染筛选标签
  function renderFilterTabs(categories) {
    filterTabs.innerHTML = categories.map(cat => `
      <button class="filter-tab ${cat.slug === 'all' ? 'active' : ''}" 
              data-category="${cat.slug}">
        ${cat.icon} ${cat.name}
      </button>
    `).join('');

    filterTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('filter-tab')) {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        currentFilter = e.target.dataset.category;
        filterArticles();
      }
    });
  }

  // 筛选文章
  function filterArticles() {
    const filtered = currentFilter === 'all' 
      ? articles 
      : articles.filter(a => a.category === currentFilter);
    renderArticles(filtered);
  }

  // 渲染文章卡片
  function renderArticles(articleList) {
    if (articleList.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <h3>暂无文章</h3>
          <p>该分类下还没有文章，敬请期待</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = articleList.map(article => `
      <article class="article-card">
        <div class="card-cover">
          ${article.coverEmoji}
        </div>
        <div class="card-content">
          <div class="card-meta">
            <span class="card-category">${article.categoryName}</span>
            <span>📅 ${formatDate(article.date)}</span>
          </div>
          <h3 class="card-title">
            <a href="articles/${article.slug}.html">${article.title}</a>
          </h3>
          <p class="card-desc">${article.description}</p>
          <div class="card-tags">
            ${article.tags.slice(0, 3).map(tag => `
              <span class="card-tag">${tag}</span>
            `).join('')}
          </div>
        </div>
      </article>
    `).join('');
  }

  // 格式化日期
  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // 更新统计数据
  function updateStats() {
    document.getElementById('articleCount').textContent = articles.length;
    document.getElementById('categoryCount').textContent = 
      [...new Set(articles.map(a => a.category))].length;
  }

  // 移动端菜单
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.querySelector('.nav-links');
  
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // 初始化
  loadArticles();
});
