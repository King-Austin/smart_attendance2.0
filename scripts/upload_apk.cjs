const https = require('https');
const fs = require('fs');
const path = require('path');

let url = 'jtezcxkjjrrzqakrfukf.supabase.co';
let serviceKey = '';

try {
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (key === 'SUPABASE_SERVICE_ROLE_KEY') serviceKey = val;
    }
  }
} catch (e) {
  console.error('Error loading .env file:', e.message);
}

if (!serviceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required in .env');
  process.exit(1);
}

const apkPath = path.resolve(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');
if (!fs.existsSync(apkPath)) {
  console.error('❌ APK not found at:', apkPath);
  console.log('Run `npm run build:apk` or `gradlew assembleDebug` first.');
  process.exit(1);
}

const fileBuffer = fs.readFileSync(apkPath);
const fileSizeMB = (fileBuffer.length / (1024 * 1024)).toFixed(2);
console.log(`🚀 Uploading ${fileSizeMB} MB APK to Supabase Storage ('app-releases')...`);

const req = https.request({
  hostname: url,
  path: '/storage/v1/object/app-releases/smart-attendance.apk',
  method: 'POST',
  headers: {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/vnd.android.package-archive',
    'x-upsert': 'true',
    'Content-Length': fileBuffer.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('\n======================================================');
      console.log('✅ SUCCESS! APK IS LIVE & DIRECTLY DOWNLOADABLE:');
      console.log(`https://${url}/storage/v1/object/public/app-releases/smart-attendance.apk`);
      console.log('======================================================\n');
    } else {
      console.error(`❌ Upload failed (HTTP ${res.statusCode}):`, body);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error('Network request failed:', err.message);
  process.exit(1);
});

req.write(fileBuffer);
req.end();
