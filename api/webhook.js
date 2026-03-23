const token = process.env.TELEGRAM_TOKEN;
const webappUrl = process.env.WEBAPP_URL;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function sendMessageWithButton(chatId, text, btnLabel, btnUrl) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: [[{ text: btnLabel, url: btnUrl }]] }
    })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { message } = req.body;
    if (message) {
      const chatId = message.chat.id;
      const text = (message.text || '').trim().toLowerCase();

      if (text === '/add' || text === '/start') {
        const formUrl = `${webappUrl}/form.html?chatId=${chatId}`;
        await sendMessageWithButton(
          chatId,
          '📝 Klik tombol di bawah untuk membuka form catat pengeluaran:',
          '📋 Buka Form',
          formUrl
        );
      } else {
        await sendMessage(chatId, 'Ketik /add untuk mulai mencatat pengeluaran.');
      }
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  res.status(200).send('OK');
}
