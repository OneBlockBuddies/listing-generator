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
    // 🔍 STEP 1: Technische Daten AUS DEM INTERNET recherchieren
    const researchPrompt = `Du bist ein Industrie-Datenbank Experte mit Zugriff auf alle technischen Spezifikationen.

PRODUKT: ${manufacturer} ${model_or_type}

Recherchiere die EXAKTEN technischen Spezifikationen aus deinem Wissen:
- Stromversorgung (Volt, Ampere, Watt)
- Abmessungen (B×H×T in mm)
- Gewicht (kg)
- Zertifizierungen (CE, FCC, etc.)
- Betriebstemperatur (°C)
- IP-Schutzklasse
- Material
- Gewährleistung/Support
- Lagernummer oder EAN (falls bekannt)
- Verwendungszweck

WICHTIG: Gib NUR Daten zurück die du SICHER kennst - nicht erfinden!
Format: Saubere Zeilen ohne Nummern, bereit zum Kopieren in eine eBay-Beschreibung.`;

    const researchResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: researchPrompt }],
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    let technicalSpecs = 'Technische Daten verfügbar';
    if (researchResponse.ok) {
      const researchData = await researchResponse.json();
      technicalSpecs = researchData.choices[0].message.content || 'Technische Daten verfügbar';
    }

    // 🔍 STEP 2: Marktpreis & Nachfrage recherchieren
    const marketPrompt = `Du kennst den B2B-Industriemarkt sehr gut.

PRODUKT: ${manufacturer} ${model_or_type}
ZUSTAND: ${condition}

Schätze REALISTISCH (basierend auf Kategorie, Hersteller, Zustand):

1. Typischer Neupreis
2. Aktueller Marktpreis im ${condition}-Zustand
3. Nachfrage-Level (Sehr Hoch / Hoch / Mittel / Niedrig)
4. Geschätzte monatliche Verkäufe

Antworte EXAKT in diesem JSON-Format (nichts anderes!):
{
  "new_price": "450€",
  "current_price": "280€",
  "demand": "Hoch",
  "monthly_sales": "15-25 Stück/Monat",
  "market_notes": "Beliebtes Industrieprodukt, stabile Nachfrage"
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
        temperature: 0.2,
        max_tokens: 400
      })
    });

    let marketData = {
      new_price: '200€',
      current_price: '120€',
      demand: 'Mittel',
      monthly_sales: 'Mehrere Stück',
      market_notes: 'Standard-Nachfrage'
    };

    if (marketResponse.ok) {
      const mData = await marketResponse.json();
      const content = mData.choices[0].message.content;
      try {
        marketData = JSON.parse(content.replace(/```json\s?/g, '').replace(/```\s?/g, ''));
      } catch (e) {
        console.log('Market parse warning, using defaults');
      }
    }

    // 🔍 STEP 3: EBAY TEXT GENERIEREN mit ECHTEN Daten
    const textPrompt = `Du schreibst professionelle, prägnante eBay-Industrieprodukt-Beschreibungen.

PRODUKT: ${manufacturer} ${model_or_type}
ZUSTAND: ${condition}
NUTZER-NOTIZEN: ${notes || 'Keine zusätzlichen Notizen'}

TECHNISCHE DATEN ZUM EINFÜGEN:
${technicalSpecs}

Generiere VALIDES JSON (kein Markdown, kein Code-Block!):

{
  "title": "PRÄGNANTER TITEL MAXIMAL 80 ZEICHEN",
  "description": "Sie bieten hier auf 1x ${model_or_type}...\\n\\nZustand: ${condition}\\n\\nTechnische Daten:\\n${technicalSpecs}\\n\\n[Weitere Produktbeschreibung]",
  "market_analysis": "Nachfrage: ${marketData.demand}\\nMonatliche Verkäufe: ${marketData.monthly_sales}\\nPreisklasse: ${marketData.current_price} - ${marketData.new_price}\\n${marketData.market_notes}",
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
        temperature: 0.5,
        max_tokens: 2500
      })
    });

    if (!textResponse.ok) {
      throw new Error('Text generation failed');
    }

    const textData = await textResponse.json();
    let result = JSON.parse(
      textData.choices[0].message.content
        .replace(/```json\s?/g, '')
        .replace(/```\s?/g, '')
    );

    // Validierung
    if (!result.title || !result.description || !result.market_analysis || !result.price) {
      throw new Error('API gab unvollständige Antwort');
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
