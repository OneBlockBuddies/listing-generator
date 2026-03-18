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
    const prompt = `Du schreibst eBay-Beschreibungen für Industrieprodukte. 

PRODUKT: ${manufacturer} ${model_or_type}
Zustand: ${condition}
Technische Daten (aus Notizen):
${notes}

AUFGABE: Schreibe JSON mit diesen Keys:

{
  "title": "SNP-X129 Netzteil 24V 5A",
  "description": "Sie bieten hier auf 1× ${model_or_type}.\n\nDer Artikel ist ${condition}.\nDer aktuelle Marktpreis liegt bei ca. 110 €.\n\nTechnische Daten\n${notes}\n\nHinweis für Fachanwender\nDer Einbau und Betrieb erfordern Fachkenntnisse...",
  "market": "Marktanalyse...",
  "price": "110 Euro"
}

WICHTIG:
- Beschreibung beginnt mit "Sie bieten hier auf 1× ${model_or_type}."
- DANACH kommen ALLE technischen Daten aus den Notizen (unverändert!)
- Dann die Standard-Hinweise
- Technische Daten NICHT umschreiben, KOPIEREN!
- Nur valides JSON!`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
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
