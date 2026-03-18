// /api/generate.js - Vercel Serverless Function
// API Key kommt aus Environment Variable - NIEMALS im Code!

export default async function handler(req, res) {
  // Nur POST erlaubt
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { manufacturer, model, condition, notes } = req.body;

  // Eingabevalidierung
  if (!manufacturer && !model) {
    return res.status(400).json({ 
      error: 'Missing data',
      message: 'Bitte mindestens Hersteller oder Modell eingeben!' 
    });
  }

  // 🔐 API Key aus Environment Variable (Vercel)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error('❌ OPENAI_API_KEY nicht konfiguriert!');
    return res.status(500).json({ 
      error: 'Configuration error',
      message: 'API Key nicht konfiguriert' 
    });
  }

  try {
    // Baue den Prompt
    const prompt = buildPrompt(manufacturer, model, condition, notes);

    // Rufe OpenAI API auf
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein Experte für B2B Industrieprodukte und erstellst professionelle, SEO-optimierte Produkttexte für Online-Marktplätze.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI Error:', errorData);
      return res.status(response.status).json({
        error: 'OpenAI API error',
        message: errorData.error?.message || 'Fehler bei der Textgenerierung'
      });
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    // Formatiere die Antwort
    const formatted = formatResponse(generatedText);

    return res.status(200).json(formatted);

  } catch (error) {
    console.error('Backend Error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
}

// Prompt-Builder
function buildPrompt(manufacturer, model, condition, notes) {
  return `
Erstelle einen professionellen B2B Produkttext für folgende Industriekomponente:

Hersteller: ${manufacturer || 'Unbekannt'}
Modell/Typ: ${model || 'Nicht angegeben'}
Zustand: ${condition || 'Nicht angegeben'}
Besonderheiten: ${notes || 'Keine'}

Generiere den Text in diesem EXAKTEN Format:

TITEL:
[Kurzer, SEO-optimierter Titel max. 80 Zeichen]

BESCHREIBUNG:
[2-3 Absätze, professionell, technisch korrekt, SEO-optimiert]

MARKTANALYSE:
[Marktsituation, Nachfrage, Besonderheiten]

PREIS:
[Geschätzter Startpreis in Euro, basierend auf Marktdaten]

Beachte: Professionell bleiben, Fachjargon nutzen, vertrauenswürdig wirken.
`;
}

// Response-Formatter
function formatResponse(text) {
  // Extrahiere Sections aus dem GPT-Response
  const titleMatch = text.match(/TITEL:\s*(.+?)(?:\n|$)/);
  const descMatch = text.match(/BESCHREIBUNG:\s*([\s\S]+?)(?=MARKTANALYSE:|$)/);
  const marketMatch = text.match(/MARKTANALYSE:\s*([\s\S]+?)(?=PREIS:|$)/);
  const priceMatch = text.match(/PREIS:\s*(.+?)(?:\n|$)/);

  return {
    title: titleMatch ? titleMatch[1].trim().substring(0, 80) : 'Industrieprodukt',
    description: descMatch ? descMatch[1].trim() : 'Hochwertige Industriekomponente',
    market_analysis: marketMatch ? marketMatch[1].trim() : 'Aktiver B2B Markt',
    price: priceMatch ? priceMatch[1].trim() : '200,00 EUR',
    raw_response: text // Debug-Info
  };
}
