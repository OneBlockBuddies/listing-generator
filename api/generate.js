export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Nur POST erlaubt' } });
  }

  const { manufacturer, model_or_type, condition, notes } = req.body;

  if (!manufacturer && !model_or_type) {
    return res.status(400).json({
      error: { message: 'Hersteller oder Modell erforderlich' }
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'API-Key nicht konfiguriert' }
    });
  }

  try {
    const prompt = `Du bist B2B Industrieprodukt-Experte für eBay-Listings.

PRODUKT: ${manufacturer} ${model_or_type}
Zustand: ${condition}
Technische Daten/Notizen: ${notes}

Generiere JSON mit EXAKT diesen Keys:

{
  "title": "Prägnanter Titel (max 80 Zeichen)",
  "description": "VOLLSTÄNDIGE eBay-Beschreibung, die die technischen Daten aus den Notizen EINGEBAUT enthält (nicht als separater Block, sondern fließend im Text integriert). Mind. 200 Wörter.",
  "market": "Marktanalyse: Nachfrage, Vergleichspreise, Verkaufsgeschwindigkeit",
  "price": "Startpreis in Euro (z.B. '110 Euro')"
}

Nur valides JSON!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API Fehler');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    let result = JSON.parse(content.replace(/```json\s?/g, '').replace(/```\s?/g, ''));

    if (!result.title || !result.description || !result.market || !result.price) {
      throw new Error('Unvollständige API-Antwort');
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: { message: error.message || 'Unbekannter Fehler' }
    });
  }
}
