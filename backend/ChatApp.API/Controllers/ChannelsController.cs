using System.Security.Claims;
using ChatApp.Core.DTOs.Channel;
using ChatApp.Core.DTOs.User;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChannelsController : ControllerBase
{
    private readonly IChannelService _channelService;

    public ChannelsController(IChannelService channelService)
    {
        _channelService = channelService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    /// <summary>
    /// Get all channels the current user is subscribed to
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<ChannelDto>>> GetUserChannels()
    {
        var userId = GetCurrentUserId();
        var channels = await _channelService.GetUserSubscriptionsAsync(userId);
        return Ok(channels);
    }

    /// <summary>
    /// Get a channel by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ChannelDto>> GetChannel(Guid id)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.GetChannelAsync(id, userId);
        return Ok(channel);
    }

    /// <summary>
    /// Get a channel by username
    /// </summary>
    [HttpGet("username/{username}")]
    public async Task<ActionResult<ChannelDto>> GetChannelByUsername(string username)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.GetChannelByUsernameAsync(username, userId);

        if (channel == null)
            return NotFound();

        return Ok(channel);
    }

    /// <summary>
    /// Create a new channel
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ChannelDto>> CreateChannel([FromBody] CreateChannelRequest request)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.CreateChannelAsync(userId, request);
        return CreatedAtAction(nameof(GetChannel), new { id = channel.Id }, channel);
    }

    /// <summary>
    /// Update a channel
    /// </summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ChannelDto>> UpdateChannel(Guid id, [FromBody] UpdateChannelRequest request)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.UpdateChannelAsync(id, userId, request);
        return Ok(channel);
    }

    /// <summary>
    /// Delete a channel
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteChannel(Guid id)
    {
        var userId = GetCurrentUserId();
        await _channelService.DeleteChannelAsync(id, userId);
        return NoContent();
    }

    /// <summary>
    /// Subscribe to a public channel
    /// </summary>
    [HttpPost("{id:guid}/subscribe")]
    public async Task<ActionResult<ChannelDto>> Subscribe(Guid id)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.SubscribeAsync(id, userId);
        return Ok(channel);
    }

    /// <summary>
    /// Unsubscribe from a channel
    /// </summary>
    [HttpDelete("{id:guid}/subscribe")]
    public async Task<IActionResult> Unsubscribe(Guid id)
    {
        var userId = GetCurrentUserId();
        await _channelService.UnsubscribeAsync(id, userId);
        return NoContent();
    }

    /// <summary>
    /// Get subscribers of a channel
    /// </summary>
    [HttpGet("{id:guid}/subscribers")]
    public async Task<ActionResult<List<UserDto>>> GetSubscribers(Guid id, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var subscribers = await _channelService.GetSubscribersAsync(id, page, pageSize);
        return Ok(subscribers);
    }

    /// <summary>
    /// Add an admin to the channel
    /// </summary>
    [HttpPost("{id:guid}/admins/{userId:guid}")]
    public async Task<IActionResult> AddAdmin(Guid id, Guid userId)
    {
        var currentUserId = GetCurrentUserId();
        await _channelService.AddAdminAsync(id, currentUserId, userId);
        return NoContent();
    }

    /// <summary>
    /// Remove an admin from the channel
    /// </summary>
    [HttpDelete("{id:guid}/admins/{userId:guid}")]
    public async Task<IActionResult> RemoveAdmin(Guid id, Guid userId)
    {
        var currentUserId = GetCurrentUserId();
        await _channelService.RemoveAdminAsync(id, currentUserId, userId);
        return NoContent();
    }

    /// <summary>
    /// Get all admins of a channel
    /// </summary>
    [HttpGet("{id:guid}/admins")]
    public async Task<ActionResult<List<UserDto>>> GetAdmins(Guid id)
    {
        var admins = await _channelService.GetAdminsAsync(id);
        return Ok(admins);
    }

    /// <summary>
    /// Search public channels
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<List<ChannelSearchResult>>> SearchPublicChannels(
        [FromQuery] string query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var channels = await _channelService.SearchPublicChannelsAsync(query, page, pageSize);
        return Ok(channels);
    }

    /// <summary>
    /// Get popular public channels
    /// </summary>
    [HttpGet("popular")]
    public async Task<ActionResult<List<ChannelSearchResult>>> GetPopularChannels([FromQuery] int count = 20)
    {
        var channels = await _channelService.GetPopularChannelsAsync(count);
        return Ok(channels);
    }

    /// <summary>
    /// Generate an invite link for a channel
    /// </summary>
    [HttpPost("{id:guid}/invite")]
    public async Task<ActionResult<ChannelInviteLinkDto>> GenerateInviteLink(
        Guid id,
        [FromBody] GenerateInviteLinkRequest? request)
    {
        var userId = GetCurrentUserId();
        var inviteLink = await _channelService.GenerateInviteLinkAsync(
            id,
            userId,
            request?.ExpiresInHours,
            request?.UsageLimit);
        return Ok(inviteLink);
    }

    /// <summary>
    /// Get the current invite link for a channel
    /// </summary>
    [HttpGet("{id:guid}/invite")]
    public async Task<ActionResult<ChannelInviteLinkDto>> GetInviteLink(Guid id)
    {
        var userId = GetCurrentUserId();
        var inviteLink = await _channelService.GetInviteLinkAsync(id, userId);

        if (inviteLink == null)
            return NotFound("No active invite link");

        return Ok(inviteLink);
    }

    /// <summary>
    /// Revoke the invite link for a channel
    /// </summary>
    [HttpDelete("{id:guid}/invite")]
    public async Task<IActionResult> RevokeInviteLink(Guid id)
    {
        var userId = GetCurrentUserId();
        await _channelService.RevokeInviteLinkAsync(id, userId);
        return NoContent();
    }

    /// <summary>
    /// Join a channel using an invite code
    /// </summary>
    [HttpPost("join/{inviteCode}")]
    public async Task<ActionResult<ChannelDto>> JoinByInviteCode(string inviteCode)
    {
        var userId = GetCurrentUserId();
        var channel = await _channelService.JoinByInviteCodeAsync(inviteCode, userId);
        return Ok(channel);
    }

    /// <summary>
    /// Check if the current user can post in a channel
    /// </summary>
    [HttpGet("{id:guid}/can-post")]
    public async Task<ActionResult<bool>> CanPost(Guid id)
    {
        var userId = GetCurrentUserId();
        var canPost = await _channelService.CanPostAsync(id, userId);
        return Ok(canPost);
    }
}
