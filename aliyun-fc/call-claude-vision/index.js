// Aliyun Function Compute: call-claude-vision
// 역할: 함수 환경변수 anthropic_api_key를 읽어
//       Anthropic Vision API(claude-sonnet-4-6)를 서버사이드에서 호출하고,
//       추출된 텍스트만 반환한다. API 키는 응답에 절대 포함하지 않는다.

const ALLOWED_ORIGIN = 'https://shippingdocs.easytech-teamwork.com';

function corsHeaders(origin) {
  const allow = origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : '';
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'Origin',
  };
}

function send(resp, status, headers, bodyObj) {
  resp.setStatusCode(status);
  for (const [k, v] of Object.entries(headers)) resp.setHeader(k, v);
  resp.setHeader('content-type', 'application/json');
  resp.send(JSON.stringify(bodyObj));
}

exports.handler = async function (req, resp, context) {
  const origin = req.headers['origin'] || null;
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    resp.setStatusCode(200);
    for (const [k, v] of Object.entries(headers)) resp.setHeader(k, v);
    resp.send('ok');
    return;
  }

  if (origin !== ALLOWED_ORIGIN) {
    send(resp, 403, headers, { error: 'Origin not allowed' });
    return;
  }

  if (req.method !== 'POST') {
    send(resp, 405, headers, { error: 'Method not allowed' });
    return;
  }

  try {
    const parsed = JSON.parse(req.body.toString());
    const { image, mediaType, prompt } = parsed;

    if (!image || !mediaType || !prompt) {
      send(resp, 400, headers, { error: 'image, mediaType, prompt는 필수입니다.' });
      return;
    }

    const apiKey = process.env.anthropic_api_key;
    if (!apiKey) {
      console.error('anthropic_api_key env var not set');
      send(resp, 500, headers, { error: 'API key not configured' });
      return;
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errTxt = await anthropicRes.text();
      console.error('Anthropic API error', anthropicRes.status, errTxt.slice(0, 300));
      send(resp, 502, headers, { error: 'Vision API request failed', debug_status: anthropicRes.status, debug_body: errTxt.slice(0, 300) });
      return;
    }

    const result = await anthropicRes.json();
    const text = result?.content?.[0]?.text ?? '';

    send(resp, 200, headers, { text });
  } catch (e) {
    console.error('call-claude-vision error', e);
    send(resp, 500, headers, { error: 'Internal error' });
  }
};
