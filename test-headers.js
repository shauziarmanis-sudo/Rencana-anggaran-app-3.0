const fs = require('fs');
const { google } = require('googleapis');

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].replace(/^"(.*)"$/, '$1') : undefined;
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: getEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    private_key: getEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const client = google.sheets({ version: 'v4', auth });
const id = getEnv('GOOGLE_SHEET_ID');

Promise.all([
  client.spreadsheets.values.get({ spreadsheetId: id, range: `'RAW - PI'!1:1` }),
  client.spreadsheets.values.get({ spreadsheetId: id, range: `'RAW - PS'!1:1` }),
  client.spreadsheets.values.get({ spreadsheetId: id, range: `'Laporan Pembelian Barang'!1:1` }).catch(() => ({ data: { values: [[]]} }))
]).then(([pi, ps, lpb]) => {
  console.log('PI:', pi.data.values[0].join(' | '));
  console.log('PS:', ps.data.values[0].join(' | '));
  console.log('LPB:', lpb.data.values[0].join(' | '));
}).catch(console.error);
