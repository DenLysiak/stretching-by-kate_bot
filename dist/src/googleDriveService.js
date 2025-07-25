"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDatabaseFromDrive = downloadDatabaseFromDrive;
exports.uploadDatabaseToDrive = uploadDatabaseToDrive;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const googleapis_1 = require("googleapis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PARENT_FOLDER_ID = process.env.GOOGLE_PARENTS_FOLDER_ID;
const base64EncodedServiceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
const decodedServiceAccount = Buffer.from(base64EncodedServiceAccount, 'base64').toString('utf-8');
const CREDENTIALS_JSON = JSON.parse(decodedServiceAccount);
if (!CREDENTIALS_JSON)
    throw new Error('❌ GOOGLE_SERVICE_ACCOUNT не знайдено');
let credentials;
try {
    credentials = CREDENTIALS_JSON;
}
catch (err) {
    throw new Error('❌ Некоректний формат GOOGLE_SERVICE_ACCOUNT JSON');
}
const FILE_NAME = 'users.db';
const LOCAL_FILE_PATH = path_1.default.join(__dirname, '../../data/users.db');
const auth = new googleapis_1.google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
});
const drive = googleapis_1.google.drive({ version: 'v3', auth });
async function downloadDatabaseFromDrive() {
    try {
        const res = await drive.files.list({
            q: `name='${FILE_NAME}' and '${PARENT_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id, name)',
        });
        const file = res.data.files?.[0];
        if (!file) {
            console.log('Файл не знайдено на Google Drive.');
            return;
        }
        const dest = fs_1.promises.open(LOCAL_FILE_PATH, 'w');
        const stream = await (await (dest)).createWriteStream();
        const response = await drive.files.get({ fileId: file.id, alt: 'media' }, { responseType: 'stream' });
        await new Promise((resolve, reject) => {
            response.data
                .on('end', () => {
                console.log('✅ Базу даних завантажено з Google Drive.');
                resolve();
            })
                .on('error', (err) => {
                console.error('❌ Помилка при читанні файлу:', err);
                reject(err);
            })
                .pipe(stream);
        });
    }
    catch (error) {
        console.error('❌ Помилка завантаження файлу з Google Drive:', error);
    }
}
async function uploadDatabaseToDrive() {
    try {
        const fileMetadata = {
            name: FILE_NAME,
            parents: [PARENT_FOLDER_ID || ''],
        };
        const media = {
            mimeType: 'application/octet-stream',
            body: await fs_1.promises.readFile(LOCAL_FILE_PATH),
        };
        // Перевірка: чи файл вже існує
        const res = await drive.files.list({
            q: `name='${FILE_NAME}' and '${PARENT_FOLDER_ID}' in parents and trashed=false`,
            fields: 'files(id)',
        });
        const existingFile = res.data.files?.[0];
        if (existingFile) {
            // Оновлення існуючого файлу
            await drive.files.update({
                fileId: existingFile.id,
                media,
            });
            console.log('✅ Файл оновлено на Google Drive.');
        }
        else {
            // Створення нового файлу
            drive.files.create({
                requestBody: fileMetadata,
                media,
                fields: 'id',
            });
            console.log('✅ Файл створено на Google Drive.');
        }
    }
    catch (error) {
        console.error('❌ Помилка завантаження файлу на Google Drive:', error);
    }
}
//# sourceMappingURL=googleDriveService.js.map