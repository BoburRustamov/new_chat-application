using System.Security.Claims;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ReactionsController : ControllerBase
{
    private readonly IReactionService _reactionService;

    public ReactionsController(IReactionService reactionService)
    {
        _reactionService = reactionService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpPost("message/{messageId:guid}")]
    public async Task<ActionResult<MessageDto>> AddReaction(Guid messageId, [FromBody] AddReactionRequest request)
    {
        var userId = GetCurrentUserId();
        var message = await _reactionService.AddReactionAsync(messageId, userId, request.Emoji);
        return Ok(message);
    }

    [HttpDelete("message/{messageId:guid}")]
    public async Task<ActionResult<MessageDto>> RemoveReaction(Guid messageId, [FromQuery] string emoji)
    {
        var userId = GetCurrentUserId();
        var message = await _reactionService.RemoveReactionAsync(messageId, userId, emoji);
        return Ok(message);
    }
}

public class AddReactionRequest
{
    public string Emoji { get; set; } = string.Empty;
}
