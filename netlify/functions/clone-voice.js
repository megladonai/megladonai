// netlify/functions/clone-voice.js
// Sends a short audio sample to Inworld AI to create a custom cloned voice.

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

  const displayName = (payload.displayName || '').trim();
  const langCode = payload.langCode || 'en';
  const audioBase64 = payload.audioBase64;

  if (!displayName) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Voice name is required' }) };
  }
  if (!audioBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'An audio sample is required' }) };
  }

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing INWORLD_API_KEY. Add it in Netlify > Site settings > Environment variables.' }),
    };
  }

  try {
    const apiResponse = await fetch('https://api.inworld.ai/voices/v1/voices:clone', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayName,
        langCode,
        voiceSamples: [audioBase64],
      }),
    });

    if (!apiResponse.ok) {
      if (apiResponse.status === 402) {
        return {
          statusCode: 402,
          body: JSON.stringify({ error: 'Credits khatam ho gaye hain. Please recharge your Inworld AI account.' }),
        };
      }
      let errMsg = 'Voice cloning failed';
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
      body: JSON.stringify({ voiceId: data.voiceId || data.id || displayName }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unexpected server error' }) };
  }
};