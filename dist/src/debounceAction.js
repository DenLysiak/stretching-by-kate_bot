"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debounceAction = debounceAction;
// Set to track recent menu clicks to prevent spam
const recentMenuClicks = new Set();
function debounceAction(handler, delay = 750) {
    return async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) {
            return ctx.reply('❌ Не вдалося визначити ваш ID користувача.');
        }
        if (recentMenuClicks.has(userId)) {
            return ctx.answerCbQuery('⏳ Зачекай трохи...');
        }
        recentMenuClicks.add(userId);
        setTimeout(() => recentMenuClicks.delete(userId), delay);
        await ctx.answerCbQuery();
        await handler(ctx);
    };
}
//# sourceMappingURL=debounceAction.js.map