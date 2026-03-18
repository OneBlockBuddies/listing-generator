export default async function handler(req, res) {
  // Nur POST erlauben
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  // ⚠️ WICHTIG: Passwort aus Environment Variable lesen
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Passwort vergleichen
  if (password === correctPassword) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, error: 'Falsches Passwort' });
  }
}
