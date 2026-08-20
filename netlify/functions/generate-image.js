// Netlify serverless function - keeps the Gemini API key secret on the server side.
// The browser calls this function; this function calls Google's API using the
// secret key stored in Netlify's environment variables (never exposed to the client).

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed. Use POST.' })
    };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server is missing GEMINI_API_KEY. Add it in Netlify environment variables.' })
    };
  }

  let prompt;
  try {
    const body = JSON.parse(event.body);
    prompt = (body.prompt || '').trim();
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body.' }) };
  }

  if (!prompt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please provide a text prompt.' }) };
  }
  if (prompt.length > 800) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is too long. Keep it under 800 characters.' }) };
  }

  const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const message = (data && data.error && data.error.message) || 'The AI service returned an error.';
      return { statusCode: response.status, body: JSON.stringify({ error: message }) };
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData || p.inline_data);
    const inline = imagePart && (imagePart.inlineData || imagePart.inline_data);

    if (!inline || !inline.data) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'The AI did not return an image. Try rephrasing your prompt.' })
      };
    }

    const mimeType = inline.mimeType || inline.mime_type || 'image/png';

    return {
      statusCode: 200,
      body: JSON.stringify({
        image: `data:${mimeType};base64,${inline.data}`
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Could not reach the AI service. Please try again in a moment.' })
    };
  }
};