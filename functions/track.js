/**
 * Cloudflare Pages Function - 追踪 PV/UV/购买点击
 * 使用 Cloudflare Analytics Engine 写入数据（无需额外权限）
 *
 * 替代原 Netlify Functions track.js + Netlify Blobs
 * 客户端调用: POST /api/track
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const data = await request.json();
    const date = new Date().toISOString().split('T')[0];

    // 写入 Analytics Engine
    if (env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === 'function') {
      env.ANALYTICS.writeDataPoint({
        blobs: [
          data.type || 'unknown',        // pv / duration / buy_click
          data.page || '',               // 当前页面路径
          data.linkPosition || '',       // 购买链接位置
          data.buyLink || '',            // 购买链接
          data.linkText || '',           // 链接文字
          data.referrer || 'direct'      // 来源
        ],
        doubles: [
          data.duration || 0,            // 停留时长
          data.timestamp || Date.now()   // 事件时间
        ],
        indexes: [
          date                           // 日期（用于按天查询）
        ]
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: corsHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
}

export async function onRequestOptions() {
  return new Response('', {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, message: 'Use POST' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
