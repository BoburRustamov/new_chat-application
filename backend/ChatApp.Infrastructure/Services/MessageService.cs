using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.DTOs.Common;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class MessageService : IMessageService
{
    private readonly AppDbContext _context;
    private readonly IChatService _chatService;

    public MessageService(AppDbContext context, IChatService chatService)
    {
        _context = context;
        _chatService = chatService;
    }

    public async Task<MessageDto?> GetByIdAsync(Guid messageId, Guid userId)
    {
        var message = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null) return null;

        // Verify user is a member of the chat
        if (!await _chatService.IsMemberAsync(message.ChatId, userId))
            return null;

        return MapToDto(message, userId);
    }

    public async Task<PagedResponse<MessageDto>> GetChatMessagesAsync(Guid chatId, Guid userId, int page = 1, int pageSize = 50)
    {
        // Verify user is a member
        if (!await _chatService.IsMemberAsync(chatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Get IDs of messages deleted by this user (delete for me)
        var userDeletedMessageIds = await _context.DeletedMessages
            .Where(dm => dm.UserId == userId)
            .Select(dm => dm.MessageId)
            .ToListAsync();

        var messagesQuery = _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .Where(m => m.ChatId == chatId && !userDeletedMessageIds.Contains(m.Id))
            .OrderByDescending(m => m.CreatedAt);

        var totalCount = await messagesQuery.CountAsync();

        var messages = await messagesQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Reverse to show oldest first in the page
        messages.Reverse();

        return new PagedResponse<MessageDto>
        {
            Items = messages.Select(m => MapToDto(m, userId)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<MessageDto> SendMessageAsync(Guid senderId, SendMessageRequest request)
    {
        // Verify user is a member
        if (!await _chatService.IsMemberAsync(request.ChatId, senderId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Validate reply
        if (request.ReplyToId.HasValue)
        {
            var replyMessage = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == request.ReplyToId && m.ChatId == request.ChatId);

            if (replyMessage == null)
            {
                throw new BadRequestException("Reply message not found in this chat");
            }
        }

        // Validate file if provided
        if (request.FileId.HasValue)
        {
            var file = await _context.Files.FindAsync(request.FileId);
            if (file == null)
            {
                throw new BadRequestException("File not found");
            }
        }

        var message = new Message
        {
            Id = Guid.NewGuid(),
            ChatId = request.ChatId,
            SenderId = senderId,
            Content = request.Content,
            Type = request.Type,
            FileId = request.FileId,
            ReplyToId = request.ReplyToId
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        // Reload with includes
        var createdMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reads)
            .FirstAsync(m => m.Id == message.Id);

        return MapToDto(createdMessage, senderId);
    }

    public async Task<MessageDto> UpdateMessageAsync(Guid messageId, Guid userId, string content)
    {
        var message = await _context.Messages
            .Include(m => m.Sender)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        if (message.SenderId != userId)
        {
            throw new ForbiddenException("You can only edit your own messages");
        }

        if (message.IsDeleted)
        {
            throw new BadRequestException("Cannot edit a deleted message");
        }

        // Check 48-hour edit limit
        var editTimeLimit = TimeSpan.FromHours(48);
        if (DateTime.UtcNow - message.CreatedAt > editTimeLimit)
        {
            throw new BadRequestException("Messages can only be edited within 48 hours");
        }

        message.Content = content;
        message.IsEdited = true;
        message.EditedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var updatedMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .FirstAsync(m => m.Id == messageId);

        return MapToDto(updatedMessage, userId);
    }

    public async Task DeleteMessageAsync(Guid messageId, Guid userId, bool deleteForEveryone = true)
    {
        var message = await _context.Messages
            .Include(m => m.Chat)
                .ThenInclude(c => c.Members)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        var member = message.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        if (deleteForEveryone)
        {
            // Check if user can delete for everyone
            var isOwner = message.SenderId == userId;
            var isAdmin = member.Role == MemberRole.Owner || member.Role == MemberRole.Admin;

            if (!isOwner && !isAdmin)
            {
                throw new ForbiddenException("You can only delete your own messages for everyone");
            }

            message.IsDeleted = true;
            message.DeletedAt = DateTime.UtcNow;
            message.DeletedById = userId;
            message.Content = null;
        }
        else
        {
            // Delete for me - add record to DeletedMessages table
            var existingDelete = await _context.DeletedMessages
                .FirstOrDefaultAsync(dm => dm.MessageId == messageId && dm.UserId == userId);

            if (existingDelete == null)
            {
                var deletedMessage = new DeletedMessage
                {
                    Id = Guid.NewGuid(),
                    MessageId = messageId,
                    UserId = userId,
                    DeletedAt = DateTime.UtcNow
                };
                _context.DeletedMessages.Add(deletedMessage);
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task MarkAsReadAsync(Guid chatId, Guid userId, Guid? upToMessageId = null)
    {
        var member = await _context.ChatMembers
            .FirstOrDefaultAsync(m => m.ChatId == chatId && m.UserId == userId);

        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Get messages to mark as read
        var messagesToMarkQuery = _context.Messages
            .Where(m => m.ChatId == chatId && m.SenderId != userId);

        if (upToMessageId.HasValue)
        {
            // Get the target message's creation time
            var targetMessage = await _context.Messages
                .FirstOrDefaultAsync(m => m.Id == upToMessageId);

            if (targetMessage != null)
            {
                messagesToMarkQuery = messagesToMarkQuery
                    .Where(m => m.CreatedAt <= targetMessage.CreatedAt);
                member.LastReadMessageId = upToMessageId;
            }
        }
        else
        {
            // Get the latest message
            var latestMessage = await _context.Messages
                .Where(m => m.ChatId == chatId)
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            if (latestMessage != null)
            {
                member.LastReadMessageId = latestMessage.Id;
            }
        }

        // Get message IDs that need to be marked as read
        var messageIds = await messagesToMarkQuery
            .Select(m => m.Id)
            .ToListAsync();

        // Get existing read records for this user
        var existingReads = await _context.MessageReads
            .Where(mr => messageIds.Contains(mr.MessageId) && mr.UserId == userId)
            .Select(mr => mr.MessageId)
            .ToListAsync();

        // Create read records for messages not yet marked as read
        var newReads = messageIds
            .Where(id => !existingReads.Contains(id))
            .Select(id => new MessageRead
            {
                MessageId = id,
                UserId = userId,
                ReadAt = DateTime.UtcNow
            })
            .ToList();

        if (newReads.Any())
        {
            _context.MessageReads.AddRange(newReads);
        }

        member.LastReadAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task<int> GetUnreadCountAsync(Guid chatId, Guid userId)
    {
        var member = await _context.ChatMembers
            .FirstOrDefaultAsync(m => m.ChatId == chatId && m.UserId == userId);

        if (member == null) return 0;

        if (member.LastReadAt == null)
        {
            return await _context.Messages
                .CountAsync(m => m.ChatId == chatId && m.SenderId != userId);
        }

        return await _context.Messages
            .CountAsync(m => m.ChatId == chatId &&
                           m.SenderId != userId &&
                           m.CreatedAt > member.LastReadAt);
    }

    public async Task<MessageDto> PinMessageAsync(Guid messageId, Guid userId)
    {
        var message = await _context.Messages
            .Include(m => m.Chat)
                .ThenInclude(c => c.Members)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        var member = message.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Only admins, moderators, and owners can pin messages
        if (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin && member.Role != MemberRole.Moderator)
        {
            throw new ForbiddenException("You don't have permission to pin messages");
        }

        message.IsPinned = true;
        message.PinnedAt = DateTime.UtcNow;
        message.PinnedById = userId;

        await _context.SaveChangesAsync();

        var pinnedMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .FirstAsync(m => m.Id == messageId);

        return MapToDto(pinnedMessage, userId);
    }

    public async Task<MessageDto> UnpinMessageAsync(Guid messageId, Guid userId)
    {
        var message = await _context.Messages
            .Include(m => m.Chat)
                .ThenInclude(c => c.Members)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        var member = message.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Only admins, moderators, and owners can unpin messages
        if (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin && member.Role != MemberRole.Moderator)
        {
            throw new ForbiddenException("You don't have permission to unpin messages");
        }

        message.IsPinned = false;
        message.PinnedAt = null;
        message.PinnedById = null;

        await _context.SaveChangesAsync();

        var unpinnedMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .FirstAsync(m => m.Id == messageId);

        return MapToDto(unpinnedMessage, userId);
    }

    public async Task<List<MessageDto>> GetPinnedMessagesAsync(Guid chatId, Guid userId)
    {
        if (!await _chatService.IsMemberAsync(chatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        var pinnedMessages = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .Where(m => m.ChatId == chatId && m.IsPinned && !m.IsDeleted)
            .OrderByDescending(m => m.PinnedAt)
            .ToListAsync();

        return pinnedMessages.Select(m => MapToDto(m, userId)).ToList();
    }

    public async Task<PagedResponse<MessageDto>> SearchMessagesAsync(Guid chatId, Guid userId, string query, int page = 1, int pageSize = 20)
    {
        if (!await _chatService.IsMemberAsync(chatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        if (string.IsNullOrWhiteSpace(query))
        {
            return new PagedResponse<MessageDto>
            {
                Items = new List<MessageDto>(),
                Page = page,
                PageSize = pageSize,
                TotalCount = 0
            };
        }

        var searchQuery = query.ToLower();

        var messagesQuery = _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .Include(m => m.Reads)
            .Where(m => m.ChatId == chatId &&
                       !m.IsDeleted &&
                       m.Content != null &&
                       m.Content.ToLower().Contains(searchQuery))
            .OrderByDescending(m => m.CreatedAt);

        var totalCount = await messagesQuery.CountAsync();

        var messages = await messagesQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponse<MessageDto>
        {
            Items = messages.Select(m => MapToDto(m, userId)).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<MessageDto> ForwardMessageAsync(Guid messageId, Guid userId, Guid targetChatId)
    {
        // Get the original message
        var originalMessage = await _context.Messages
            .Include(m => m.File)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (originalMessage == null)
        {
            throw new NotFoundException("Message not found");
        }

        if (originalMessage.IsDeleted)
        {
            throw new BadRequestException("Cannot forward a deleted message");
        }

        // Verify user is a member of the original chat
        if (!await _chatService.IsMemberAsync(originalMessage.ChatId, userId))
        {
            throw new ForbiddenException("You are not a member of the original chat");
        }

        // Verify user is a member of the target chat
        if (!await _chatService.IsMemberAsync(targetChatId, userId))
        {
            throw new ForbiddenException("You are not a member of the target chat");
        }

        // Create the forwarded message
        var forwardedMessage = new Message
        {
            Id = Guid.NewGuid(),
            ChatId = targetChatId,
            SenderId = userId,
            Content = originalMessage.Content,
            Type = originalMessage.Type,
            FileId = originalMessage.FileId,
            ForwardedFromId = messageId
        };

        _context.Messages.Add(forwardedMessage);
        await _context.SaveChangesAsync();

        // Reload with includes
        var createdMessage = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ForwardedFrom)
                .ThenInclude(f => f!.Sender)
            .Include(m => m.Reads)
            .FirstAsync(m => m.Id == forwardedMessage.Id);

        return MapToDto(createdMessage, userId);
    }

    private static MessageDto MapToDto(Message message, Guid? currentUserId = null)
    {
        // Calculate message status
        var status = MessageStatus.Sent;
        if (currentUserId.HasValue && message.SenderId == currentUserId.Value)
        {
            // For messages sent by current user, check if others have read it
            if (message.Reads != null && message.Reads.Any(r => r.UserId != currentUserId.Value))
            {
                status = MessageStatus.Read;
            }
            else
            {
                // For now, mark as Delivered if message was sent (could be enhanced with actual delivery tracking)
                status = MessageStatus.Delivered;
            }
        }

        var dto = new MessageDto
        {
            Id = message.Id,
            ChatId = message.ChatId,
            SenderId = message.SenderId,
            SenderUsername = message.Sender.Username,
            SenderDisplayName = message.Sender.DisplayName,
            SenderAvatarUrl = message.Sender.AvatarUrl,
            Content = message.IsDeleted ? null : message.Content,
            Type = message.Type,
            FileId = message.FileId,
            ReplyToId = message.ReplyToId,
            IsEdited = message.IsEdited,
            EditedAt = message.EditedAt,
            IsDeleted = message.IsDeleted,
            IsPinned = message.IsPinned,
            CreatedAt = message.CreatedAt,
            UpdatedAt = message.UpdatedAt,
            Status = status
        };

        if (message.File != null)
        {
            dto.File = new FileDto
            {
                Id = message.File.Id,
                FileName = message.File.OriginalFileName,
                ContentType = message.File.ContentType,
                Size = message.File.Size,
                DownloadUrl = $"/api/files/{message.File.Id}",
                ThumbnailUrl = !string.IsNullOrEmpty(message.File.ThumbnailPath) ? $"/api/files/{message.File.Id}/thumbnail" : null,
                Duration = message.File.Duration,
                Width = message.File.Width,
                Height = message.File.Height
            };
        }

        if (message.ReplyTo != null)
        {
            dto.ReplyTo = new MessageDto
            {
                Id = message.ReplyTo.Id,
                ChatId = message.ReplyTo.ChatId,
                SenderId = message.ReplyTo.SenderId,
                SenderUsername = message.ReplyTo.Sender?.Username ?? "",
                SenderDisplayName = message.ReplyTo.Sender?.DisplayName ?? "",
                Content = message.ReplyTo.IsDeleted ? null : message.ReplyTo.Content,
                Type = message.ReplyTo.Type,
                IsDeleted = message.ReplyTo.IsDeleted,
                CreatedAt = message.ReplyTo.CreatedAt
            };
        }

        if (message.Reactions.Any())
        {
            dto.Reactions = message.Reactions
                .GroupBy(r => r.Emoji)
                .Select(g => new ReactionDto
                {
                    Emoji = g.Key,
                    Count = g.Count(),
                    UserIds = g.Select(r => r.UserId).ToList()
                })
                .ToList();
        }

        return dto;
    }
}
