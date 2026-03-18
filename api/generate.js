export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { manufacturer, model, condition, notes, openaiKey } = req.body;

  if (!openaiKey) {
    return res.status(400).json({ error: 'API Key erforderlich' });
  }

  const prompt = `Du bist ein B2B Produkttext-Experte für Industrieware.

ARTIKEL:
- Hersteller: ${manufacturer}
- Modell: ${model}
- Zustand: ${condition}
- Besonderheiten: ${notes}

DEINE AUFGABEN:

1️⃣ TITEL (max. 80 Zeichen):
- Prägnant, mit Hersteller + Modell
- Zustand deutlich machen wenn GEBRAUCHT

2️⃣ BESCHREIBUNG (2-3 Sätze):
- Was ist das Produkt?
- Welche Funktion/Nutzen?
- Zustand und Besonderheiten

3️⃣ MARKTANALYSE & PREISEMPFEHLUNG:
Schreibe KONKRETE Zahlen zu:
- Neupreis aus bekannten Quellen (wenn nicht bekannt: "nicht verfügbar")
- Aktuelle eBay-Angebote: Preisspanne und wie viele Artikel
- eBay verkauft (letzte 30-60 Tage): Durchschnittspreis VERKAUFTER Artikel
- STARTPREIS: Realistisch basierend auf eBay-Verkäufen

REALISTISCHES PREISMODELL:
📌 Neuware: 50-70% vom Neupreis (Marktkonkurrenz)
📌 Gut erhalten: 35-50% vom Neupreis
📌 Gebraucht Standard: 20-40% vom Neupreis
📌 Alte/Nischige Produkte: Nur nach echten eBay-Verkäufen orientieren

⚠️ WICHTIGSTE REGEL:
Wenn eBay-Verkaufshistorie zeigt, dass ÄHNLICHE ARTIKEL durchschnittlich €45 kosten:
→ Setze NICHT €120 an
→ Setze ~€45-55 an (leicht über Durchschnitt für schnellen Verkauf)
→ Realism ist wichtiger als Wunschdenken!

FORMAT (EXAKT):
TITEL: [Dein Titel hier]
BESCHREIBUNG: [2-3 Sätze]
MARKTANALYSE: [Neupreis / eBay Angebote / eBay Verkaufshistorie / Empfehlung]
PREIS: [€XXX]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(400).json({ error: error.error?.message || 'OpenAI Error' });
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    res.status(200).json(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
