/**
 * Vercel Serverless Function - 获取统计数据
 * 查询指定日期范围的统计数据
 */

const { kv } = require('@vercel/kv');

module.exports = async (req, res) => {
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { days = '7' } = req.query;
    const daysNum = Math.min(parseInt(days) || 7, 30); // 最多30天
    const pages = {};
    let totalPV = 0;
    let allVisitors = new Set();

    // 获取最近 N 天的数据
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      try {
        // 获取按页面维度的数据
        const keys = await kv.keys(`analytics:page:${dateKey}:*`);
        
        for (const key of keys) {
          const pagePath = key.replace(`analytics:page:${dateKey}:`, '');
          const data = await kv.get(key);
          
          if (data) {
            if (!pages[pagePath]) {
              pages[pagePath] = { pv: 0, visitors: new Set(), totalDuration: 0, count: 0 };
            }
            
            pages[pagePath].pv += data.pv || 0;
            
            if (data.visitors && Array.isArray(data.visitors)) {
              data.visitors.forEach(v => {
                pages[pagePath].visitors.add(v);
                allVisitors.add(v);
              });
            }
            
            pages[pagePath].totalDuration += data.totalDuration || 0;
            pages[pagePath].count += data.count || 0;
            totalPV += data.pv || 0;
          }
        }
      } catch (e) {
        // 某天数据可能不存在，继续
        console.log(`No data for ${dateKey}`);
      }
    }

    // 计算汇总统计
    let buyClicks = 0;
    let buyClickVisitors = new Set();
    let buyClickByPosition = {};
    let buyClickByPage = {};
    let pageTitles = {};

    // 统计购买链接点击数据 + 文章标题映射
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      try {
        const dailyData = await kv.get(`analytics:${dateKey}`);
        if (dailyData && Array.isArray(dailyData)) {
          dailyData.forEach(record => {
            // 收集页面标题
            if (record.pageTitle && record.page && !pageTitles[record.page]) {
              pageTitles[record.page] = record.pageTitle;
            }
            // 购买链接点击
            if (record.type === 'buy_click') {
              buyClicks++;
              if (record.visitorId) buyClickVisitors.add(record.visitorId);
              if (record.linkPosition) {
                buyClickByPosition[record.linkPosition] = (buyClickByPosition[record.linkPosition] || 0) + 1;
              }
              if (record.page) {
                buyClickByPage[record.page] = (buyClickByPage[record.page] || 0) + 1;
              }
            }
          });
        }
      } catch (e) {
        console.log(`No daily data for ${dateKey}`);
      }
    }

    // 按文章维度统计阅读次数（仅 /articles/ 下的页面）
    const articleStats = Object.entries(pages)
      .filter(([path]) => path.includes('/articles/'))
      .map(([path, data]) => ({
        path,
        title: pageTitles[path] || path,
        pv: data.pv,
        uv: data.visitors.size,
        avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
      }))
      .sort((a, b) => b.pv - a.pv);

    const stats = {
      summary: {
        pv: totalPV,
        uv: allVisitors.size,
        days: daysNum,
        buyClicks: buyClicks,
        buyClickUv: buyClickVisitors.size,
        buyClickByPosition: buyClickByPosition
      },
      buyClickByPage: Object.entries(buyClickByPage).map(([page, clicks]) => ({
        page,
        title: pageTitles[page] || page,
        clicks
      })).sort((a, b) => b.clicks - a.clicks),
      articles: articleStats,
      pages: Object.entries(pages).map(([path, data]) => ({
        path,
        title: pageTitles[path] || path,
        pv: data.pv,
        uv: data.visitors.size,
        avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
      })).sort((a, b) => b.pv - a.pv)
    };

    // 计算全局平均停留时长
    let totalDuration = 0;
    let totalCount = 0;
    stats.pages.forEach(p => {
      totalDuration += p.avgDuration * p.uv;
      totalCount += p.uv;
    });
    stats.summary.avgDuration = totalCount > 0 ? Math.round(totalDuration / totalCount) : 0;

    return res.status(200).json(stats);

  } catch (error) {
    console.error('Stats error:', error);
    
    // KV 不可用时返回模拟数据
    return res.status(200).json({
      summary: {
        pv: 0,
        uv: 0,
        days: parseInt(req.query.days) || 7,
        note: 'KV not configured, showing placeholder data'
      },
      pages: []
    });
  }
};
