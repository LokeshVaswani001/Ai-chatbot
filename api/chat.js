export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        ...messages
      ],
      max_tokens: 700,
      temperature: 0.7
    })
  });

  const data = await response.json();
  const reply = data.choices[0].message.content.trim();
  res.status(200).json({ reply });
}