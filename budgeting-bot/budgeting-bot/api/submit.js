const { google } = require('googleapis');
const { Readable } = require('stream');

const token = process.env.TELEGRAM_TOKEN;
const sheetId = process.env.SHEET_ID;
const folderId = process.env.FOLDER_ID;

function getAuth() {
  return new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  );
}

async function uploadToDrive(auth, base64Data, mimeType) {
  const drive = google.drive({ version: 'v3', auth });
  const buffer = Buffer.from(base64Data, 'base64');
  const filename = `struk_${Date.now()}.jpg`;

  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: 'id, webViewLink'
  });

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  return res.data.webViewLink;
}

async function saveToSheet(auth, data) {
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Sheet1!B:B'
  });

  const values = res.data.values || [];
  let emptyRow = values.length + 1;

  for (let i = 4; i < values.length; i++) {
    if (!values[i] || !values[i][0]) {
      emptyRow = i + 1;
      break;
    }
  }

  let existingCount = 0;
  for (let i = 4; i < emptyRow - 1; i++) {
    if (values[i] && values[i][0]) existingCount++;
  }
  const id = existingCount + 1;

  const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Sheet1!A${emptyRow}:H${emptyRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[id, timestamp, data.category, data.desc, data.amount, data.payment, 'Form Web', data.receiptLink]]
    }
  });

  return id;
}

async function sendTelegramMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { category, desc, amount, payment, chatId, receiptBase64, receiptMime } = req.body;

    if (!category || !desc || !amount || !payment) {
      return res.status(400).json({ success: false, error: 'Data tidak lengkap' });
    }

    const auth = getAuth();
    let receiptLink = '-';

    if (receiptBase64 && receiptMime) {
      receiptLink = await uploadToDrive(auth, receiptBase64, receiptMime);
    }

    const id = await saveToSheet(auth, { category, desc, amount, payment, receiptLink });

    if (chatId) {
      await sendTelegramMessage(
        chatId,
        `✅ Pengeluaran tercatat!\n\n` +
        `📂 Kategori: ${category}\n` +
        `📝 Keterangan: ${desc}\n` +
        `💰 Nominal: Rp${Number(amount).toLocaleString('id-ID')}\n` +
        `💳 Payment: ${payment}\n` +
        `🧾 Struk: ${receiptLink === '-' ? 'Tidak ada' : 'Tersimpan di Drive'}`
      );
    }

    res.status(200).json({ success: true, id });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
