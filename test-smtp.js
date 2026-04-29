// Skrip test sederhana untuk memverifikasi koneksi SMTP Gmail
// Langsung hardcode env vars dari file .env (tanpa dotenv module)
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Parse .env file manually
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (!line || line.startsWith('#')) return;
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) return;
  const key = line.substring(0, eqIndex).trim();
  let value = line.substring(eqIndex + 1).trim();
  // Remove surrounding quotes
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  envVars[key] = value;
});

const smtpUser = envVars.SMTP_USER;
const smtpPass = envVars.SMTP_PASS;

console.log('=== SMTP Connection Test ===');
console.log('SMTP_USER:', smtpUser || '(KOSONG!)');
console.log('SMTP_PASS:', smtpPass ? `${smtpPass.substring(0,4)}****${smtpPass.substring(smtpPass.length-4)} (${smtpPass.length} chars)` : '(KOSONG!)');
console.log('');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

console.log('Mencoba verifikasi koneksi ke Gmail SMTP...');
transporter.verify()
  .then(() => {
    console.log('✅ SUKSES! Koneksi SMTP berhasil. App Password Anda valid.');
  })
  .catch((err) => {
    console.log('❌ GAGAL:', err.message);
    console.log('');
    if (err.message.includes('BadCredentials') || err.message.includes('Username and Password')) {
      console.log('=== DIAGNOSIS ===');
      console.log('App Password TIDAK VALID atau sudah expired.');
      console.log('');
      console.log('Solusi:');
      console.log('1. Buka: https://myaccount.google.com/apppasswords');
      console.log('2. Hapus App Password lama jika ada');
      console.log('3. Buat App Password BARU');
      console.log('4. Copy 16 huruf TANPA spasi ke SMTP_PASS di file .env');
      console.log('5. Jalankan ulang: node test-smtp.js');
    }
  });
