"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserIfNotExists = addUserIfNotExists;
exports.removeUser = removeUser;
exports.deleteExpiredUsers = deleteExpiredUsers;
exports.isUserAllowed = isUserAllowed;
exports.getAllUsers = getAllUsers;
const App_1 = require("./App");
const googleDriveService_1 = require("./googleDriveService");
async function addUserIfNotExists(user) {
    try {
        const check = App_1.db.prepare('SELECT user_id FROM allowed_users WHERE user_id = ?').get(user.user_id);
        if (check) {
            return `🔒 Користувач з ID ${user.user_id} вже доданий.`;
        }
        const now = new Date().toISOString();
        const endDate = user.permission_type === 'temporary'
            ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            : null;
        const insert = App_1.db.prepare(`
      INSERT INTO allowed_users 
        (user_id, first_name, last_name, username, date_added, permission_type, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        insert.run(user.user_id, user.first_name ?? null, user.last_name ?? null, user.username ?? null, now, user.permission_type, endDate);
        await (0, googleDriveService_1.uploadDatabaseToDrive)();
        return `✅ Користувача ${user.first_name ?? ''} успішно додано${user.permission_type === 'temporary' ? ' на 90 днів' : ' назавжди'}.`;
    }
    catch (err) {
        console.error('Error while adding user:', err);
        return '❌ Сталася помилка при додаванні користувача.';
    }
}
async function removeUser(userId) {
    const stmt = App_1.db.prepare('DELETE FROM allowed_users WHERE user_id = ?');
    const result = stmt.run(userId);
    if (result.changes > 0) {
        await (0, googleDriveService_1.uploadDatabaseToDrive)();
        return true;
    }
    return false;
}
function deleteExpiredUsers() {
    const now = new Date().toISOString();
    const stmt = App_1.db.prepare(`
    DELETE FROM allowed_users 
    WHERE permission_type = 'temporary' 
      AND end_date IS NOT NULL 
      AND end_date < ?
  `);
    const result = stmt.run(now);
    console.log(`Expired users removed: ${result.changes}`);
}
function isUserAllowed(userId) {
    const stmt = App_1.db.prepare('SELECT 1 FROM allowed_users WHERE user_id = ?');
    return !!stmt.get(userId);
}
function getAllUsers() {
    const stmt = App_1.db.prepare('SELECT * FROM allowed_users');
    return stmt.all();
}
//# sourceMappingURL=userServices.js.map