/**
 * Netlify Function - 获取统计数据
 * 查询指定日期范围的统计数据
 */

let kv = null;
async function getKvStore() {
  if (!kv) {
    try {
      const { KV } = await import('@netlify/blobs');
      kv = new KV({ siteId: process.env.SITE_ID, token: process.env.NETLIFY_API_TOKEN });
    } catch (e) {
      console.log('KV store not available');
    }
  }
  return kv;
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const params = event.queryStringParameters || {};
  const daysNum = Math.min(parseInt(params.days) || 7, 30);
  const pages = {};
  let totalPV = 0;
  let allVisitors = new Set();

  const store = await getKvStore();

  if (store) {
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      try {
        const dailyData = await store.get(`analytics:${dateKey}`, { type: 'json' }) || [];
        dailyData.forEach(record => {
          if (!pages[record.page]) {
            pages[record.page] = { pv: 0, visitors: new Set(), totalDuration: 0, count: 0, pageTitle: '' };
          }
          pages[record.page].pv++;
          pages[record.page].visitors.add(record.visitorId);
          if (record.duration) {
            pages[record.page].totalDuration += record.duration;
            pages[record.page].count++;
          }
          if (record.pageTitle) pages[record.page].pageTitle = record.pageTitle;
          allVisitors.add(record.visitorId);
          totalPV++;
        });
      } catch (e) {
        console.log(`No data for ${dateKey}`);
      }
    }
  }

  let buyClicks = 0;
  let buyClickByPosition = {};
  let buyClickByPage = {};
  let pageTitles = {};

  if (store) {
    for (let i = 0; i < daysNum; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];

      try {
        const dailyData = await store.get(`analytics:${dateKey}`, { type: 'json' }) || [];
        dailyData.forEach(record => {
          if (record.pageTitle && record.page) pageTitles[record.page] = record.pageTitle;
          if (record.type === 'buy_click') {
            buyClicks++;
            if (record.linkPosition) {
              buyClickByPosition[record.linkPosition] = (buyClickByPosition[record.linkPosition] || 0) + 1;
            }
            if (record.page) {
              buyClickByPage[record.page] = (buyClickByPage[record.page] || 0) + 1;
            }
          }
        });
      } catch (e) {
        console.log(`No daily data for ${dateKey}`);
      }
    }
  }

  const articleStats = Object.entries(pages)
    .filter(([path]) => path.includes('/articles/'))
    .map(([path, data]) => ({
      path,
      title: pageTitles[path] || data.pageTitle || path,
      pv: data.pv,
      uv: data.visitors.size,
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
    }))
    .sort((a, b) => b.pv - a.pv);

  let totalDuration = 0, totalCount = 0;
  Object.values(pages).forEach(p => {
    totalDuration += p.avgDuration * p.uv;
    totalCount += p.uv;
  });

  const result = {
    summary: {
      pv: totalPV,
      uv: allVisitors.size,
      days: daysNum,
      avgDuration: totalCount > 0 ? Math.round(totalDuration / totalCount) : 0,
      buyClicks,
      buyClickByPosition
    },
    buyClickByPage: Object.entries(buyClickByPage).map(([page, clicks]) => ({
      page,
      title: pageTitles[page] || page,
      clicks
    })).sort((a, b) => b.clicks - a.clicks),
    articles: articleStats,
    pages: Object.entries(pages).map(([path, data]) => ({
      path,
      title: pageTitles[path] || data.pageTitle || path,
      pv: data.pv,
      uv: data.visitors.size,
      avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
    })).sort((a, b) => b.pv - a.pv)
  };

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
