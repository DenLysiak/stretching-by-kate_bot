"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAllCronJobs = startAllCronJobs;
exports.stopAllCronJobs = stopAllCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const userServices_1 = require("./userServices");
const App_1 = require("./App");
let deleteExpiredJob;
let notifyJob;
let motivationJob;
function startAllCronJobs(bot) {
    // Every day at 00:00 check for expired users
    deleteExpiredJob = node_cron_1.default.schedule('0 0 * * *', async () => {
        try {
            console.log('🕛 Запускається перевірка прострочених користувачів...');
            await (0, userServices_1.deleteExpiredUsers)(bot);
            console.log('✅ Перевірка прострочених користувачів завершена.');
        }
        catch (error) {
            console.error('❌ Помилка під час видалення прострочених користувачів:', error);
        }
    });
    // Every day at 09:00 notify users with expiring access
    notifyJob = node_cron_1.default.schedule('0 9 * * *', async () => {
        try {
            console.log('📬 Перевірка на користувачів із закінченням доступу...');
            await (0, userServices_1.notifyExpiringUsers)(bot);
            console.log('✅ Перевірка на користувачів із закінченням доступу завершена.');
        }
        catch (error) {
            console.error('❌ Помилка під час перевірки прострочених користувачів:', error);
        }
    });
    // Every Monday, Wednesday, and Friday at 10:00 send motivation message
    motivationJob = node_cron_1.default.schedule('0 10 * * 1, 3, 5', async () => {
        try {
            const users = await (0, userServices_1.getAllUsers)();
            const date = new Date().getDate();
            const motivationMessage = App_1.motivationMessageList.find((m) => m.messageId === date);
            const motivationText = motivationMessage?.messageText || 'Тягнись, поки не втягнешся. І тоді тягнись ще! 💫';
            for (const user of users) {
                bot.telegram.sendMessage(user.user_id, motivationText, { parse_mode: 'HTML' }).catch(err => {
                    console.error(`❗ Не вдалося надіслати нагадування користувачу ${user.user_id}:`, err);
                });
            }
            console.log('✅ Мотиваційне повідомлення розіслано');
        }
        catch (error) {
            console.error('❌ Помилка під час розсилки мотиваційних повідомлень:', error);
        }
    });
    console.log('✅ Усі cron завдання запущено.');
}
function stopAllCronJobs() {
    if (deleteExpiredJob)
        deleteExpiredJob.stop();
    if (notifyJob)
        notifyJob.stop();
    if (motivationJob)
        motivationJob.stop();
    console.log('🛑 Усі cron завдання зупинено.');
}
//# sourceMappingURL=cron-jobs.js.map