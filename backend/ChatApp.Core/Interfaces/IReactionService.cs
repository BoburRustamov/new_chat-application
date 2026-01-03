using ChatApp.Core.DTOs.Chat;

namespace ChatApp.Core.Interfaces;

public interface IReactionService
{
    Task<MessageDto> AddReactionAsync(Guid messageId, Guid userId, string emoji);
    Task<MessageDto> RemoveReactionAsync(Guid messageId, Guid userId, string emoji);
}
