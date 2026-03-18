export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { manufacturer, model_or_type, condition, notes } = req.body;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API Key not configured' });
  }

  try {
    const prompt = `Du bist ein B2B-Verkautstext-Experte für Industrieprodukte.

Erstelle einen professionellen Produkttext für:
- Hersteller: ${manufacturer}
- Modell/Typ: ${model_or_type}
- Zustand: ${condition || 'Unbekannt'}
- Besonderheiten: ${notes || 'Keine angegeben'}

Gib die Antwort als JSON mit genau diesen Feldern zurück:
{
  "title": "Kurzer prägnanter Titel (max 80 Zeichen)",
  "description": "Detaillierte Produktbeschreibung (2-3 Absätze, professionell, verkaufsfördernd)",
  "market": "Marktanalyse: Verfügbarkeit, Nachfrage, typische Käufer",
  "price": "Empfohlener Startpreis basierend auf Marktforschung (z.B. '450 Euro' oder '1200-1500 Euro')"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('OpenAI Error:', error);
      return res.status(response.status).json({ 
        error: error.error?.message || 'OpenAI API error' 
      });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Parse JSON aus der OpenAI-Response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'Invalid response format from OpenAI' });
    }

    const result = JSON.parse(jsonMatch[0]);

    return res.status(200).json({
      title: result.title,
      description: result.description,
      market: result.market,
      price: result.price
    });

  } catch (error) {
    console.error('Server Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
