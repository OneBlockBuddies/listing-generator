export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Nur POST erlaubt' } });
  }

  const { manufacturer, model_or_type, condition, notes } = req.body;

  if (!manufacturer || !model_or_type) {
    return res.status(400).json({
      error: { message: 'Hersteller UND Modell erforderlich' }
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: 'API-Key nicht konfiguriert' }
    });
  }

  try {
    // 🔍 STEP 1: Technische Daten aus Internet recherchieren
    const researchPrompt = `Du bist ein Industrieprodukt-Experte. 
Recherchiere die EXAKTEN technischen Spezifikationen für:
Hersteller: ${manufacturer}
Modell/Artikelnummer: ${model_or_type}

Gib NUR die technischen Daten zurück, die du SICHER kennst (kein Erfinden!):
- Stromversorgung
- Abmessungen
- Gewicht
- Zertifizierungen
- Betriebstemperatur
- Lagernummer/EAN (falls bekannt)
- Lieferumfang
- Verwendungszweck

Format: Kurze, prägnante Zeilen ohne Nummern.`;

    const researchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: researchPrompt }],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    let technicalSpecs = '';
    if (researchResponse.ok) {
      const researchData = await researchResponse.json();
      technicalSpecs = researchData.choices[0].message.content;
    }

    // 🔍 STEP 2: Marktpreis & Nachfrage recherchieren
    const marketPrompt = `Du kennst Industrieprodukte-Märkte.
${manufacturer} ${model_or_type}

Schätze realistisch (basierend auf Kategorie + Zustand):
1. Typischer Marktpreis (NEU)
2. Aktueller Marktpreis (${condition})
3. Nachfrage (hoch/mittel/niedrig)
4. Verkaufte Stückzahl pro Monat (Schätzung)

Format JSON:
{
  "new_price": "150€",
  "current_price": "95€",
  "demand": "Hoch",
  "monthly_sales": "12-18 Stück"
}`;

    const marketResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: marketPrompt }],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    let marketData = { new_price: '200€', current_price: '110€', demand: 'Aktiv', monthly_sales: 'Mehrere' };
    if (marketResponse.ok) {
      const mData = await marketResponse.json();
      const content = mData.choices[0].message.content;
      try {
        marketData = JSON.parse(content);
      } catch (e) {
        console.log('Market parse failed, using defaults');
      }
    }

    // 🔍 STEP 3: EBAY TEXT GENERIEREN mit echten Daten
    const textPrompt = `Du schreibst professionelle eBay-Industrieprodukt-Beschreibungen.

PRODUKT: ${manufacturer} ${model_or_type}
ZUSTAND: ${condition}
TECHNISCHE DATEN:\n${technicalSpecs}
NUTZER-NOTIZEN: ${notes || 'keine'}

Generiere VALIDES JSON (kein Markdown!):
{
  "title": "Kurzer prägnanter Titel (max 80 Zeichen)",
  "description": "Sie bieten hier auf 1× ${model_or_type}...\\n\\nDer Artikel ist ${condition}...\\n\\nTechnische Daten:\\n${technicalSpecs}\\n\\n... (Rest der Beschreibung)",
  "market_analysis": "Nachfrage: ${marketData.demand}\\nMonatliche Verkäufe: ${marketData.monthly_sales}\\nPreisklasse: ${marketData.current_price} - ${marketData.new_price}",
  "price": "${marketData.current_price}"
}`;

    const textResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: textPrompt }],
        temperature: 0.4,
        max_tokens: 2000
      })
    });

    if (!textResponse.ok) {
      const error = await textResponse.json();
      throw new Error(error.error?.message || 'Text generation failed');
    }

    const textData = await textResponse.json();
    let result = JSON.parse(
      textData.choices[0].message.content
        .replace(/```json\s?/g, '')
        .replace(/```\s?/g, '')
    );

    // Validierung
    if (!result.title || !result.description || !result.market_analysis || !result.price) {
      throw new Error('Unvollständige Antwort von API');
    }

    return res.status(200).json({
      title: result.title,
      description: result.description,
      market: result.market_analysis,
      price: result.price
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: { message: error.message || 'Unbekannter Fehler' }
    });
  }
}
