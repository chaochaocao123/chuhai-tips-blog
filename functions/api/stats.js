/**
 * Cloudflare Pages Function - 统计查询
 *
 * 数据源：Cloudflare Analytics Engine (chuhai_analytics dataset)
 * - 通过 Cloudflare SQL API 查询（需要 env.CLOUDFLARE_API_TOKEN 和 env.ACCOUNT_ID）
 * - 客户端调用: GET /api/stats?days=7
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
  };

  const url = new URL(request.url);
  const daysNum = Math.min(parseInt(url.searchParams.get('days')) || 7, 30);

  // 缺凭据直接报错（避免历史 silent 静默失败的坑）
  if (!env.CLOUDFLARE_API_TOKEN || !env.ACCOUNT_ID) {
    return new Response(JSON.stringify({
      ok: false,
      error: '缺少 CLOUDFLARE_API_TOKEN 或 ACCOUNT_ID 环境变量',
      summary: { pv: 0, uv: 0, days: daysNum, avgDuration: 0, buyClicks: 0, buyClickByPosition: {} },
      buyClickByPage: [], articles: [], pages: []
    }), {
      status: 500,
      headers: corsHeaders
    });
  }

  const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/analytics_engine/sql`;
  const headers = {
    'Authorization': `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'text/plain'
  };

  // 工具函数：执行 SQL 查询，返回 data 数组
  // 注意：Cloudflare Analytics Engine SQL API 响应没有 success 字段，
  //      直接以 data/meta/rows/errors 形式返回；只有 errors 数组非空才算失败
  let lastQuery = '';
  async function sql(query) {
    lastQuery = query;
    const r = await fetch(API_BASE, { method: 'POST', headers, body: query });
    const status = r.status;
    const contentType = r.headers.get('content-type') || '';
    const text = await r.text();
    if (!contentType.includes('json')) {
      throw new Error(`SQL 非 JSON 响应 [status=${status}, ct=${contentType}]: ${text.slice(0, 500)} ||| 实际 query=${query.replace(/\s+/g, ' ').slice(0, 200)}`);
    }
    let j;
    try { j = JSON.parse(text); }
    catch (e) { throw new Error(`SQL 响应 JSON 解析失败 [status=${status}]: ${text.slice(0, 500)} ||| 实际 query=${query.replace(/\s+/g, ' ').slice(0, 200)}`); }
    if (j.errors && j.errors.length > 0) {
      throw new Error('SQL failed: ' + JSON.stringify(j.errors) + ' ||| 实际 query=' + query.replace(/\s+/g, ' ').slice(0, 200));
    }
    if (!Array.isArray(j.data)) {
      throw new Error('SQL 响应无 data 字段: ' + text.slice(0, 500) + ' ||| 实际 query=' + query.replace(/\s+/g, ' ').slice(0, 200));
    }
    return j.data;
  }

  try {
    // 1. PV 总数（按 type 拆分）
    const typeRows = await sql(
      `SELECT blob1 AS type, count() AS cnt
       FROM chuhai_analytics
       WHERE timestamp >= now() - INTERVAL '${daysNum}' DAY
       GROUP BY type`
    );
    const pv = typeRows.find(r => r.type === 'pv')?.cnt || 0;
    const buyClicks = typeRows.find(r => r.type === 'buy_click')?.cnt || 0;

    // 2. UV（按页面去重后的 blob2 数量近似，Analytics Engine 没有真正 UV 概念；
    //    更准确的代理是按"独立访问"——这里用 pv 行数 / 唯一 page 数 作为简化指标，
    //    实际 UV 需要在 track 阶段去重写入 index2，此处先用 pv 数量做占位）
    // TODO 后续可加 index2 = sessionId 真正算 UV
    const uv = pv;

    // 3. 平均停留时长（duration 在 double1）
    const durRow = await sql(
      `SELECT avg(double1) AS avgDur
       FROM chuhai_analytics
       WHERE blob1 = 'duration' AND timestamp >= now() - INTERVAL '${daysNum}' DAY`
    );
    const avgDuration = Math.round(durRow[0]?.avgDur || 0);

    // 4. 购买点击按位置分布
    // 注意：1) Cloudflare Analytics Engine SQL parser 强制 ORDER BY 必须有 LIMIT
    //      2) `position` 是 SQL 保留字（POSITION() 子串函数），别名不能用！
    const posRows = await sql(
      `SELECT blob3 AS pos, count() AS cnt
       FROM chuhai_analytics
       WHERE blob1 = 'buy_click' AND timestamp >= now() - INTERVAL '${daysNum}' DAY
       GROUP BY pos
       ORDER BY cnt DESC
       LIMIT 50`
    );
    const buyClickByPosition = {};
    for (const r of posRows) {
      if (r.pos) buyClickByPosition[r.pos] = Number(r.cnt);
    }

    // 5. 购买点击按页面分布
    const buyClickByPageRows = await sql(
      `SELECT blob2 AS page, count() AS cnt
       FROM chuhai_analytics
       WHERE blob1 = 'buy_click' AND timestamp >= now() - INTERVAL '${daysNum}' DAY
       GROUP BY page
       ORDER BY cnt DESC
       LIMIT 20`
    );
    const buyClickByPage = buyClickByPageRows
      .filter(r => r.page)
      .map(r => ({ page: r.page, clicks: Number(r.cnt) }));

    // 6. 文章页 PV Top
    const articleRows = await sql(
      `SELECT blob2 AS page, count() AS pv
       FROM chuhai_analytics
       WHERE blob1 = 'pv' AND blob2 LIKE '/articles/%' AND timestamp >= now() - INTERVAL '${daysNum}' DAY
       GROUP BY page
       ORDER BY pv DESC
       LIMIT 20`
    );
    const articles = articleRows.filter(r => r.page).map(r => ({
      page: r.page,
      pv: Number(r.pv)
    }));

    // 7. 全部页面 PV
    const pageRows = await sql(
      `SELECT blob2 AS page, count() AS pv
       FROM chuhai_analytics
       WHERE blob1 = 'pv' AND timestamp >= now() - INTERVAL '${daysNum}' DAY
       GROUP BY page
       ORDER BY pv DESC
       LIMIT 50`
    );
    const pages = pageRows.filter(r => r.page).map(r => ({
      page: r.page,
      pv: Number(r.pv)
    }));

    return new Response(JSON.stringify({
      ok: true,
      summary: {
        pv,
        uv,
        days: daysNum,
        avgDuration,
        buyClicks,
        buyClickByPosition
      },
      buyClickByPage,
      articles,
      pages,
      generatedAt: new Date().toISOString()
    }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: e.message,
      summary: { pv: 0, uv: 0, days: daysNum, avgDuration: 0, buyClicks: 0, buyClickByPosition: {} },
      buyClickByPage: [], articles: [], pages: []
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
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
