using System.Security.Claims;
using ChatApp.Core.DTOs.Call;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CallsController : ControllerBase
{
    private readonly ICallService _callService;
    private readonly IChatService _chatService;

    public CallsController(ICallService callService, IChatService chatService)
    {
        _callService = callService;
        _chatService = chatService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CallDto>> GetCall(Guid id)
    {
        var call = await _callService.GetCallAsync(id);

        if (call == null)
            return NotFound();

        return Ok(call);
    }

    [HttpGet("chat/{chatId:guid}/history")]
    public async Task<ActionResult<List<CallDto>>> GetCallHistory(Guid chatId, [FromQuery] int limit = 50)
    {
        var userId = GetCurrentUserId();

        // Verify user is a member of the chat
        if (!await _chatService.IsMemberAsync(chatId, userId))
            return Forbid();

        var calls = await _callService.GetCallHistoryAsync(chatId, limit);
        return Ok(calls);
    }

    [HttpGet("chat/{chatId:guid}/active")]
    public async Task<ActionResult<CallDto>> GetActiveCall(Guid chatId)
    {
        var userId = GetCurrentUserId();

        // Verify user is a member of the chat
        if (!await _chatService.IsMemberAsync(chatId, userId))
            return Forbid();

        var call = await _callService.GetActiveCallForChatAsync(chatId);

        if (call == null)
            return NotFound();

        return Ok(call);
    }
}
