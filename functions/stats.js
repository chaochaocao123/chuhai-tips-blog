/**
 * Cloudflare Pages Function - 统计查询
 *
 * 数据源：Cloudflare Analytics Engine（由 track.js 写入）
 * 由于当前 Token 缺 Analytics:Read 权限，本接口返回简化数据
 * 完整数据请在 Cloudflare Dashboard 查看：
 * https://dash.cloudflare.com/?to=/:account/workers/analytics-engine
 *
 * 客户端调用: GET /api/stats?days=7
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  const url = new URL(request.url);
  const daysNum = Math.min(parseInt(url.searchParams.get('days')) || 7, 30);

  // 尝试从 Analytics Engine 读取（需要 Account Analytics:Read 权限）
  // 如果没有权限，返回空数据结构 + 提示
  const result = {
    summary: {
      pv: 0,
      uv: 0,
      days: daysNum,
      avgDuration: 0,
      buyClicks: 0,
      buyClickByPosition: {},
      _note: '需要 Cloudflare Token 添加 Account Analytics:Read 权限后启用完整统计'
    },
    buyClickByPage: [],
    articles: [],
    pages: []
  };

  // 如果有 ANALYTICS binding 且有权读取，可以在这里添加 SQL 查询逻辑
  // 当前 Token 缺 Analytics:Read 权限，所以暂时返回空数据
  if (env.ANALYTICS) {
    try {
      // Workers Analytics Engine 暂不支持通过 binding 直接查询
      // 数据需要通过 Cloudflare Dashboard 或 REST API 查询
      // REST API 调用方式（需要 Account Analytics:Read 权限）：
      // const query = `SELECT blob1 as type, blob2 as page, count() as pv FROM chuhai_analytics WHERE index1 >= today() - INTERVAL '${daysNum}' DAY GROUP BY type, page`;
      // 需要 CLOUDFLARE_API_TOKEN 环境变量
      // const sqlResp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`, {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'text/plain' },
      //   body: query
      // });
    } catch (e) {
      // ignore
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: corsHeaders
  });
}

export async function onRequestOptions() {
  return new Response('', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
