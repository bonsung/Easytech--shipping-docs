// Aliyun Function Compute (cn-hongkong): call-claude-vision-relay
// 역할: 브라우저(shippingdocs.easytech-teamwork.com)에서 직접 호출되는 접점.
//       Origin 검증만 하고, 실제 Anthropic 호출은 ap-southeast-1의
//       call-claude-vision-worker로 중계한다. 이 함수는 anthropic_api_key를
//       전혀 가지지 않는다 (Anthropic이 Greater China IP를 차단하기 때문에
//       실제 호출은 반드시 중국 밖 리전에서 수행되어야 함).

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

    const workerUrl = process.env.worker_url;
    const relaySecret = process.env.relay_secret;
    if (!workerUrl || !relaySecret) {
      console.error('worker_url or relay_secret env var not set');
      send(resp, 500, headers, { error: 'Relay not configured' });
      return;
    }

    let workerRes;
    try {
      workerRes = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-relay-secret': relaySecret,
        },
        body: JSON.stringify({ image, mediaType, prompt }),
      });
    } catch (e) {
      console.error('worker fetch failed', e);
      send(resp, 502, headers, { error: 'Vision worker unreachable' });
      return;
    }

    const workerData = await workerRes.json().catch(() => ({}));

    if (!workerRes.ok) {
      console.error('worker returned error', workerRes.status, workerData);
      send(resp, workerRes.status, headers, { error: workerData?.error || 'Vision API request failed' });
      return;
    }

    send(resp, 200, headers, { text: workerData?.text ?? '' });
  } catch (e) {
    console.error('call-claude-vision-relay error', e);
    send(resp, 500, headers, { error: 'Internal error' });
  }
};
