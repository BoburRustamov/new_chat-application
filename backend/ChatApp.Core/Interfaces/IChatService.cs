using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.DTOs.Common;

namespace ChatApp.Core.Interfaces;

public interface IChatService
{
    Task<ChatDto?> GetByIdAsync(Guid chatId, Guid userId);
    Task<List<ChatDto>> GetUserChatsAsync(Guid userId);
    Task<ChatDto> CreatePrivateChatAsync(Guid userId, Guid otherUserId);
    Task<ChatDto> CreateGroupChatAsync(Guid creatorId, string name, string? description, List<Guid> memberIds);
    Task<ChatDto?> GetPrivateChatAsync(Guid userId1, Guid userId2);
    Task<bool> IsMemberAsync(Guid chatId, Guid userId);
    Task AddMemberAsync(Guid chatId, Guid userId, Guid addedById);
    Task RemoveMemberAsync(Guid chatId, Guid userId, Guid removedById);
    Task UpdateLastReadAsync(Guid chatId, Guid userId, Guid messageId);
    Task<ChatDto> UpdateChatAsync(Guid chatId, Guid userId, string? name, string? description, Guid? avatarFileId);
    Task DeleteChatAsync(Guid chatId, Guid userId);
    Task SetMutedAsync(Guid chatId, Guid userId, bool muted);

    // Admin methods
    Task<int> GetTotalChatsCountAsync();
    Task<long> GetTotalMessagesCountAsync();
}
