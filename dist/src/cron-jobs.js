"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAllCronJobs = startAllCronJobs;
exports.stopAllCronJobs = stopAllCronJobs;
const node_cron_1 = __importDefault(require("node-cron"));
const fs = __importStar(require("fs"));
const userServices_1 = require("./userServices");
let deleteExpiredJob;
let notifyJob;
let motivationJob;
const motivationMessageList = JSON.parse(fs.readFileSync('./data/motivationAPI.json', 'utf-8'));
const asyncDeleteExpiredUsers = async (bot) => {
    try {
        console.log('🕛 Запускається перевірка прострочених користувачів...');
        await (0, userServices_1.deleteExpiredUsers)(bot);
        console.log('✅ Перевірка прострочених користувачів завершена.');
    }
    catch (error) {
        console.error('❌ Помилка під час видалення прострочених користувачів:', error);
    }
};
const asyncNotifyJob = async (bot) => {
    try {
        console.log('📬 Перевірка на користувачів із закінченням доступу...');
        await (0, userServices_1.notifyExpiringUsers)(bot);
        console.log('✅ Перевірка на користувачів із закінченням доступу завершена.');
    }
    catch (error) {
        console.error('❌ Помилка під час перевірки прострочених користувачів:', error);
    }
};
const asyncMotivationJob = async (bot) => {
    try {
        const users = await (0, userServices_1.getAllUsers)();
        const date = new Date().getDate();
        const motivationMessage = motivationMessageList.find((m) => m.messageId === date);
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
};
function startAllCronJobs(bot) {
    // Every day at 00:00 check for expired users
    deleteExpiredJob = node_cron_1.default.schedule('16 8 * * *', () => asyncDeleteExpiredUsers(bot));
    // Every day at 09:00 notify users with expiring access
    notifyJob = node_cron_1.default.schedule('17 8 * * *', () => asyncNotifyJob(bot));
    // Every Monday, Wednesday, and Friday at 10:00 send motivation message
    motivationJob = node_cron_1.default.schedule('19 8 * * 1,3,5', () => asyncMotivationJob(bot));
    console.log('✅ Усі cron завдання запущено.');
}
function stopAllCronJobs() {
    if (deleteExpiredJob)
        deleteExpiredJob.stop();
    if (notifyJob)
        notifyJob.stop();
    if (motivationJob)
        motivationJob.stop();
    console.log('❌ Усі cron завдання зупинено.');
}
//# sourceMappingURL=cron-jobs.js.map