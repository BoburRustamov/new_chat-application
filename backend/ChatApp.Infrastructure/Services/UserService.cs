using ChatApp.Core.DTOs.Common;
using ChatApp.Core.DTOs.User;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _context;

    public UserService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        var user = await _context.Users.FindAsync(id);
        return user == null ? null : MapToDto(user);
    }

    public async Task<UserDto?> GetByUsernameAsync(string username)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
        return user == null ? null : MapToDto(user);
    }

    public async Task<PagedResponse<UserDto>> SearchUsersAsync(string query, Guid excludeUserId, int page = 1, int pageSize = 20)
    {
        var queryLower = query.ToLower();

        var usersQuery = _context.Users
            .Where(u => u.Id != excludeUserId)
            .Where(u => u.Username.ToLower().Contains(queryLower) ||
                       u.DisplayName.ToLower().Contains(queryLower) ||
                       u.Email.ToLower().Contains(queryLower));

        var totalCount = await usersQuery.CountAsync();

        var users = await usersQuery
            .OrderBy(u => u.DisplayName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponse<UserDto>
        {
            Items = users.Select(MapToDto).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        if (request.DisplayName != null)
            user.DisplayName = request.DisplayName;

        if (request.Bio != null)
            user.Bio = request.Bio;

        // Handle avatar - AvatarFileId takes precedence over AvatarUrl
        if (request.AvatarFileId.HasValue)
        {
            // Verify the file exists
            var file = await _context.Files.FindAsync(request.AvatarFileId.Value);
            if (file == null)
            {
                throw new NotFoundException("Avatar file not found");
            }
            user.AvatarUrl = $"/api/files/{request.AvatarFileId.Value}";
        }
        else if (request.AvatarUrl != null)
        {
            user.AvatarUrl = request.AvatarUrl;
        }

        await _context.SaveChangesAsync();
        return MapToDto(user);
    }

    public async Task UpdateOnlineStatusAsync(Guid userId, bool isOnline)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user != null)
        {
            user.IsOnline = isOnline;
            if (!isOnline)
            {
                user.LastSeenAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
        }
    }

    public async Task UpdateNotificationSettingsAsync(Guid userId, NotificationSettingsRequest request)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        user.PushNotificationsEnabled = request.PushEnabled;
        user.EmailNotificationsEnabled = request.EmailEnabled;
        user.SoundEnabled = request.SoundEnabled;

        await _context.SaveChangesAsync();
    }

    public async Task UpdatePrivacySettingsAsync(Guid userId, PrivacySettingsRequest request)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        user.ShowOnlineStatus = request.ShowOnlineStatus;
        user.ShowLastSeen = request.ShowLastSeen;
        user.ShowReadReceipts = request.ShowReadReceipts;

        await _context.SaveChangesAsync();
    }

    public async Task<PagedResponse<UserDto>> GetAllUsersAsync(int page = 1, int pageSize = 20, string? search = null)
    {
        var query = _context.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(u => u.Username.ToLower().Contains(searchLower) ||
                                    u.DisplayName.ToLower().Contains(searchLower) ||
                                    u.Email.ToLower().Contains(searchLower));
        }

        var totalCount = await query.CountAsync();

        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PagedResponse<UserDto>
        {
            Items = users.Select(MapToDto).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount
        };
    }

    public async Task<int> GetTotalUsersCountAsync()
    {
        return await _context.Users.CountAsync();
    }

    public async Task<int> GetOnlineUsersCountAsync()
    {
        return await _context.Users.CountAsync(u => u.IsOnline);
    }

    public async Task DeleteUserAsync(Guid userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found");
        }

        _context.Users.Remove(user);
        await _context.SaveChangesAsync();
    }

    public async Task<int> DeleteAllUsersAsync()
    {
        var users = await _context.Users.ToListAsync();
        var count = users.Count;

        if (count > 0)
        {
            _context.Users.RemoveRange(users);
            await _context.SaveChangesAsync();
        }

        return count;
    }

    private static UserDto MapToDto(Core.Entities.User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            Username = user.Username,
            DisplayName = user.DisplayName,
            AvatarUrl = user.AvatarUrl,
            Bio = user.Bio,
            IsOnline = user.IsOnline,
            LastSeenAt = user.LastSeenAt,
            CreatedAt = user.CreatedAt,
            // Notification settings
            PushNotificationsEnabled = user.PushNotificationsEnabled,
            EmailNotificationsEnabled = user.EmailNotificationsEnabled,
            SoundEnabled = user.SoundEnabled,
            // Privacy settings
            ShowOnlineStatus = user.ShowOnlineStatus,
            ShowLastSeen = user.ShowLastSeen,
            ShowReadReceipts = user.ShowReadReceipts
        };
    }
}
