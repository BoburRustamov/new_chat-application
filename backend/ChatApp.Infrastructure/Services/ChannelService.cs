using System.Security.Cryptography;
using ChatApp.Core.DTOs.Channel;
using ChatApp.Core.DTOs.User;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class ChannelService : IChannelService
{
    private readonly AppDbContext _context;

    public ChannelService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ChannelDto> CreateChannelAsync(Guid userId, CreateChannelRequest request)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        // Validate username uniqueness (case-insensitive)
        var usernameExists = await _context.Channels
            .AnyAsync(c => c.Username != null && c.Username.ToLower() == request.Username.ToLower());

        if (usernameExists)
        {
            throw new ConflictException("Channel username already taken");
        }

        // Create Chat first
        var chat = new Chat
        {
            Id = Guid.NewGuid(),
            Type = ChatType.Channel,
            Name = request.Name,
            Description = request.Description,
            CreatedById = userId
        };

        // Handle avatar
        if (request.AvatarFileId.HasValue)
        {
            var file = await _context.Files.FindAsync(request.AvatarFileId.Value);
            if (file != null)
            {
                chat.AvatarUrl = $"/api/files/{file.Id}/download";
            }
        }

        // Create Channel entity
        var channel = new Channel
        {
            Id = Guid.NewGuid(),
            ChatId = chat.Id,
            Username = request.Username,
            IsPublic = request.IsPublic,
            SubscriberCount = 1 // Creator is first subscriber
        };

        // Add creator as Owner
        var member = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = chat.Id,
            UserId = userId,
            Role = MemberRole.Owner
        };

        _context.Chats.Add(chat);
        _context.Channels.Add(channel);
        _context.ChatMembers.Add(member);
        await _context.SaveChangesAsync();

        return await GetChannelAsync(channel.Id, userId);
    }

    public async Task<ChannelDto> GetChannelAsync(Guid channelId, Guid? userId = null)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.CreatedBy)
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        return MapToDto(channel, userId);
    }

    public async Task<ChannelDto?> GetChannelByUsernameAsync(string username, Guid? userId = null)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.CreatedBy)
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Username != null && c.Username.ToLower() == username.ToLower());

        if (channel == null)
        {
            return null;
        }

        return MapToDto(channel, userId);
    }

    public async Task<ChannelDto> UpdateChannelAsync(Guid channelId, Guid userId, UpdateChannelRequest request)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if user is admin or owner
        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin))
        {
            throw new ForbiddenException("You don't have permission to update this channel");
        }

        // Update name
        if (!string.IsNullOrEmpty(request.Name))
        {
            channel.Chat.Name = request.Name;
        }

        // Update description
        if (request.Description != null)
        {
            channel.Chat.Description = request.Description;
        }

        // Update username (validate uniqueness)
        if (!string.IsNullOrEmpty(request.Username) && request.Username != channel.Username)
        {
            var usernameExists = await _context.Channels
                .AnyAsync(c => c.Id != channelId && c.Username != null && c.Username.ToLower() == request.Username.ToLower());

            if (usernameExists)
            {
                throw new ConflictException("Channel username already taken");
            }
            channel.Username = request.Username;
        }

        // Update visibility
        if (request.IsPublic.HasValue)
        {
            channel.IsPublic = request.IsPublic.Value;
        }

        // Update avatar
        if (request.AvatarFileId.HasValue)
        {
            var file = await _context.Files.FindAsync(request.AvatarFileId.Value);
            if (file != null)
            {
                channel.Chat.AvatarUrl = $"/api/files/{file.Id}/download";
            }
        }

        await _context.SaveChangesAsync();

        return await GetChannelAsync(channelId, userId);
    }

    public async Task DeleteChannelAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Only owner can delete
        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || member.Role != MemberRole.Owner)
        {
            throw new ForbiddenException("Only the owner can delete this channel");
        }

        // Deleting chat will cascade delete channel
        _context.Chats.Remove(channel.Chat);
        await _context.SaveChangesAsync();
    }

    public async Task<ChannelDto> SubscribeAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if already subscribed
        if (channel.Chat.Members.Any(m => m.UserId == userId))
        {
            throw new ConflictException("Already subscribed to this channel");
        }

        // Private channels require invite
        if (!channel.IsPublic)
        {
            throw new ForbiddenException("This channel is private. Use an invite link to join.");
        }

        // Add as subscriber (Member role)
        var member = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = channel.ChatId,
            UserId = userId,
            Role = MemberRole.Member
        };

        _context.ChatMembers.Add(member);
        channel.SubscriberCount++;
        await _context.SaveChangesAsync();

        return await GetChannelAsync(channelId, userId);
    }

    public async Task UnsubscribeAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            throw new NotFoundException("Not subscribed to this channel");
        }

        // Owner cannot unsubscribe
        if (member.Role == MemberRole.Owner)
        {
            throw new ForbiddenException("Owner cannot unsubscribe. Transfer ownership or delete the channel.");
        }

        _context.ChatMembers.Remove(member);
        channel.SubscriberCount = Math.Max(0, channel.SubscriberCount - 1);
        await _context.SaveChangesAsync();
    }

    public async Task<List<UserDto>> GetSubscribersAsync(Guid channelId, int page = 1, int pageSize = 50)
    {
        var channel = await _context.Channels.FindAsync(channelId);
        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        var subscribers = await _context.ChatMembers
            .Include(m => m.User)
            .Where(m => m.ChatId == channel.ChatId)
            .OrderBy(m => m.JoinedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new UserDto
            {
                Id = m.User.Id,
                Email = m.User.Email,
                Username = m.User.Username,
                DisplayName = m.User.DisplayName,
                AvatarUrl = m.User.AvatarUrl,
                Bio = m.User.Bio,
                IsOnline = m.User.IsOnline,
                LastSeenAt = m.User.LastSeenAt,
                CreatedAt = m.User.CreatedAt
            })
            .ToListAsync();

        return subscribers;
    }

    public async Task<List<ChannelDto>> GetUserSubscriptionsAsync(Guid userId)
    {
        var channels = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.CreatedBy)
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .Where(c => c.Chat.Members.Any(m => m.UserId == userId && !m.IsBanned))
            .OrderByDescending(c => c.Chat.UpdatedAt)
            .ToListAsync();

        return channels.Select(c => MapToDto(c, userId)).ToList();
    }

    public async Task AddAdminAsync(Guid channelId, Guid adminUserId, Guid targetUserId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if requester is owner or admin
        var adminMember = channel.Chat.Members.FirstOrDefault(m => m.UserId == adminUserId);
        if (adminMember == null || adminMember.Role != MemberRole.Owner)
        {
            throw new ForbiddenException("Only the owner can add admins");
        }

        // Check if target is a member
        var targetMember = channel.Chat.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember == null)
        {
            throw new NotFoundException("User is not a subscriber of this channel");
        }

        if (targetMember.Role == MemberRole.Owner)
        {
            throw new BadRequestException("Cannot change owner's role");
        }

        targetMember.Role = MemberRole.Admin;
        await _context.SaveChangesAsync();
    }

    public async Task RemoveAdminAsync(Guid channelId, Guid adminUserId, Guid targetUserId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if requester is owner
        var adminMember = channel.Chat.Members.FirstOrDefault(m => m.UserId == adminUserId);
        if (adminMember == null || adminMember.Role != MemberRole.Owner)
        {
            throw new ForbiddenException("Only the owner can remove admins");
        }

        // Check if target is an admin
        var targetMember = channel.Chat.Members.FirstOrDefault(m => m.UserId == targetUserId);
        if (targetMember == null)
        {
            throw new NotFoundException("User is not a subscriber of this channel");
        }

        if (targetMember.Role == MemberRole.Owner)
        {
            throw new BadRequestException("Cannot change owner's role");
        }

        targetMember.Role = MemberRole.Member;
        await _context.SaveChangesAsync();
    }

    public async Task<List<UserDto>> GetAdminsAsync(Guid channelId)
    {
        var channel = await _context.Channels.FindAsync(channelId);
        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        var admins = await _context.ChatMembers
            .Include(m => m.User)
            .Where(m => m.ChatId == channel.ChatId && (m.Role == MemberRole.Owner || m.Role == MemberRole.Admin))
            .Select(m => new UserDto
            {
                Id = m.User.Id,
                Email = m.User.Email,
                Username = m.User.Username,
                DisplayName = m.User.DisplayName,
                AvatarUrl = m.User.AvatarUrl,
                Bio = m.User.Bio,
                IsOnline = m.User.IsOnline,
                LastSeenAt = m.User.LastSeenAt,
                CreatedAt = m.User.CreatedAt
            })
            .ToListAsync();

        return admins;
    }

    public async Task<List<ChannelSearchResult>> SearchPublicChannelsAsync(string query, int page = 1, int pageSize = 20)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return new List<ChannelSearchResult>();
        }

        var loweredQuery = query.ToLower();

        var channels = await _context.Channels
            .Include(c => c.Chat)
            .Where(c => c.IsPublic)
            .Where(c =>
                (c.Chat.Name != null && c.Chat.Name.ToLower().Contains(loweredQuery)) ||
                (c.Username != null && c.Username.ToLower().Contains(loweredQuery)) ||
                (c.Chat.Description != null && c.Chat.Description.ToLower().Contains(loweredQuery)))
            .OrderByDescending(c => c.SubscriberCount)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new ChannelSearchResult
            {
                Id = c.Id,
                Name = c.Chat.Name ?? "",
                Username = c.Username ?? "",
                AvatarUrl = c.Chat.AvatarUrl,
                SubscriberCount = c.SubscriberCount,
                Description = c.Chat.Description != null && c.Chat.Description.Length > 100
                    ? c.Chat.Description.Substring(0, 100) + "..."
                    : c.Chat.Description
            })
            .ToListAsync();

        return channels;
    }

    public async Task<List<ChannelSearchResult>> GetPopularChannelsAsync(int count = 20)
    {
        var channels = await _context.Channels
            .Include(c => c.Chat)
            .Where(c => c.IsPublic)
            .OrderByDescending(c => c.SubscriberCount)
            .Take(count)
            .Select(c => new ChannelSearchResult
            {
                Id = c.Id,
                Name = c.Chat.Name ?? "",
                Username = c.Username ?? "",
                AvatarUrl = c.Chat.AvatarUrl,
                SubscriberCount = c.SubscriberCount,
                Description = c.Chat.Description != null && c.Chat.Description.Length > 100
                    ? c.Chat.Description.Substring(0, 100) + "..."
                    : c.Chat.Description
            })
            .ToListAsync();

        return channels;
    }

    public async Task<ChannelInviteLinkDto> GenerateInviteLinkAsync(Guid channelId, Guid userId, int? expiresInHours = null, int? usageLimit = null)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if user is admin or owner
        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin))
        {
            throw new ForbiddenException("You don't have permission to generate invite links");
        }

        // Generate new invite code
        channel.InviteCode = GenerateInviteCode();
        channel.InviteCodeCreatedAt = DateTime.UtcNow;
        channel.InviteCodeExpiresAt = expiresInHours.HasValue
            ? DateTime.UtcNow.AddHours(expiresInHours.Value)
            : null;
        channel.InviteUsageLimit = usageLimit;
        channel.InviteUsageCount = 0;

        await _context.SaveChangesAsync();

        return new ChannelInviteLinkDto
        {
            ChannelId = channel.Id,
            InviteCode = channel.InviteCode,
            InviteLink = $"/join/{channel.InviteCode}",
            CreatedAt = channel.InviteCodeCreatedAt.Value,
            ExpiresAt = channel.InviteCodeExpiresAt,
            UsageLimit = channel.InviteUsageLimit,
            UsageCount = channel.InviteUsageCount
        };
    }

    public async Task<ChannelDto> JoinByInviteCodeAsync(string inviteCode, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.InviteCode == inviteCode);

        if (channel == null)
        {
            throw new NotFoundException("Invalid invite code");
        }

        // Check if invite is expired
        if (channel.InviteCodeExpiresAt.HasValue && channel.InviteCodeExpiresAt.Value < DateTime.UtcNow)
        {
            throw new BadRequestException("Invite link has expired");
        }

        // Check if usage limit reached
        if (channel.InviteUsageLimit.HasValue && channel.InviteUsageCount >= channel.InviteUsageLimit.Value)
        {
            throw new BadRequestException("Invite link usage limit reached");
        }

        // Check if already subscribed
        if (channel.Chat.Members.Any(m => m.UserId == userId))
        {
            // Already a member, just return the channel
            return await GetChannelAsync(channel.Id, userId);
        }

        // Add as subscriber
        var member = new ChatMember
        {
            Id = Guid.NewGuid(),
            ChatId = channel.ChatId,
            UserId = userId,
            Role = MemberRole.Member
        };

        _context.ChatMembers.Add(member);
        channel.SubscriberCount++;
        channel.InviteUsageCount++;
        await _context.SaveChangesAsync();

        return await GetChannelAsync(channel.Id, userId);
    }

    public async Task RevokeInviteLinkAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if user is admin or owner
        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin))
        {
            throw new ForbiddenException("You don't have permission to revoke invite links");
        }

        channel.InviteCode = null;
        channel.InviteCodeCreatedAt = null;
        channel.InviteCodeExpiresAt = null;
        channel.InviteUsageLimit = null;
        channel.InviteUsageCount = 0;

        await _context.SaveChangesAsync();
    }

    public async Task<ChannelInviteLinkDto?> GetInviteLinkAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            throw new NotFoundException("Channel not found");
        }

        // Check if user is admin or owner
        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || (member.Role != MemberRole.Owner && member.Role != MemberRole.Admin))
        {
            throw new ForbiddenException("You don't have permission to view invite links");
        }

        if (string.IsNullOrEmpty(channel.InviteCode))
        {
            return null;
        }

        return new ChannelInviteLinkDto
        {
            ChannelId = channel.Id,
            InviteCode = channel.InviteCode,
            InviteLink = $"/join/{channel.InviteCode}",
            CreatedAt = channel.InviteCodeCreatedAt ?? DateTime.UtcNow,
            ExpiresAt = channel.InviteCodeExpiresAt,
            UsageLimit = channel.InviteUsageLimit,
            UsageCount = channel.InviteUsageCount
        };
    }

    public async Task<bool> CanPostAsync(Guid channelId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.Id == channelId);

        if (channel == null)
        {
            return false;
        }

        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || member.IsBanned)
        {
            return false;
        }

        // Only Owner and Admin can post in channels
        return member.Role == MemberRole.Owner || member.Role == MemberRole.Admin;
    }

    public async Task<bool> CanPostByChatIdAsync(Guid chatId, Guid userId)
    {
        var channel = await _context.Channels
            .Include(c => c.Chat)
                .ThenInclude(ch => ch.Members)
            .FirstOrDefaultAsync(c => c.ChatId == chatId);

        if (channel == null)
        {
            return true; // Not a channel, allow posting
        }

        var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId);
        if (member == null || member.IsBanned)
        {
            return false;
        }

        // Only Owner and Admin can post in channels
        return member.Role == MemberRole.Owner || member.Role == MemberRole.Admin;
    }

    public async Task<bool> IsChannelAsync(Guid chatId)
    {
        return await _context.Channels.AnyAsync(c => c.ChatId == chatId);
    }

    private ChannelDto MapToDto(Channel channel, Guid? userId)
    {
        var isSubscribed = false;
        MemberRole? userRole = null;

        if (userId.HasValue)
        {
            var member = channel.Chat.Members.FirstOrDefault(m => m.UserId == userId.Value);
            if (member != null && !member.IsBanned)
            {
                isSubscribed = true;
                userRole = member.Role;
            }
        }

        return new ChannelDto
        {
            Id = channel.Id,
            ChatId = channel.ChatId,
            Name = channel.Chat.Name ?? "",
            Description = channel.Chat.Description,
            Username = channel.Username ?? "",
            AvatarUrl = channel.Chat.AvatarUrl,
            IsPublic = channel.IsPublic,
            SubscriberCount = channel.SubscriberCount,
            CreatedAt = channel.Chat.CreatedAt,
            CreatedBy = channel.Chat.CreatedBy != null ? new UserDto
            {
                Id = channel.Chat.CreatedBy.Id,
                Email = channel.Chat.CreatedBy.Email,
                Username = channel.Chat.CreatedBy.Username,
                DisplayName = channel.Chat.CreatedBy.DisplayName,
                AvatarUrl = channel.Chat.CreatedBy.AvatarUrl,
                IsOnline = channel.Chat.CreatedBy.IsOnline,
                LastSeenAt = channel.Chat.CreatedBy.LastSeenAt,
                CreatedAt = channel.Chat.CreatedBy.CreatedAt
            } : null,
            IsSubscribed = isSubscribed,
            UserRole = userRole
        };
    }

    private static string GenerateInviteCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        var code = new char[16];
        using var rng = RandomNumberGenerator.Create();
        var data = new byte[16];
        rng.GetBytes(data);

        for (int i = 0; i < 16; i++)
        {
            code[i] = chars[data[i] % chars.Length];
        }

        return new string(code);
    }
}
