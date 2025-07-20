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
const telegraf_1 = require("telegraf");
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const deletePreviousVideo_1 = require("./deletePreviousVideo");
dotenv_1.default.config();
const bot = new telegraf_1.Telegraf(process.env.BOT_TOKEN);
const videoList = JSON.parse(fs.readFileSync('./data/videoAPI.json', 'utf-8'));
const fileIdMap = new Map();
const lastVideoMessageMap = new Map();
bot.command('start', (ctx) => {
    return ctx.reply('Вітаю тебе у моїй авторській програмі онлайн-стретчингу! 🥳🎊\n\nЦе не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\nДо зустрічі на килимку!🧘🏼‍♀️\n\nЗ любов’ю,🫶🏼\nКатерина Горбань', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
        [telegraf_1.Markup.button.callback('✅ Переваги програми:', 'benefits')],
        [telegraf_1.Markup.button.callback('🔹 Ця програма підійде:', 'about')],
        [telegraf_1.Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
    ]));
});
bot.action('work_out', (ctx) => {
    let videoCounter = 0;
    const videoButtons = videoList.map((video) => {
        const shortId = `vid${videoCounter++}`;
        fileIdMap.set(shortId, video.fileId);
        return [telegraf_1.Markup.button.callback(video.fileName, `play_video:${shortId}`)];
    });
    videoButtons.push([telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]);
    return ctx.editMessageText('Ось список відео для тренування:', telegraf_1.Markup.inlineKeyboard(videoButtons));
});
bot.action(/play_video:(.+)/, async (ctx) => {
    const shortId = ctx.match[1];
    const fileId = fileIdMap.get(shortId);
    const chatId = ctx.chat?.id;
    if (!fileId) {
        return ctx.reply('❌ Відео не знайдено.');
    }
    if (!chatId) {
        return ctx.reply('❌ Неможливо визначити чат.');
    }
    await ctx.answerCbQuery();
    await (0, deletePreviousVideo_1.deletePreviousVideo)(chatId, ctx.telegram, lastVideoMessageMap);
    const sendVideo = await ctx.replyWithVideo(fileId, {
        caption: 'Ось ваше тренування!',
    });
    lastVideoMessageMap.set(chatId, sendVideo.message_id);
});
bot.action('benefits', (ctx) => {
    return ctx.editMessageText('Переваги програми:\n\n✅ Поступова побудова гнучкості — без болю, надривів та зайвого стресу\n✅ Поєднання стретчингу та м’яких силових елементів — для здорових суглобів і м’язів\n✅ Пояснення техніки, дихання і безпечного входження у пози\n✅ Можна тренуватись у зручному темпі та комфортній атмосфері\n✅ Підходить для занять вдома, тобі знадобляться лише килимок, йога блоки та рушник.', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});
bot.action('about', (ctx) => {
    return ctx.editMessageText('Ця програма підійде: \n\n🔹 Початківцям, які хочуть безпечно почати розвивати гнучкість\n🔹 Тим, хто відчуває напруження у спині, ногах, тазі — і прагне покращити самопочуття\n🔹 Танцівникам, фітнес-ентузіастам, спортсменам як додаток до основного тренінгу\n🔹 Усім, хто мріє про шпагати, легке тіло й гарну поставу', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});
bot.action('motivation', (ctx) => {
    return ctx.editMessageText('Неважливо, з чого ти починаєш — важливо, що ти починаєш.\n\nТвоє тіло вже дякує тобі за цей крок. Розтягуючи м’язи, ти розширюєш свої межі — не лише фізично, а й внутрішньо. Подаруй собі цю подорож до себе. Ти заслуговуєш бути вільною/вільним у кожному русі 💫', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('⮐ Повернутись до меню', 'return_to_menu')]
    ]));
});
bot.action('return_to_menu', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (chatId) {
        await (0, deletePreviousVideo_1.deletePreviousVideo)(chatId, ctx.telegram, lastVideoMessageMap);
    }
    return ctx.editMessageText('Вітаю тебе у моїй авторській програмі онлайн-стретчингу!\n\nЦе не просто набір вправ — це шлях до гнучкості, легкості рухів та гармонії з власним тілом. Програма складається з 6 відео, кожне з яких створене з любов’ю, знанням анатомії та розумінням потреб різного рівня підготовки.\n\nДо зустрічі на килимку!🧘🏼‍♀️\n\nЗ любов’ю,🫶🏼\nКатерина Горбань', telegraf_1.Markup.inlineKeyboard([
        [telegraf_1.Markup.button.callback('🤸🏼‍♀️ Розпочати тренування:', 'work_out')],
        [telegraf_1.Markup.button.callback('✅ Переваги програми:', 'benefits')],
        [telegraf_1.Markup.button.callback('🔹 Ця програма підійде:', 'about')],
        [telegraf_1.Markup.button.callback('💫 Мотивація від мене:', 'motivation')],
    ]));
});
// Start the bot
bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
//# sourceMappingURL=App.js.map