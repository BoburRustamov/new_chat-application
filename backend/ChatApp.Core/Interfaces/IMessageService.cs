using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.DTOs.Common;

namespace ChatApp.Core.Interfaces;

public interface IMessageService
{
    Task<MessageDto?> GetByIdAsync(Guid messageId, Guid userId);
    Task<PagedResponse<MessageDto>> GetChatMessagesAsync(Guid chatId, Guid userId, int page = 1, int pageSize = 50);
    Task<MessageDto> SendMessageAsync(Guid senderId, SendMessageRequest request);
    Task<MessageDto> UpdateMessageAsync(Guid messageId, Guid userId, string content);
    Task DeleteMessageAsync(Guid messageId, Guid userId, bool deleteForEveryone = true);
    Task MarkAsReadAsync(Guid chatId, Guid userId, Guid? upToMessageId = null);
    Task<int> GetUnreadCountAsync(Guid chatId, Guid userId);
    Task<MessageDto> PinMessageAsync(Guid messageId, Guid userId);
    Task<MessageDto> UnpinMessageAsync(Guid messageId, Guid userId);
    Task<List<MessageDto>> GetPinnedMessagesAsync(Guid chatId, Guid userId);
    Task<PagedResponse<MessageDto>> SearchMessagesAsync(Guid chatId, Guid userId, string query, int page = 1, int pageSize = 20);
    Task<MessageDto> ForwardMessageAsync(Guid messageId, Guid userId, Guid targetChatId);
}
