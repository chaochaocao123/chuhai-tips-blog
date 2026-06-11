/**
 * Cloudflare Pages Function - 追踪 PV/UV/购买点击
 * 使用 Cloudflare Analytics Engine 写入数据（无需额外权限）
 *
 * 替代原 Netlify Functions track.js + Netlify Blobs
 * 客户端调用: POST /api/track
 *
 * 数据点结构:
 *   blobs[0..6]: type, page, linkPosition, buyLink, linkText, referrer, date
 *   doubles[0..1]: duration, eventTimestamp
 *   indexes[0]: visitorId (用于 uniq 算 UV；Analytics Engine 限制 indexes 只能 1 个，
 *                所以 date 移到 blob7，按天过滤走 timestamp 列)
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
    // visitorId 是 UV 去重依据；如果客户端没传，用 sessionId 兜底（避免 index1 为空）
    const visitorId = data.visitorId || data.sessionId || 'anonymous';

    // 写入 Analytics Engine
    if (env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === 'function') {
      env.ANALYTICS.writeDataPoint({
        blobs: [
          data.type || 'unknown',        // blob1: pv / duration / buy_click
          data.page || '',               // blob2: 当前页面路径
          data.linkPosition || '',       // blob3: 购买链接位置
          data.buyLink || '',            // blob4: 购买链接
          data.linkText || '',           // blob5: 链接文字
          data.referrer || 'direct',     // blob6: 来源
          date                           // blob7: 日期 YYYY-MM-DD（备用）
        ],
        doubles: [
          data.duration || 0,            // double1: 停留时长
          data.timestamp || Date.now()   // double2: 事件时间
        ],
        indexes: [
          visitorId                      // index1: 访客 ID（用于 uniq 算 UV）
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
