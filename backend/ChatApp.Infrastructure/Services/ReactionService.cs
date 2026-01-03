using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class ReactionService : IReactionService
{
    private readonly AppDbContext _context;
    private readonly IChatService _chatService;

    public ReactionService(AppDbContext context, IChatService chatService)
    {
        _context = context;
        _chatService = chatService;
    }

    public async Task<MessageDto> AddReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        var message = await _context.Messages
            .Include(m => m.Chat)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        if (!await _chatService.IsMemberAsync(message.ChatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Check if user already reacted with this emoji
        var existingReaction = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId && r.Emoji == emoji);

        if (existingReaction != null)
        {
            // Already reacted with this emoji, just return the message
            return await GetMessageDtoAsync(messageId);
        }

        var reaction = new Reaction
        {
            Id = Guid.NewGuid(),
            MessageId = messageId,
            UserId = userId,
            Emoji = emoji
        };

        _context.Reactions.Add(reaction);
        await _context.SaveChangesAsync();

        return await GetMessageDtoAsync(messageId);
    }

    public async Task<MessageDto> RemoveReactionAsync(Guid messageId, Guid userId, string emoji)
    {
        var message = await _context.Messages
            .Include(m => m.Chat)
            .FirstOrDefaultAsync(m => m.Id == messageId);

        if (message == null)
        {
            throw new NotFoundException("Message not found");
        }

        if (!await _chatService.IsMemberAsync(message.ChatId, userId))
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        var reaction = await _context.Reactions
            .FirstOrDefaultAsync(r => r.MessageId == messageId && r.UserId == userId && r.Emoji == emoji);

        if (reaction != null)
        {
            _context.Reactions.Remove(reaction);
            await _context.SaveChangesAsync();
        }

        return await GetMessageDtoAsync(messageId);
    }

    private async Task<MessageDto> GetMessageDtoAsync(Guid messageId)
    {
        var message = await _context.Messages
            .Include(m => m.Sender)
            .Include(m => m.File)
            .Include(m => m.ReplyTo)
                .ThenInclude(r => r!.Sender)
            .Include(m => m.Reactions)
            .FirstAsync(m => m.Id == messageId);

        return new MessageDto
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
            Status = MessageStatus.Sent,
            Reactions = message.Reactions
                .GroupBy(r => r.Emoji)
                .Select(g => new ReactionDto
                {
                    Emoji = g.Key,
                    Count = g.Count(),
                    UserIds = g.Select(r => r.UserId).ToList()
                })
                .ToList(),
            File = message.File != null ? new FileDto
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
            } : null
        };
    }
}
