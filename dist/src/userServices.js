"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUserIfNotExists = addUserIfNotExists;
exports.removeUser = removeUser;
exports.deleteExpiredUsers = deleteExpiredUsers;
exports.isUserAllowed = isUserAllowed;
exports.getAllUsers = getAllUsers;
exports.notifyExpiringUsers = notifyExpiringUsers;
const telegraf_1 = require("telegraf");
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
async function deleteExpiredUsers(bot) {
    const now = new Date().toISOString();
    const stmt = App_1.db.prepare(`
    DELETE FROM allowed_users 
    WHERE permission_type = 'temporary' 
      AND end_date IS NOT NULL 
      AND end_date < ?
  `);
    const expiredUsers = stmt.all(now);
    if (expiredUsers.length === 0) {
        console.log('✅ Немає прострочених користувачів.');
        return;
    }
    const deleteStmt = App_1.db.prepare(`
    DELETE FROM allowed_users 
    WHERE user_id = ?
  `);
    for (const user of expiredUsers) {
        deleteStmt.run(user.user_id);
    }
    await (0, googleDriveService_1.uploadDatabaseToDrive)();
    const message = `🗑️ Видалено ${expiredUsers.length} користувачів із простроченим доступом:\n\n` +
        expiredUsers.map(u => `• ${u.first_name ?? ''} @${u.username ?? ''} (ID: ${u.user_id})`).join('\n');
    console.log(message);
    await bot.telegram.sendMessage(App_1.ADMIN, message);
}
async function isUserAllowed(userId) {
    const stmt = App_1.db.prepare('SELECT 1 FROM allowed_users WHERE user_id = ?');
    return !!stmt.get(userId);
}
async function getAllUsers() {
    const stmt = App_1.db.prepare('SELECT * FROM allowed_users');
    return stmt.all();
}
async function notifyExpiringUsers(bot) {
    const users = await getAllUsers();
    const now = new Date();
    for (const user of users) {
        if (user.permission_type !== 'temporary' || !user.end_date)
            continue;
        const endDate = new Date(user.end_date);
        const timeDiff = endDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        if (daysLeft !== 10 && daysLeft !== 1)
            continue;
        const endDateFormatted = endDate.toLocaleDateString('uk-UA');
        const notifyText = `⚠️ Ваш тимчасовий доступ до бота закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : 'ів'} (до ${endDateFormatted}).\n\nХочете подовжити доступ?`;
        // Повідомлення користувачу
        try {
            await bot.telegram.sendMessage(user.user_id, notifyText, telegraf_1.Markup.inlineKeyboard([
                telegraf_1.Markup.button.callback('🔁 Подовжити доступ', `request_extend_${user.user_id}`)
            ]));
        }
        catch (error) {
            if (error instanceof Error) {
                console.warn(`❗ Не вдалося надіслати повідомлення користувачу ${user.user_id}:`, error.message);
            }
            else {
                console.warn(`❗ Не вдалося надіслати повідомлення користувачу ${user.user_id}:`, error);
            }
        }
        // Повідомлення адміну
        try {
            await bot.telegram.sendMessage(App_1.ADMIN, `🔔 Нагадування: доступ користувача @${user.username ?? 'невідомо'} (ID: ${user.user_id}) закінчується через ${daysLeft} дн${daysLeft === 1 ? 'ь' : 'ів'} (${endDateFormatted}).`);
        }
        catch (error) {
            if (error instanceof Error) {
                console.warn(`❗ Не вдалося надіслати повідомлення адміну:`, error.message);
            }
            else {
                console.warn(`❗ Не вдалося надіслати повідомлення адміну:`, error);
            }
        }
    }
}
//# sourceMappingURL=userServices.js.map