using System.Security.Claims;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ChatsController : ControllerBase
{
    private readonly IChatService _chatService;

    public ChatsController(IChatService chatService)
    {
        _chatService = chatService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpGet]
    public async Task<ActionResult<List<ChatDto>>> GetChats()
    {
        var userId = GetCurrentUserId();
        var chats = await _chatService.GetUserChatsAsync(userId);
        return Ok(chats);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ChatDto>> GetChat(Guid id)
    {
        var userId = GetCurrentUserId();
        var chat = await _chatService.GetByIdAsync(id, userId);

        if (chat == null)
            return NotFound();

        return Ok(chat);
    }

    [HttpPost("private")]
    public async Task<ActionResult<ChatDto>> CreatePrivateChat([FromBody] CreatePrivateChatRequest request)
    {
        var userId = GetCurrentUserId();
        var chat = await _chatService.CreatePrivateChatAsync(userId, request.OtherUserId);
        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, chat);
    }

    [HttpPost("group")]
    public async Task<ActionResult<ChatDto>> CreateGroupChat([FromBody] CreateGroupChatRequest request)
    {
        var userId = GetCurrentUserId();
        var chat = await _chatService.CreateGroupChatAsync(userId, request.Name, request.Description, request.MemberIds);
        return CreatedAtAction(nameof(GetChat), new { id = chat.Id }, chat);
    }

    [HttpPost("{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> AddMember(Guid id, Guid memberId)
    {
        var userId = GetCurrentUserId();
        await _chatService.AddMemberAsync(id, memberId, userId);
        return NoContent();
    }

    [HttpDelete("{id:guid}/members/{memberId:guid}")]
    public async Task<IActionResult> RemoveMember(Guid id, Guid memberId)
    {
        var userId = GetCurrentUserId();
        await _chatService.RemoveMemberAsync(id, memberId, userId);
        return NoContent();
    }

    [HttpDelete("{id:guid}/leave")]
    public async Task<IActionResult> LeaveChat(Guid id)
    {
        var userId = GetCurrentUserId();
        await _chatService.RemoveMemberAsync(id, userId, userId);
        return NoContent();
    }
}
