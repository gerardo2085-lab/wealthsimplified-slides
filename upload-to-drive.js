const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const OUTPUT_DIR = path.join(__dirname, 'output');
const PARENT_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const KEY_B64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;

async function main() {
  if (!PARENT_FOLDER_ID) throw new Error('Missing DRIVE_FOLDER_ID');
  if (!KEY_B64) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_KEY_B64');

  const credentials = JSON.parse(Buffer.from(KEY_B64, 'base64').toString('utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const todayLabel = new Date().toISOString().slice(0, 10);
  const folderName = `WealthSimplified Slides - ${todayLabel}`;

  const existing = await drive.files.list({
    q: `'${PARENT_FOLDER_ID}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });

  let folderId;
  if (existing.data.files && existing.data.files.length > 0) {
    folderId = existing.data.files[0].id;
    console.log(`Using existing folder: ${folderName} (${folderId})`);
  } else {
    const folder = await drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [PARENT_FOLDER_ID],
      },
      fields: 'id',
    });
    folderId = folder.data.id;
    console.log(`Created folder: ${folderName} (${folderId})`);
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith('.png'));
  if (files.length === 0) throw new Error('No PNG files found in output/');

  for (const file of files) {
    const filePath = path.join(OUTPUT_DIR, file);
    await drive.files.create({
      resource: { name: file, parents: [folderId] },
      media: { mimeType: 'image/png', body: fs.createReadStream(filePath) },
      fields: 'id',
    });
    console.log(`Uploaded ${file}`);
  }

  console.log('All slides uploaded successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
