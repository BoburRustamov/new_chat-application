using System.Security.Claims;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.DTOs.Common;
using ChatApp.Core.DTOs.User;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly IFileService _fileService;

    public UsersController(IUserService userService, IFileService fileService)
    {
        _userService = userService;
        _fileService = fileService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var userId = GetCurrentUserId();
        var user = await _userService.GetByIdAsync(userId);

        if (user == null)
            return NotFound();

        return Ok(user);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> GetUser(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);

        if (user == null)
            return NotFound();

        return Ok(user);
    }

    [HttpGet("search")]
    public async Task<ActionResult<PagedResponse<UserDto>>> SearchUsers(
        [FromQuery] string query,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var result = await _userService.SearchUsersAsync(query, userId, page, pageSize);
        return Ok(result);
    }

    [HttpPut("profile")]
    public async Task<ActionResult<UserDto>> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = GetCurrentUserId();
        var user = await _userService.UpdateProfileAsync(userId, request);
        return Ok(user);
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10MB limit for avatars
    public async Task<ActionResult<UserDto>> UploadAvatar(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        // Validate file is an image
        var allowedContentTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        if (!allowedContentTypes.Contains(file.ContentType.ToLower()))
            return BadRequest("Only image files are allowed (JPEG, PNG, GIF, WebP)");

        var userId = GetCurrentUserId();

        // Upload the file
        var uploadedFile = await _fileService.UploadFileAsync(file, userId);

        // Update the user's avatar URL
        var avatarUrl = $"/api/files/{uploadedFile.Id}";
        var user = await _userService.UpdateProfileAsync(userId, new UpdateProfileRequest { AvatarUrl = avatarUrl });

        return Ok(user);
    }

    [HttpPut("settings/notifications")]
    public async Task<IActionResult> UpdateNotificationSettings([FromBody] NotificationSettingsRequest request)
    {
        var userId = GetCurrentUserId();
        await _userService.UpdateNotificationSettingsAsync(userId, request);
        return NoContent();
    }

    [HttpPut("settings/privacy")]
    public async Task<IActionResult> UpdatePrivacySettings([FromBody] PrivacySettingsRequest request)
    {
        var userId = GetCurrentUserId();
        await _userService.UpdatePrivacySettingsAsync(userId, request);
        return NoContent();
    }
}
