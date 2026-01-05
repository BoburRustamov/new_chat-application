using System.Security.Claims;
using ChatApp.Core.DTOs.Admin;
using ChatApp.Core.DTOs.Common;
using ChatApp.Core.DTOs.User;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _adminService;
    private readonly IUserService _userService;
    private readonly IChatService _chatService;

    public AdminController(IAdminService adminService, IUserService userService, IChatService chatService)
    {
        _adminService = adminService;
        _userService = userService;
        _chatService = chatService;
    }

    [HttpPost("login")]
    public ActionResult<AdminAuthResponse> Login([FromBody] AdminLoginRequest request)
    {
        var response = _adminService.Login(request);
        return Ok(response);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("verify")]
    public IActionResult VerifyAdmin()
    {
        return Ok(new { valid = true, username = User.Identity?.Name });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("users")]
    public async Task<ActionResult<PagedResponse<UserDto>>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null)
    {
        var users = await _userService.GetAllUsersAsync(page, pageSize, search);
        return Ok(users);
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("users/{userId}")]
    public async Task<ActionResult<UserDto>> GetUser(Guid userId)
    {
        var user = await _userService.GetByIdAsync(userId);
        if (user == null)
        {
            return NotFound("User not found");
        }
        return Ok(user);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("users/{userId}")]
    public async Task<IActionResult> DeleteUser(Guid userId)
    {
        await _userService.DeleteUserAsync(userId);
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("users")]
    public async Task<ActionResult<DeleteAllUsersResponse>> DeleteAllUsers()
    {
        var deletedCount = await _userService.DeleteAllUsersAsync();
        return Ok(new DeleteAllUsersResponse { DeletedCount = deletedCount });
    }

    [Authorize(Roles = "Admin")]
    [HttpGet("stats")]
    public async Task<ActionResult<AdminStatsResponse>> GetStats()
    {
        var stats = await GetAdminStatsAsync();
        return Ok(stats);
    }

    private async Task<AdminStatsResponse> GetAdminStatsAsync()
    {
        var totalUsers = await _userService.GetTotalUsersCountAsync();
        var onlineUsers = await _userService.GetOnlineUsersCountAsync();
        var totalChats = await _chatService.GetTotalChatsCountAsync();
        var totalMessages = await _chatService.GetTotalMessagesCountAsync();

        return new AdminStatsResponse
        {
            TotalUsers = totalUsers,
            OnlineUsers = onlineUsers,
            TotalChats = totalChats,
            TotalMessages = totalMessages
        };
    }
}

public class AdminStatsResponse
{
    public int TotalUsers { get; set; }
    public int OnlineUsers { get; set; }
    public int TotalChats { get; set; }
    public long TotalMessages { get; set; }
}

public class DeleteAllUsersResponse
{
    public int DeletedCount { get; set; }
}
