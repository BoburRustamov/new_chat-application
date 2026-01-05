using System.Security.Claims;
using ChatApp.Core.DTOs.Call;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Entities;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace ChatApp.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly IChatService _chatService;
    private readonly IMessageService _messageService;
    private readonly IUserService _userService;
    private readonly IReactionService _reactionService;
    private readonly ICallService _callService;
    private readonly IChannelService _channelService;
    private readonly ILogger<ChatHub> _logger;
    private static readonly Dictionary<Guid, HashSet<string>> _userConnections = new();
    private static readonly Dictionary<Guid, Dictionary<Guid, ParticipantMediaState>> _callParticipantStates = new();
    private static readonly object _lock = new();

    public ChatHub(
        IChatService chatService,
        IMessageService messageService,
        IUserService userService,
        IReactionService reactionService,
        ICallService callService,
        IChannelService channelService,
        ILogger<ChatHub> logger)
    {
        _chatService = chatService;
        _messageService = messageService;
        _userService = userService;
        _reactionService = reactionService;
        _callService = callService;
        _channelService = channelService;
        _logger = logger;
    }

    private class ParticipantMediaState
    {
        public bool IsMuted { get; set; }
        public bool IsVideoOn { get; set; }
    }

    private Guid GetUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim))
        {
            _logger.LogWarning("User claim is null or empty. Identity: {IdentityName}", Context.User?.Identity?.Name);
            throw new UnauthorizedAccessException("User ID claim not found");
        }
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            _logger.LogWarning("Failed to parse user ID: {UserIdClaim}", userIdClaim);
            throw new FormatException($"Invalid user ID format: {userIdClaim}");
        }
        return userId;
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetUserId();

        // Track connection
        lock (_lock)
        {
            if (!_userConnections.ContainsKey(userId))
            {
                _userConnections[userId] = new HashSet<string>();
            }
            _userConnections[userId].Add(Context.ConnectionId);
        }

        // Update user online status
        await _userService.UpdateOnlineStatusAsync(userId, true);

        // Join user's chat groups
        var chats = await _chatService.GetUserChatsAsync(userId);
        foreach (var chat in chats)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chat.Id}");
        }

        // Notify contacts that user is online
        await BroadcastUserStatus(userId, true);

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userId = GetUserId();

        bool isLastConnection;
        lock (_lock)
        {
            if (_userConnections.ContainsKey(userId))
            {
                _userConnections[userId].Remove(Context.ConnectionId);
                isLastConnection = _userConnections[userId].Count == 0;
                if (isLastConnection)
                {
                    _userConnections.Remove(userId);
                }
            }
            else
            {
                isLastConnection = true;
            }
        }

        // Only update status if this was the last connection
        if (isLastConnection)
        {
            await _userService.UpdateOnlineStatusAsync(userId, false);
            await BroadcastUserStatus(userId, false);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(SendMessageRequest request)
    {
        var userId = GetUserId();

        // Send message through service
        var message = await _messageService.SendMessageAsync(userId, request);

        // Broadcast to all members of the chat
        await Clients.Group($"chat_{request.ChatId}").SendAsync("ReceiveMessage", message);
    }

    public async Task EditMessage(Guid messageId, string content)
    {
        var userId = GetUserId();

        var message = await _messageService.UpdateMessageAsync(messageId, userId, content);

        // Broadcast update to chat members
        await Clients.Group($"chat_{message.ChatId}").SendAsync("MessageEdited", message);
    }

    public async Task DeleteMessage(Guid messageId)
    {
        var userId = GetUserId();

        // Get message first to know the chat
        var message = await _messageService.GetByIdAsync(messageId, userId);
        if (message == null) return;

        await _messageService.DeleteMessageAsync(messageId, userId, true);

        // Broadcast deletion
        await Clients.Group($"chat_{message.ChatId}").SendAsync("MessageDeleted", new
        {
            MessageId = messageId,
            ChatId = message.ChatId
        });
    }

    public async Task StartTyping(Guid chatId)
    {
        var userId = GetUserId();
        var user = await _userService.GetByIdAsync(userId);

        if (user != null && await _chatService.IsMemberAsync(chatId, userId))
        {
            await Clients.OthersInGroup($"chat_{chatId}").SendAsync("UserTyping", new
            {
                ChatId = chatId,
                UserId = userId,
                UserName = user.DisplayName
            });
        }
    }

    public async Task StopTyping(Guid chatId)
    {
        var userId = GetUserId();

        if (await _chatService.IsMemberAsync(chatId, userId))
        {
            await Clients.OthersInGroup($"chat_{chatId}").SendAsync("UserStoppedTyping", new
            {
                ChatId = chatId,
                UserId = userId
            });
        }
    }

    public async Task MarkAsRead(Guid chatId, Guid? messageId = null)
    {
        var userId = GetUserId();

        await _messageService.MarkAsReadAsync(chatId, userId, messageId);

        // Notify message sender(s) about read receipt
        await Clients.OthersInGroup($"chat_{chatId}").SendAsync("MessagesRead", new
        {
            ChatId = chatId,
            UserId = userId,
            MessageId = messageId
        });
    }

    public async Task JoinChat(Guid chatId)
    {
        var userId = GetUserId();

        if (await _chatService.IsMemberAsync(chatId, userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatId}");
        }
    }

    public async Task LeaveChat(Guid chatId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{chatId}");
    }

    public async Task PinMessage(Guid messageId)
    {
        var userId = GetUserId();

        var message = await _messageService.PinMessageAsync(messageId, userId);

        // Broadcast pin to chat members
        await Clients.Group($"chat_{message.ChatId}").SendAsync("MessagePinned", message);
    }

    public async Task UnpinMessage(Guid messageId)
    {
        var userId = GetUserId();

        var message = await _messageService.UnpinMessageAsync(messageId, userId);

        // Broadcast unpin to chat members
        await Clients.Group($"chat_{message.ChatId}").SendAsync("MessageUnpinned", message);
    }

    public async Task AddReaction(Guid messageId, string emoji)
    {
        var userId = GetUserId();

        var message = await _reactionService.AddReactionAsync(messageId, userId, emoji);

        // Broadcast reaction update to chat members
        await Clients.Group($"chat_{message.ChatId}").SendAsync("ReactionAdded", message);
    }

    public async Task RemoveReaction(Guid messageId, string emoji)
    {
        var userId = GetUserId();

        var message = await _reactionService.RemoveReactionAsync(messageId, userId, emoji);

        // Broadcast reaction update to chat members
        await Clients.Group($"chat_{message.ChatId}").SendAsync("ReactionRemoved", message);
    }

    public async Task ForwardMessage(Guid messageId, Guid targetChatId)
    {
        var userId = GetUserId();

        // Forward message through service
        var message = await _messageService.ForwardMessageAsync(messageId, userId, targetChatId);

        // Broadcast to target chat members
        await Clients.Group($"chat_{targetChatId}").SendAsync("ReceiveMessage", message);

        // Notify sender
        await Clients.Caller.SendAsync("MessageForwarded", message);
    }

    private async Task BroadcastUserStatus(Guid userId, bool isOnline)
    {
        var chats = await _chatService.GetUserChatsAsync(userId);

        foreach (var chat in chats)
        {
            await Clients.OthersInGroup($"chat_{chat.Id}").SendAsync("UserStatusChanged", new
            {
                UserId = userId,
                IsOnline = isOnline,
                LastSeenAt = isOnline ? (DateTime?)null : DateTime.UtcNow
            });
        }
    }

    public static bool IsUserOnline(Guid userId)
    {
        lock (_lock)
        {
            return _userConnections.ContainsKey(userId) && _userConnections[userId].Count > 0;
        }
    }

    public static IEnumerable<string> GetUserConnectionIds(Guid userId)
    {
        lock (_lock)
        {
            if (_userConnections.TryGetValue(userId, out var connections))
            {
                return connections.ToList();
            }
            return Enumerable.Empty<string>();
        }
    }

    #region Channel Methods

    public async Task JoinChannel(Guid channelId)
    {
        var userId = GetUserId();
        var channel = await _channelService.GetChannelAsync(channelId, userId);

        if (channel != null && channel.IsSubscribed)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"channel_{channelId}");
        }
    }

    public async Task LeaveChannel(Guid channelId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel_{channelId}");
    }

    public async Task SubscribeToChannel(Guid channelId)
    {
        var userId = GetUserId();

        try
        {
            var channel = await _channelService.SubscribeAsync(channelId, userId);

            // Join the channel group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"channel_{channelId}");

            // Also join the chat group for messages
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{channel.ChatId}");

            // Notify other subscribers about the new subscriber count
            await Clients.Group($"channel_{channelId}").SendAsync("SubscriberCountChanged", new
            {
                ChannelId = channelId,
                SubscriberCount = channel.SubscriberCount
            });

            // Send subscription confirmation to caller
            await Clients.Caller.SendAsync("ChannelSubscribed", channel);
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("ChannelError", new { Message = ex.Message });
        }
    }

    public async Task UnsubscribeFromChannel(Guid channelId)
    {
        var userId = GetUserId();

        try
        {
            var channel = await _channelService.GetChannelAsync(channelId, userId);
            var chatId = channel.ChatId;

            await _channelService.UnsubscribeAsync(channelId, userId);

            // Leave the channel group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"channel_{channelId}");

            // Leave the chat group
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"chat_{chatId}");

            // Notify remaining subscribers about the new subscriber count
            var updatedChannel = await _channelService.GetChannelAsync(channelId);
            await Clients.Group($"channel_{channelId}").SendAsync("SubscriberCountChanged", new
            {
                ChannelId = channelId,
                SubscriberCount = updatedChannel.SubscriberCount
            });

            // Send unsubscription confirmation to caller
            await Clients.Caller.SendAsync("ChannelUnsubscribed", new { ChannelId = channelId });
        }
        catch (Exception ex)
        {
            await Clients.Caller.SendAsync("ChannelError", new { Message = ex.Message });
        }
    }

    public async Task SendChannelMessage(SendMessageRequest request)
    {
        var userId = GetUserId();

        // Check if user can post in channel
        var canPost = await _channelService.CanPostByChatIdAsync(request.ChatId, userId);
        if (!canPost)
        {
            await Clients.Caller.SendAsync("ChannelError", new { Message = "Only admins can post in channels" });
            return;
        }

        // Send message through service
        var message = await _messageService.SendMessageAsync(userId, request);

        // Broadcast to all members of the chat (channel subscribers)
        await Clients.Group($"chat_{request.ChatId}").SendAsync("ReceiveChannelMessage", message);
    }

    #endregion

    #region Call Signaling Methods

    public async Task InitiateCall(InitiateCallRequest request)
    {
        var userId = GetUserId();
        var user = await _userService.GetByIdAsync(userId);

        if (user == null) return;

        // Create the call
        var call = await _callService.CreateCallAsync(request.ChatId, userId, request.Type);

        // Initialize participant media state
        lock (_lock)
        {
            if (!_callParticipantStates.ContainsKey(call.Id))
            {
                _callParticipantStates[call.Id] = new Dictionary<Guid, ParticipantMediaState>();
            }
            _callParticipantStates[call.Id][userId] = new ParticipantMediaState
            {
                IsMuted = false,
                IsVideoOn = request.Type == CallType.Video
            };
        }

        // Notify all chat members about incoming call
        await Clients.OthersInGroup($"chat_{request.ChatId}").SendAsync("IncomingCall", new
        {
            Call = call,
            CallerName = user.DisplayName,
            CallerAvatarUrl = user.AvatarUrl
        });

        // Send call info back to initiator
        await Clients.Caller.SendAsync("CallInitiated", call);
    }

    public async Task AcceptCall(Guid callId)
    {
        var userId = GetUserId();
        var user = await _userService.GetByIdAsync(userId);

        if (user == null) return;

        // Add user to call participants
        var call = await _callService.AddParticipantAsync(callId, userId);

        // Initialize participant media state
        lock (_lock)
        {
            if (!_callParticipantStates.ContainsKey(callId))
            {
                _callParticipantStates[callId] = new Dictionary<Guid, ParticipantMediaState>();
            }
            _callParticipantStates[callId][userId] = new ParticipantMediaState
            {
                IsMuted = false,
                IsVideoOn = call.Type == CallType.Video
            };
        }

        // Notify all call participants
        await Clients.Group($"chat_{call.ChatId}").SendAsync("CallAccepted", new
        {
            CallId = callId,
            UserId = userId,
            UserName = user.DisplayName,
            Call = call
        });
    }

    public async Task DeclineCall(Guid callId)
    {
        var userId = GetUserId();
        var call = await _callService.GetCallAsync(callId);

        if (call == null) return;

        // Notify initiator that call was declined
        var initiatorConnections = GetUserConnectionIds(call.InitiatorId);
        await Clients.Clients(initiatorConnections.ToList()).SendAsync("CallDeclined", new
        {
            CallId = callId,
            DeclinedBy = userId
        });

        // If only initiator is in the call, mark it as missed
        if (call.Participants.Count == 1)
        {
            await _callService.MarkCallAsMissedAsync(callId);
        }
    }

    public async Task EndCall(Guid callId)
    {
        var userId = GetUserId();
        var call = await _callService.GetCallAsync(callId);

        if (call == null) return;

        // End the call
        var endedCall = await _callService.EndCallAsync(callId, userId);

        // Clean up participant states
        lock (_lock)
        {
            _callParticipantStates.Remove(callId);
        }

        // Notify all chat members
        await Clients.Group($"chat_{call.ChatId}").SendAsync("CallEnded", new
        {
            CallId = callId,
            EndedBy = userId,
            Call = endedCall
        });
    }

    public async Task LeaveCall(Guid callId)
    {
        var userId = GetUserId();
        var call = await _callService.GetCallAsync(callId);

        if (call == null) return;

        // Remove participant
        var updatedCall = await _callService.RemoveParticipantAsync(callId, userId);

        // Clean up participant state
        lock (_lock)
        {
            if (_callParticipantStates.ContainsKey(callId))
            {
                _callParticipantStates[callId].Remove(userId);
            }
        }

        // Notify remaining participants
        await Clients.Group($"chat_{call.ChatId}").SendAsync("ParticipantLeft", new
        {
            CallId = callId,
            UserId = userId,
            Call = updatedCall
        });
    }

    public async Task SendOffer(Guid callId, Guid targetUserId, string sdp)
    {
        var userId = GetUserId();

        // Verify both users are in the call
        if (!await _callService.IsUserInCallAsync(callId, userId) ||
            !await _callService.IsUserInCallAsync(callId, targetUserId))
        {
            return;
        }

        // Send offer to target user
        var targetConnections = GetUserConnectionIds(targetUserId);
        await Clients.Clients(targetConnections.ToList()).SendAsync("ReceiveOffer", new
        {
            CallId = callId,
            FromUserId = userId,
            Sdp = sdp
        });
    }

    public async Task SendAnswer(Guid callId, Guid targetUserId, string sdp)
    {
        var userId = GetUserId();

        // Verify both users are in the call
        if (!await _callService.IsUserInCallAsync(callId, userId) ||
            !await _callService.IsUserInCallAsync(callId, targetUserId))
        {
            return;
        }

        // Send answer to target user
        var targetConnections = GetUserConnectionIds(targetUserId);
        await Clients.Clients(targetConnections.ToList()).SendAsync("ReceiveAnswer", new
        {
            CallId = callId,
            FromUserId = userId,
            Sdp = sdp
        });
    }

    public async Task SendIceCandidate(Guid callId, Guid targetUserId, string candidate)
    {
        var userId = GetUserId();

        // Verify both users are in the call
        if (!await _callService.IsUserInCallAsync(callId, userId) ||
            !await _callService.IsUserInCallAsync(callId, targetUserId))
        {
            return;
        }

        // Send ICE candidate to target user
        var targetConnections = GetUserConnectionIds(targetUserId);
        await Clients.Clients(targetConnections.ToList()).SendAsync("ReceiveIceCandidate", new
        {
            CallId = callId,
            FromUserId = userId,
            Candidate = candidate
        });
    }

    public async Task ToggleMute(Guid callId, bool isMuted)
    {
        var userId = GetUserId();
        var call = await _callService.GetCallAsync(callId);

        if (call == null) return;

        // Update participant state
        lock (_lock)
        {
            if (_callParticipantStates.ContainsKey(callId) &&
                _callParticipantStates[callId].ContainsKey(userId))
            {
                _callParticipantStates[callId][userId].IsMuted = isMuted;
            }
        }

        // Notify other participants
        await Clients.OthersInGroup($"chat_{call.ChatId}").SendAsync("ParticipantMuted", new
        {
            CallId = callId,
            UserId = userId,
            IsMuted = isMuted
        });
    }

    public async Task ToggleVideo(Guid callId, bool isVideoOn)
    {
        var userId = GetUserId();
        var call = await _callService.GetCallAsync(callId);

        if (call == null) return;

        // Update participant state
        lock (_lock)
        {
            if (_callParticipantStates.ContainsKey(callId) &&
                _callParticipantStates[callId].ContainsKey(userId))
            {
                _callParticipantStates[callId][userId].IsVideoOn = isVideoOn;
            }
        }

        // Notify other participants
        await Clients.OthersInGroup($"chat_{call.ChatId}").SendAsync("ParticipantVideoChanged", new
        {
            CallId = callId,
            UserId = userId,
            IsVideoOn = isVideoOn
        });
    }

    public async Task<CallDto?> GetActiveCall(Guid chatId)
    {
        var userId = GetUserId();

        // Verify user is a member
        if (!await _chatService.IsMemberAsync(chatId, userId))
        {
            return null;
        }

        return await _callService.GetActiveCallForChatAsync(chatId);
    }

    #endregion
}
