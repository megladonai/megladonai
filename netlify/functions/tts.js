// netlify/functions/tts.js
// Runs on Netlify's servers so the Inworld API key stays hidden from the browser.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const text = (payload.text || '').trim();
  const voiceId = payload.voiceId || 'Sarah';
  const modelId = payload.modelId || 'inworld-tts-2';
  const audioEncoding = payload.audioEncoding || 'MP3';
  let speakingRate = Number(payload.speakingRate) || 1.0;
  const deliveryMode = payload.deliveryMode || 'BALANCED';

  if (!text) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Text is required' }) };
  }
  if (text.length > 2000) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Text is too long. Please keep it under 2000 characters per request.' }),
    };
  }
  // Clamp to Inworld's supported speed range
  speakingRate = Math.min(1.5, Math.max(0.5, speakingRate));

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing INWORLD_API_KEY. Add it in Netlify > Site settings > Environment variables.' }),
    };
  }

  try {
    const apiResponse = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId,
        modelId,
        audioConfig: {
          audioEncoding,
          sampleRateHertz: 24000,
          speakingRate,
        },
        deliveryMode,
        applyTextNormalization: 'ON',
      }),
    });

    if (!apiResponse.ok) {
      if (apiResponse.status === 402) {
        return {
          statusCode: 402,
          body: JSON.stringify({ error: 'Credits khatam ho gaye hain. Please recharge your Inworld AI account at platform.inworld.ai.' }),
        };
      }
      if (apiResponse.status === 429) {
        return {
          statusCode: 429,
          body: JSON.stringify({ error: 'Bohot zyada requests aa rahi hain. Thori der ruk kar dobara try karein.' }),
        };
      }
      let errMsg = 'Speech generation failed';
      try {
        const errJson = await apiResponse.json();
        errMsg = errJson.message || (errJson.error && errJson.error.message) || JSON.stringify(errJson);
      } catch (e) {
        errMsg = await apiResponse.text();
      }
      return { statusCode: apiResponse.status, body: JSON.stringify({ error: errMsg }) };
    }

    const data = await apiResponse.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioContent: data.audioContent, encoding: audioEncoding }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unexpected server error' }) };
  }
};