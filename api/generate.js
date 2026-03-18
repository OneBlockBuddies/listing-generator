// api/generate.js
import { Anthropic } from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // Nur POST erlaubt
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { manufacturer, model_or_type, condition, notes } = req.body;

    if (!manufacturer && !model_or_type) {
      return res.status(400).json({
        error: "Hersteller oder Modell erforderlich",
      });
    }

    // Prompt für Claude
    const prompt = `Du bist ein B2B E-Commerce Experte für Industrieprodukte.
Generiere EXAKT 4 Felder als JSON:

Input:
- Hersteller: ${manufacturer || "N/A"}
- Modell/Typ: ${model_or_type || "N/A"}
- Zustand: ${condition || "Nicht angegeben"}
- Notizen: ${notes || "Keine"}

Antworte NUR mit diesem JSON-Format (kein zusätzlicher Text):
{
  "title": "Prägnanter Titel max 80 Zeichen",
  "description": "Ausführliche Produktbeschreibung (3-5 Sätze)",
  "market": "Marktanalyse und Preisempfehlung (2-3 Sätze)",
  "price": "Empfohlener Startpreis z.B. '899€' oder '150€'"
}`;

    // Rufe Claude auf
    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Parse die Response
    const content = message.content[0].text.trim();

    // Extrahiere JSON (falls Claude Text drumherum macht)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Keine gültige JSON in Response");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validiere die Felder
    if (!result.title || !result.description || !result.market || !result.price) {
      throw new Error("Fehlende Felder in der Response");
    }

    return res.status(200).json({
      title: result.title,
      description: result.description,
      market: result.market,
      price: result.price,
    });
  } catch (error) {
    console.error("Generate API Error:", error);

    return res.status(500).json({
      error: error.message || "API Fehler bei der Generierung",
    });
  }
}
