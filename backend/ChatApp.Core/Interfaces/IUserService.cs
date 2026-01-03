using ChatApp.Core.DTOs.Common;
using ChatApp.Core.DTOs.User;

namespace ChatApp.Core.Interfaces;

public interface IUserService
{
    Task<UserDto?> GetByIdAsync(Guid id);
    Task<UserDto?> GetByUsernameAsync(string username);
    Task<PagedResponse<UserDto>> SearchUsersAsync(string query, Guid excludeUserId, int page = 1, int pageSize = 20);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest request);
    Task UpdateOnlineStatusAsync(Guid userId, bool isOnline);
}
