using ChatApp.Core.DTOs.Call;
using ChatApp.Core.Entities;

namespace ChatApp.Core.Interfaces;

public interface ICallService
{
    Task<CallDto> CreateCallAsync(Guid chatId, Guid initiatorId, CallType type);
    Task<CallDto?> GetCallAsync(Guid callId);
    Task<CallDto?> GetActiveCallForChatAsync(Guid chatId);
    Task<CallDto> AddParticipantAsync(Guid callId, Guid userId);
    Task<CallDto> RemoveParticipantAsync(Guid callId, Guid userId);
    Task<CallDto> EndCallAsync(Guid callId, Guid userId);
    Task<CallDto> MarkCallAsMissedAsync(Guid callId);
    Task<List<CallDto>> GetCallHistoryAsync(Guid chatId, int limit = 50);
    Task<bool> IsUserInCallAsync(Guid callId, Guid userId);
    Task UpdateParticipantStatusAsync(Guid callId, Guid userId, bool? isMuted = null, bool? isVideoOn = null);
}
