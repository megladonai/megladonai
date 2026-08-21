// netlify/functions/generate.js
// This runs on Netlify's servers (NOT in the browser), so the API key stays hidden.

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let prompt;
  try {
    const body = JSON.parse(event.body || '{}');
    prompt = (body.prompt || '').trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
  }

  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing STABILITY_API_KEY. Add it in Netlify > Site settings > Environment variables.' }),
    };
  }

  try {
    const form = new FormData();
    form.append('prompt', prompt);
    form.append('output_format', 'png');
    form.append('aspect_ratio', '1:1');

    const apiResponse = await fetch(
      'https://api.stability.ai/v2beta/stable-image/generate/core',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'image/*',
        },
        body: form,
      }
    );

    if (!apiResponse.ok) {
      // Friendly, specific messages for the common failure cases
      if (apiResponse.status === 402) {
        return {
          statusCode: 402,
          body: JSON.stringify({
            error: 'Credits khatam ho gaye hain. Please recharge your Stability AI account at platform.stability.ai to keep generating images.',
          }),
        };
      }
      if (apiResponse.status === 429) {
        return {
          statusCode: 429,
          body: JSON.stringify({
            error: 'Bohot zyada requests aa rahi hain. Thori der ruk kar dobara try karein.',
          }),
        };
      }

      let errMsg = 'Image generation failed';
      try {
        const errJson = await apiResponse.json();
        errMsg = errJson.errors ? errJson.errors.join(', ') : (errJson.message || errMsg);
      } catch (e) {
        errMsg = await apiResponse.text();
      }
      return { statusCode: apiResponse.status, body: JSON.stringify({ error: errMsg }) };
    }

    const arrayBuffer = await apiResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: `data:image/png;base64,${base64}` }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Unexpected server error' }) };
  }
};