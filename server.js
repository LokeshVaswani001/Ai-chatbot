import dotenv from 'dotenv';
dotenv.config();
import http  from 'http';
import https from 'https';
import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ══════════════════════════════════════════════════════
//  🔑 PASTE YOUR GROQ API KEY HERE
//  Get it free from: https://console.groq.com
// ══════════════════════════════════════════════════════
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const PORT = process.env.PORT || 3000;

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
};

// ══════════════════════════════════════════════════════
//  HTTP SERVER
// ══════════════════════════════════════════════════════
const server = http.createServer((req, res) => {

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ══════════════════════════════════════════════════
  //  ROUTE: POST /api/chat
  //  Feature 2: Send to Gemini API
  // ══════════════════════════════════════════════════
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';

    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {

      // Feature 4: Error — invalid JSON
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request format.' }));
        return;
      }

      const messages = parsed.messages;

      // Feature 4: Error — missing messages
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No messages provided.' }));
        return;
      }

      // Feature 4: Error — API key not set
      if (GROQ_API_KEY === 'PASTE_YOUR_KEY_HERE' || GROQ_API_KEY.trim() === '') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Groq API key not set! Open server.js and paste your key in GROQ_API_KEY.'
        }));
        return;
      }

      // Feature 2: Build Groq API request body (OpenAI-compatible format)
      const requestBody = JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    [
          { role: 'system', content: 'You are a helpful and friendly AI assistant. Give clear and concise answers.' },
          ...messages
        ],
        max_tokens:  700,
        temperature: 0.7,
      });

      const options = {
        hostname: 'api.groq.com',
        path:     '/openai/v1/chat/completions',
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Authorization':  `Bearer ${GROQ_API_KEY}`,
          'Content-Length': Buffer.byteLength(requestBody),
        },
      };

      // Feature 2: Make API call to Groq
      const apiReq = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          try {
            const json = JSON.parse(data);

            // Feature 4: Handle Groq error response
            if (json.error) {
              res.writeHead(apiRes.statusCode, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: json.error.message }));
              return;
            }

            // Feature 3: Extract reply and send to frontend
            const reply = json.choices[0].message.content.trim();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reply }));

          } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to read Groq response. Check your API key.' }));
          }
        });
      });

      // Feature 4: Network error
      apiReq.on('error', () => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cannot reach Groq API. Check your internet connection.' }));
      });

      apiReq.write(requestBody);
      apiReq.end();
    });

    return;
  }

  // ══════════════════════════════════════════════════
  //  ROUTE: GET static files (index.html, css, js)
  // ══════════════════════════════════════════════════
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);

  const ext      = path.extname(filePath);
  const mimeType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - File not found');
    } else {
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(content);
    }
  });

});

// ══════════════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════════════
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║       AI Chatbot — Running! ✅        ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐  Browser mein kholo: http://localhost:${PORT}`);
  console.log('');

  if (GROQ_API_KEY === 'PASTE_YOUR_KEY_HERE') {
    console.log('  ⚠️  WARNING: Groq API key set nahi hai!');
    console.log('  📋  server.js mein GROQ_API_KEY mein apni key daalo.');
    console.log('  🔗  Key yahan se lo: https://console.groq.com');
  } else {
    console.log('  🔑  API Key: Set ✅');
    console.log('  🤖  Powered by: Groq — LLaMA 3 (FREE)');
  }
  console.log('');
});