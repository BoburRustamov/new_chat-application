using System.Security.Claims;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.DTOs.Common;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly IMessageService _messageService;
    private readonly IChannelService _channelService;

    public MessagesController(IMessageService messageService, IChannelService channelService)
    {
        _messageService = messageService;
        _channelService = channelService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpGet("chat/{chatId:guid}")]
    public async Task<ActionResult<PagedResponse<MessageDto>>> GetChatMessages(
        Guid chatId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var userId = GetCurrentUserId();
        var messages = await _messageService.GetChatMessagesAsync(chatId, userId, page, pageSize);
        return Ok(messages);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MessageDto>> GetMessage(Guid id)
    {
        var userId = GetCurrentUserId();
        var message = await _messageService.GetByIdAsync(id, userId);

        if (message == null)
            return NotFound();

        return Ok(message);
    }

    [HttpPost]
    public async Task<ActionResult<MessageDto>> SendMessage([FromBody] SendMessageRequest request)
    {
        var userId = GetCurrentUserId();

        // Check if this is a channel and if user can post
        var canPost = await _channelService.CanPostByChatIdAsync(request.ChatId, userId);
        if (!canPost)
        {
            return Forbid("Only admins can post in channels");
        }

        var message = await _messageService.SendMessageAsync(userId, request);
        return CreatedAtAction(nameof(GetMessage), new { id = message.Id }, message);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MessageDto>> UpdateMessage(Guid id, [FromBody] UpdateMessageRequest request)
    {
        var userId = GetCurrentUserId();
        var message = await _messageService.UpdateMessageAsync(id, userId, request.Content);
        return Ok(message);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteMessage(Guid id, [FromQuery] bool deleteForEveryone = true)
    {
        var userId = GetCurrentUserId();
        await _messageService.DeleteMessageAsync(id, userId, deleteForEveryone);
        return NoContent();
    }

    [HttpPost("chat/{chatId:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid chatId, [FromQuery] Guid? upToMessageId = null)
    {
        var userId = GetCurrentUserId();
        await _messageService.MarkAsReadAsync(chatId, userId, upToMessageId);
        return NoContent();
    }

    [HttpPost("{id:guid}/pin")]
    public async Task<ActionResult<MessageDto>> PinMessage(Guid id)
    {
        var userId = GetCurrentUserId();
        var message = await _messageService.PinMessageAsync(id, userId);
        return Ok(message);
    }

    [HttpPost("{id:guid}/unpin")]
    public async Task<ActionResult<MessageDto>> UnpinMessage(Guid id)
    {
        var userId = GetCurrentUserId();
        var message = await _messageService.UnpinMessageAsync(id, userId);
        return Ok(message);
    }

    [HttpGet("chat/{chatId:guid}/pinned")]
    public async Task<ActionResult<List<MessageDto>>> GetPinnedMessages(Guid chatId)
    {
        var userId = GetCurrentUserId();
        var messages = await _messageService.GetPinnedMessagesAsync(chatId, userId);
        return Ok(messages);
    }

    [HttpGet("chat/{chatId:guid}/search")]
    public async Task<ActionResult<PagedResponse<MessageDto>>> SearchMessages(
        Guid chatId,
        [FromQuery] string query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var messages = await _messageService.SearchMessagesAsync(chatId, userId, query, page, pageSize);
        return Ok(messages);
    }

    [HttpPost("{id:guid}/forward")]
    public async Task<ActionResult<MessageDto>> ForwardMessage(Guid id, [FromBody] ForwardMessageRequest request)
    {
        var userId = GetCurrentUserId();
        var message = await _messageService.ForwardMessageAsync(id, userId, request.TargetChatId);
        return CreatedAtAction(nameof(GetMessage), new { id = message.Id }, message);
    }
}
