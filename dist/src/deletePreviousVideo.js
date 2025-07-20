"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePreviousVideo = deletePreviousVideo;
async function deletePreviousVideo(chatId, telegram, lastVideoMessageMap) {
    const previousMessageId = lastVideoMessageMap.get(chatId);
    if (previousMessageId) {
        try {
            await telegram.deleteMessage(chatId, previousMessageId);
            lastVideoMessageMap.delete(chatId);
        }
        catch (err) {
            console.warn('⚠️ Не вдалося видалити попереднє відео:', err);
        }
    }
}
//# sourceMappingURL=deletePreviousVideo.js.map