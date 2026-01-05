using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class ChatService : IChatService
{
    private readonly AppDbContext _context;

    public ChatService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ChatDto?> GetByIdAsync(Guid chatId, Guid userId)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                .ThenInclude(m => m.Sender)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null) return null;

        // Check if user is a member
        if (!chat.Members.Any(m => m.UserId == userId && !m.IsBanned))
            return null;

        return MapToDto(chat, userId);
    }

    public async Task<List<ChatDto>> GetUserChatsAsync(Guid userId)
    {
        var chats = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                .ThenInclude(m => m.Sender)
            .Where(c => c.Members.Any(m => m.UserId == userId && !m.IsBanned))
            .OrderByDescending(c => c.Messages.Max(m => (DateTime?)m.CreatedAt) ?? c.CreatedAt)
            .ToListAsync();

        return chats.Select(c => MapToDto(c, userId)).ToList();
    }

    public async Task<ChatDto> CreatePrivateChatAsync(Guid userId, Guid otherUserId)
    {
        if (userId == otherUserId)
        {
            throw new BadRequestException("Cannot create a chat with yourself");
        }

        // Check if both users exist
        var user = await _context.Users.FindAsync(userId);
        var otherUser = await _context.Users.FindAsync(otherUserId);

        if (user == null || otherUser == null)
        {
            throw new NotFoundException("User not found");
        }

        // Check if private chat already exists
        var existingChat = await GetPrivateChatAsync(userId, otherUserId);
        if (existingChat != null)
        {
            return existingChat;
        }

        // Create new private chat
        var chat = new Chat
        {
            Id = Guid.NewGuid(),
            Type = ChatType.Private,
            CreatedById = userId
        };

        var member1 = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = chat.Id,
            UserId = userId,
            Role = MemberRole.Member
        };

        var member2 = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = chat.Id,
            UserId = otherUserId,
            Role = MemberRole.Member
        };

        _context.Chats.Add(chat);
        _context.ChatMembers.Add(member1);
        _context.ChatMembers.Add(member2);
        await _context.SaveChangesAsync();

        // Reload with includes
        return (await GetByIdAsync(chat.Id, userId))!;
    }

    public async Task<ChatDto> CreateGroupChatAsync(Guid creatorId, string name, string? description, List<Guid> memberIds)
    {
        var creator = await _context.Users.FindAsync(creatorId);
        if (creator == null)
        {
            throw new NotFoundException("User not found");
        }

        // Ensure creator is in the member list
        if (!memberIds.Contains(creatorId))
        {
            memberIds.Add(creatorId);
        }

        // Verify all members exist
        var existingUserIds = await _context.Users
            .Where(u => memberIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync();

        if (existingUserIds.Count != memberIds.Count)
        {
            throw new BadRequestException("One or more users do not exist");
        }

        var chat = new Chat
        {
            Id = Guid.NewGuid(),
            Type = ChatType.Group,
            Name = name,
            Description = description,
            CreatedById = creatorId
        };

        _context.Chats.Add(chat);

        foreach (var memberId in memberIds)
        {
            var member = new ChatMember
            {
                Id = Guid.NewGuid(),
                ChatId = chat.Id,
                UserId = memberId,
                Role = memberId == creatorId ? MemberRole.Owner : MemberRole.Member
            };
            _context.ChatMembers.Add(member);
        }

        await _context.SaveChangesAsync();

        return (await GetByIdAsync(chat.Id, creatorId))!;
    }

    public async Task<ChatDto?> GetPrivateChatAsync(Guid userId1, Guid userId2)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
                .ThenInclude(m => m.User)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1))
                .ThenInclude(m => m.Sender)
            .Where(c => c.Type == ChatType.Private)
            .Where(c => c.Members.Any(m => m.UserId == userId1) &&
                       c.Members.Any(m => m.UserId == userId2))
            .FirstOrDefaultAsync();

        return chat == null ? null : MapToDto(chat, userId1);
    }

    public async Task<bool> IsMemberAsync(Guid chatId, Guid userId)
    {
        return await _context.ChatMembers
            .AnyAsync(m => m.ChatId == chatId && m.UserId == userId && !m.IsBanned);
    }

    public async Task AddMemberAsync(Guid chatId, Guid userId, Guid addedById)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null)
        {
            throw new NotFoundException("Chat not found");
        }

        if (chat.Type == ChatType.Private)
        {
            throw new BadRequestException("Cannot add members to a private chat");
        }

        var addedByMember = chat.Members.FirstOrDefault(m => m.UserId == addedById);
        if (addedByMember == null || addedByMember.IsBanned)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // Only owner or admin can add members
        if (addedByMember.Role != MemberRole.Owner && addedByMember.Role != MemberRole.Admin)
        {
            throw new ForbiddenException("You don't have permission to add members");
        }

        if (chat.Members.Any(m => m.UserId == userId))
        {
            throw new ConflictException("User is already a member");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        var member = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = chatId,
            UserId = userId,
            Role = MemberRole.Member
        };

        _context.ChatMembers.Add(member);
        await _context.SaveChangesAsync();
    }

    public async Task RemoveMemberAsync(Guid chatId, Guid userId, Guid removedById)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null)
        {
            throw new NotFoundException("Chat not found");
        }

        if (chat.Type == ChatType.Private)
        {
            throw new BadRequestException("Cannot remove members from a private chat");
        }

        var removedByMember = chat.Members.FirstOrDefault(m => m.UserId == removedById);
        if (removedByMember == null || removedByMember.IsBanned)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        var memberToRemove = chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (memberToRemove == null)
        {
            throw new NotFoundException("User is not a member of this chat");
        }

        // Only owner/admin can remove others, but anyone can leave
        if (userId != removedById)
        {
            if (removedByMember.Role != MemberRole.Owner && removedByMember.Role != MemberRole.Admin)
            {
                throw new ForbiddenException("You don't have permission to remove members");
            }

            // Can't remove owner
            if (memberToRemove.Role == MemberRole.Owner)
            {
                throw new ForbiddenException("Cannot remove the owner");
            }
        }

        _context.ChatMembers.Remove(memberToRemove);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateLastReadAsync(Guid chatId, Guid userId, Guid messageId)
    {
        var member = await _context.ChatMembers
            .FirstOrDefaultAsync(m => m.ChatId == chatId && m.UserId == userId);

        if (member != null)
        {
            member.LastReadMessageId = messageId;
            member.LastReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }

    public async Task<ChatDto> UpdateChatAsync(Guid chatId, Guid userId, string? name, string? description, Guid? avatarFileId)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null)
        {
            throw new NotFoundException("Chat not found");
        }

        if (chat.Type == ChatType.Private)
        {
            throw new BadRequestException("Cannot update private chat settings");
        }

        var member = chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || member.IsBanned)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        if (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin)
        {
            throw new ForbiddenException("You don't have permission to update chat settings");
        }

        if (name != null)
        {
            chat.Name = name;
        }

        if (description != null)
        {
            chat.Description = description;
        }

        if (avatarFileId.HasValue)
        {
            var file = await _context.Files.FindAsync(avatarFileId.Value);
            if (file != null)
            {
                chat.AvatarUrl = $"/api/files/{file.Id}/download";
            }
        }

        await _context.SaveChangesAsync();

        return (await GetByIdAsync(chatId, userId))!;
    }

    public async Task DeleteChatAsync(Guid chatId, Guid userId)
    {
        var chat = await _context.Chats
            .Include(c => c.Members)
            .FirstOrDefaultAsync(c => c.Id == chatId);

        if (chat == null)
        {
            throw new NotFoundException("Chat not found");
        }

        var member = chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        // For private chats, any member can delete
        // For group chats, only owner can delete
        if (chat.Type == ChatType.Group && member.Role != MemberRole.Owner)
        {
            throw new ForbiddenException("Only the owner can delete this chat");
        }

        _context.Chats.Remove(chat);
        await _context.SaveChangesAsync();
    }

    public async Task SetMutedAsync(Guid chatId, Guid userId, bool muted)
    {
        var member = await _context.ChatMembers
            .FirstOrDefaultAsync(m => m.ChatId == chatId && m.UserId == userId);

        if (member == null)
        {
            throw new ForbiddenException("You are not a member of this chat");
        }

        member.IsMuted = muted;
        await _context.SaveChangesAsync();
    }

    public async Task<int> GetTotalChatsCountAsync()
    {
        return await _context.Chats.CountAsync();
    }

    public async Task<long> GetTotalMessagesCountAsync()
    {
        return await _context.Messages.LongCountAsync();
    }

    private ChatDto MapToDto(Chat chat, Guid currentUserId)
    {
        var currentMember = chat.Members.FirstOrDefault(m => m.UserId == currentUserId);
        var lastMessage = chat.Messages.FirstOrDefault();

        // For private chats, use the other user's info as name/avatar
        string? chatName = chat.Name;
        string? chatAvatar = chat.AvatarUrl;

        if (chat.Type == ChatType.Private)
        {
            var otherMember = chat.Members.FirstOrDefault(m => m.UserId != currentUserId);
            if (otherMember != null)
            {
                chatName = otherMember.User.DisplayName;
                chatAvatar = otherMember.User.AvatarUrl;
            }
        }

        // Calculate unread count
        var unreadCount = 0;
        if (currentMember != null && lastMessage != null)
        {
            if (currentMember.LastReadMessageId == null)
            {
                unreadCount = chat.Messages.Count(m => m.SenderId != currentUserId);
            }
            else if (currentMember.LastReadAt.HasValue)
            {
                unreadCount = chat.Messages.Count(m =>
                    m.SenderId != currentUserId &&
                    m.CreatedAt > currentMember.LastReadAt.Value);
            }
        }

        return new ChatDto
        {
            Id = chat.Id,
            Type = chat.Type,
            Name = chatName,
            Description = chat.Description,
            AvatarUrl = chatAvatar,
            CreatedAt = chat.CreatedAt,
            UpdatedAt = chat.UpdatedAt,
            UnreadCount = unreadCount,
            LastMessage = lastMessage != null ? MapMessageToDto(lastMessage) : null,
            Members = chat.Members.Select(m => new ChatMemberDto
            {
                Id = m.Id,
                UserId = m.UserId,
                Username = m.User.Username,
                DisplayName = m.User.DisplayName,
                AvatarUrl = m.User.AvatarUrl,
                Role = m.Role,
                JoinedAt = m.JoinedAt,
                IsOnline = m.User.IsOnline,
                LastSeenAt = m.User.LastSeenAt
            }).ToList()
        };
    }

    private static MessageDto MapMessageToDto(Message message)
    {
        return new MessageDto
        {
            Id = message.Id,
            ChatId = message.ChatId,
            SenderId = message.SenderId,
            SenderUsername = message.Sender?.Username ?? "",
            SenderDisplayName = message.Sender?.DisplayName ?? "",
            SenderAvatarUrl = message.Sender?.AvatarUrl,
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
            Status = MessageStatus.Sent
        };
    }
}
