using ChatApp.Core.DTOs.Channel;
using ChatApp.Core.DTOs.User;

namespace ChatApp.Core.Interfaces;

public interface IChannelService
{
    // Channel CRUD
    Task<ChannelDto> CreateChannelAsync(Guid userId, CreateChannelRequest request);
    Task<ChannelDto> GetChannelAsync(Guid channelId, Guid? userId = null);
    Task<ChannelDto?> GetChannelByUsernameAsync(string username, Guid? userId = null);
    Task<ChannelDto> UpdateChannelAsync(Guid channelId, Guid userId, UpdateChannelRequest request);
    Task DeleteChannelAsync(Guid channelId, Guid userId);

    // Subscription
    Task<ChannelDto> SubscribeAsync(Guid channelId, Guid userId);
    Task UnsubscribeAsync(Guid channelId, Guid userId);
    Task<List<UserDto>> GetSubscribersAsync(Guid channelId, int page = 1, int pageSize = 50);
    Task<List<ChannelDto>> GetUserSubscriptionsAsync(Guid userId);

    // Admin Management
    Task AddAdminAsync(Guid channelId, Guid adminUserId, Guid targetUserId);
    Task RemoveAdminAsync(Guid channelId, Guid adminUserId, Guid targetUserId);
    Task<List<UserDto>> GetAdminsAsync(Guid channelId);

    // Discovery
    Task<List<ChannelSearchResult>> SearchPublicChannelsAsync(string query, int page = 1, int pageSize = 20);
    Task<List<ChannelSearchResult>> GetPopularChannelsAsync(int count = 20);

    // Invite Links
    Task<ChannelInviteLinkDto> GenerateInviteLinkAsync(Guid channelId, Guid userId, int? expiresInHours = null, int? usageLimit = null);
    Task<ChannelDto> JoinByInviteCodeAsync(string inviteCode, Guid userId);
    Task RevokeInviteLinkAsync(Guid channelId, Guid userId);
    Task<ChannelInviteLinkDto?> GetInviteLinkAsync(Guid channelId, Guid userId);

    // Posting Permission Check
    Task<bool> CanPostAsync(Guid channelId, Guid userId);
    Task<bool> CanPostByChatIdAsync(Guid chatId, Guid userId);
    Task<bool> IsChannelAsync(Guid chatId);
}