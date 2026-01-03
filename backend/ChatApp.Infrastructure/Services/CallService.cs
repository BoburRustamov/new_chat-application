using ChatApp.Core.DTOs.Call;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class CallService : ICallService
{
    private readonly AppDbContext _context;
    private readonly IChatService _chatService;

    public CallService(AppDbContext context, IChatService chatService)
    {
        _context = context;
        _chatService = chatService;
    }

    public async Task<CallDto> CreateCallAsync(Guid chatId, Guid initiatorId, CallType type)
    {
        // Verify user is a member of the chat
        if (!await _chatService.IsMemberAsync(chatId, initiatorId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Check if there's already an active call in this chat
        var existingActiveCall = await _context.Calls
            .FirstOrDefaultAsync(c => c.ChatId == chatId && c.Status == CallStatus.Active);

        if (existingActiveCall != null)
        {
            throw new ConflictException("There is already an active call in this chat");
        }

        var call = new Call
        {
            Id = Guid.NewGuid(),
            ChatId = chatId,
            InitiatorId = initiatorId,
            Type = type,
            Status = CallStatus.Active,
            StartedAt = DateTime.UtcNow
        };

        // Add initiator as first participant
        var participant = new CallParticipant
        {
            Id = Guid.NewGuid(),
            CallId = call.Id,
            UserId = initiatorId,
            JoinedAt = DateTime.UtcNow
        };

        _context.Calls.Add(call);
        _context.CallParticipants.Add(participant);
        await _context.SaveChangesAsync();

        return (await GetCallAsync(call.Id))!;
    }

    public async Task<CallDto?> GetCallAsync(Guid callId)
    {
        var call = await _context.Calls
            .Include(c => c.Chat)
            .Include(c => c.Initiator)
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.Id == callId);

        return call == null ? null : MapToDto(call);
    }

    public async Task<CallDto?> GetActiveCallForChatAsync(Guid chatId)
    {
        var call = await _context.Calls
            .Include(c => c.Chat)
            .Include(c => c.Initiator)
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .FirstOrDefaultAsync(c => c.ChatId == chatId && c.Status == CallStatus.Active);

        return call == null ? null : MapToDto(call);
    }

    public async Task<CallDto> AddParticipantAsync(Guid callId, Guid userId)
    {
        var call = await _context.Calls
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == callId);

        if (call == null)
        {
            throw new NotFoundException("Call not found");
        }

        if (call.Status != CallStatus.Active)
        {
            throw new BadRequestException("Cannot join an ended call");
        }

        // Verify user is a member of the chat
        if (!await _chatService.IsMemberAsync(call.ChatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Check if user is already in the call
        var existingParticipant = call.Participants.FirstOrDefault(p => p.UserId == userId && p.LeftAt == null);
        if (existingParticipant != null)
        {
            // User already in call, just return current state
            return (await GetCallAsync(callId))!;
        }

        // Check if user was previously in the call and left
        var previousParticipant = call.Participants.FirstOrDefault(p => p.UserId == userId && p.LeftAt != null);
        if (previousParticipant != null)
        {
            // Rejoin - create new participant record
            previousParticipant.LeftAt = null;
            previousParticipant.JoinedAt = DateTime.UtcNow;
        }
        else
        {
            // New participant
            var participant = new CallParticipant
            {
                Id = Guid.NewGuid(),
                CallId = callId,
                UserId = userId,
                JoinedAt = DateTime.UtcNow
            };
            _context.CallParticipants.Add(participant);
        }

        await _context.SaveChangesAsync();
        return (await GetCallAsync(callId))!;
    }

    public async Task<CallDto> RemoveParticipantAsync(Guid callId, Guid userId)
    {
        var call = await _context.Calls
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == callId);

        if (call == null)
        {
            throw new NotFoundException("Call not found");
        }

        var participant = call.Participants.FirstOrDefault(p => p.UserId == userId && p.LeftAt == null);
        if (participant != null)
        {
            participant.LeftAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        // Check if all participants have left
        var activeParticipants = call.Participants.Count(p => p.LeftAt == null);
        if (activeParticipants == 0)
        {
            // End the call if no participants left
            call.Status = CallStatus.Ended;
            call.EndedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return (await GetCallAsync(callId))!;
    }

    public async Task<CallDto> EndCallAsync(Guid callId, Guid userId)
    {
        var call = await _context.Calls
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == callId);

        if (call == null)
        {
            throw new NotFoundException("Call not found");
        }

        if (call.Status != CallStatus.Active)
        {
            return (await GetCallAsync(callId))!;
        }

        // Mark call as ended
        call.Status = CallStatus.Ended;
        call.EndedAt = DateTime.UtcNow;

        // Mark all active participants as left
        foreach (var participant in call.Participants.Where(p => p.LeftAt == null))
        {
            participant.LeftAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return (await GetCallAsync(callId))!;
    }

    public async Task<CallDto> MarkCallAsMissedAsync(Guid callId)
    {
        var call = await _context.Calls
            .Include(c => c.Participants)
            .FirstOrDefaultAsync(c => c.Id == callId);

        if (call == null)
        {
            throw new NotFoundException("Call not found");
        }

        if (call.Status != CallStatus.Active)
        {
            return (await GetCallAsync(callId))!;
        }

        call.Status = CallStatus.Missed;
        call.EndedAt = DateTime.UtcNow;

        foreach (var participant in call.Participants.Where(p => p.LeftAt == null))
        {
            participant.LeftAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        return (await GetCallAsync(callId))!;
    }

    public async Task<List<CallDto>> GetCallHistoryAsync(Guid chatId, int limit = 50)
    {
        var calls = await _context.Calls
            .Include(c => c.Chat)
            .Include(c => c.Initiator)
            .Include(c => c.Participants)
                .ThenInclude(p => p.User)
            .Where(c => c.ChatId == chatId)
            .OrderByDescending(c => c.StartedAt)
            .Take(limit)
            .ToListAsync();

        return calls.Select(MapToDto).ToList();
    }

    public async Task<bool> IsUserInCallAsync(Guid callId, Guid userId)
    {
        return await _context.CallParticipants
            .AnyAsync(p => p.CallId == callId && p.UserId == userId && p.LeftAt == null);
    }

    public async Task UpdateParticipantStatusAsync(Guid callId, Guid userId, bool? isMuted = null, bool? isVideoOn = null)
    {
        // For now, we don't persist mute/video state in the database
        // This could be added later if needed for call analytics
        await Task.CompletedTask;
    }

    private static CallDto MapToDto(Call call)
    {
        var duration = call.EndedAt.HasValue
            ? (int)(call.EndedAt.Value - call.StartedAt).TotalSeconds
            : (int)(DateTime.UtcNow - call.StartedAt).TotalSeconds;

        return new CallDto
        {
            Id = call.Id,
            ChatId = call.ChatId,
            ChatName = call.Chat?.Name,
            InitiatorId = call.InitiatorId,
            InitiatorName = call.Initiator?.DisplayName ?? call.Initiator?.Username ?? "",
            InitiatorAvatarUrl = call.Initiator?.AvatarUrl,
            Type = call.Type,
            Status = call.Status,
            StartedAt = call.StartedAt,
            EndedAt = call.EndedAt,
            Duration = duration,
            Participants = call.Participants.Select(p => new CallParticipantDto
            {
                Id = p.Id,
                UserId = p.UserId,
                Username = p.User?.Username ?? "",
                DisplayName = p.User?.DisplayName ?? "",
                AvatarUrl = p.User?.AvatarUrl,
                JoinedAt = p.JoinedAt,
                LeftAt = p.LeftAt,
                IsMuted = false,
                IsVideoOn = call.Type == CallType.Video
            }).ToList()
        };
    }
}
