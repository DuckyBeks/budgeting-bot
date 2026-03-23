export default async function handler(req, res) {
  const token = process.env.TELEGRAM_TOKEN;
  const webappUrl = process.env.WEBAPP_URL;

  const url = `https://api.telegram.org/bot${token}/setWebhook?url=${webappUrl}/api/webhook&drop_pending_updates=true`;
  const response = await fetch(url);
  const data = await response.json();

  res.status(200).json(data);
}
