/**
 * Netlify Function - 页面访问追踪
 * 接收追踪数据，存入 Netlify Blob Storage
 */

// 动态导入 KV 存储
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    
    if (!data.page || !data.sessionId || !data.visitorId) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const now = new Date();
    const dateKey = now.toISOString().split('T')[0];
    const timestamp = now.toISOString();

    const record = {
      page: data.page,
      sessionId: data.sessionId,
      visitorId: data.visitorId,
      timestamp,
      referrer: data.referrer || 'direct',
      type: data.type || 'pv',
      duration: data.duration || null,
      pageTitle: data.pageTitle || ''
    };

    if (data.type === 'buy_click') {
      record.buyLink = data.buyLink || '';
      record.linkText = data.linkText || '';
      record.linkPosition = data.linkPosition || '';
    }

    const store = await getKvStore();
    if (store) {
      const dailyKey = `analytics:${dateKey}`;
      let dailyData = await store.get(dailyKey, { type: 'json' }) || [];
      dailyData.push(record);
      await store.set(dailyKey, dailyData, { metadata: { expiry: 90 * 24 * 60 * 60 } });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };

  } catch (error) {
    console.error('Tracking error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
