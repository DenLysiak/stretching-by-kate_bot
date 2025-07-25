"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeMessage = sendWelcomeMessage;
const telegraf_1 = require("telegraf");
/**
 * Надсилає вітальне повідомлення користувачу з кнопками.
 * @param recipient - або `ctx`, або `bot.telegram` з `userId`
 * @param userId - якщо використовуєш bot.telegram, вкажи userId
 */
async function sendWelcomeMessage(recipient, userId) {
    const messageText = 'Вітаю тебе у моїй авторській програмі онлайн-стретчингу! 🥳🎊\n\n' +
        'Це не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. ' +
        'Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\n' +
        'До зустрічі на килимку!🧘🏼‍♀️\n\n' +
        'З любов’ю,🫶🏼\nКатерина Горбань';
    const keyboard = telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
        [telegraf_1.Markup.button.callback('✅ Переваги програми:', 'benefits')],
        [telegraf_1.Markup.button.callback('🔹 Ця програма підійде:', 'about')],
        [telegraf_1.Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
    ]);
    if ('reply' in recipient) {
        // Використання з ctx
        return recipient.reply(messageText, keyboard);
    }
    else if (userId) {
        // Використання з bot.telegram
        return recipient.sendMessage(userId, messageText, keyboard);
    }
    else {
        throw new Error('Invalid recipient or missing userId');
    }
}
//# sourceMappingURL=sendWelcome.js.map