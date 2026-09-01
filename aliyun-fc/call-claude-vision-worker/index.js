// Aliyun Function Compute (ap-southeast-1): call-claude-vision-worker
// 역할: call-claude-vision-relay(홍콩)에서만 호출되는 내부 워커.
//       함수 환경변수 anthropic_api_key로 Anthropic Vision API를 호출하고
//       추출된 텍스트만 반환한다. relay_secret 헤더가 없으면 거부한다.
//       브라우저에서 직접 호출되지 않으므로 CORS 처리는 하지 않는다.

function send(resp, status, bodyObj) {
  resp.setStatusCode(status);
  resp.setHeader('content-type', 'application/json');
  resp.send(JSON.stringify(bodyObj));
}

exports.handler = async function (req, resp, context) {
  if (req.method !== 'POST') {
    send(resp, 405, { error: 'Method not allowed' });
    return;
  }

  const secret = req.headers['x-relay-secret'];
  if (!secret || secret !== process.env.relay_secret) {
    send(resp, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const parsed = JSON.parse(req.body.toString());
    const { image, mediaType, prompt } = parsed;

    if (!image || !mediaType || !prompt) {
      send(resp, 400, { error: 'image, mediaType, prompt는 필수입니다.' });
      return;
    }

    const apiKey = process.env.anthropic_api_key;
    if (!apiKey) {
      console.error('anthropic_api_key env var not set');
      send(resp, 500, { error: 'API key not configured' });
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
      send(resp, 502, { error: 'Vision API request failed' });
      return;
    }

    const result = await anthropicRes.json();
    const text = result?.content?.[0]?.text ?? '';

    send(resp, 200, { text });
  } catch (e) {
    console.error('call-claude-vision-worker error', e);
    send(resp, 500, { error: 'Internal error' });
  }
};
