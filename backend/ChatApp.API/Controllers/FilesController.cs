using System.Security.Claims;
using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChatApp.API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FilesController : ControllerBase
{
    private readonly IFileService _fileService;

    public FilesController(IFileService fileService)
    {
        _fileService = fileService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(100 * 1024 * 1024)] // 100MB
    public async Task<ActionResult<FileDto>> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded");

        var userId = GetCurrentUserId();
        var result = await _fileService.UploadFileAsync(file, userId);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous] // Allow file downloads without auth for easier sharing
    public async Task<IActionResult> Download(Guid id)
    {
        var userId = User.Identity?.IsAuthenticated == true ? GetCurrentUserId() : Guid.Empty;
        var result = await _fileService.GetFileAsync(id, userId);

        if (result == null)
            return NotFound();

        var (stream, contentType, fileName) = result.Value;
        return File(stream, contentType, fileName);
    }

    [HttpGet("{id:guid}/thumbnail")]
    [AllowAnonymous]
    public async Task<IActionResult> GetThumbnail(Guid id)
    {
        var userId = User.Identity?.IsAuthenticated == true ? GetCurrentUserId() : Guid.Empty;
        var result = await _fileService.GetThumbnailAsync(id, userId);

        if (result == null)
            return NotFound();

        var (stream, contentType, fileName) = result.Value;
        return File(stream, contentType, fileName);
    }

    [HttpGet("{id:guid}/info")]
    public async Task<ActionResult<FileDto>> GetInfo(Guid id)
    {
        var userId = GetCurrentUserId();
        var result = await _fileService.GetFileInfoAsync(id, userId);

        if (result == null)
            return NotFound();

        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = GetCurrentUserId();
        var success = await _fileService.DeleteFileAsync(id, userId);

        if (!success)
            return NotFound();

        return NoContent();
    }
}
