// netlify/functions/voices.js
// Fetches the list of available Inworld TTS voices (characters) so the
// frontend dropdown always reflects what's actually available on the account.

exports.handler = async function () {
  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing INWORLD_API_KEY. Add it in Netlify > Site settings > Environment variables.' }),
    };
  }

  try {
    const res = await fetch('https://api.inworld.ai/tts/v1/voices', {
      headers: { Authorization: `Basic ${apiKey}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      return { statusCode: res.status, body: JSON.stringify({ error: txt || 'Failed to fetch voices' }) };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // voices don't change often, cache for an hour
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unexpected server error' }) };
  }
};