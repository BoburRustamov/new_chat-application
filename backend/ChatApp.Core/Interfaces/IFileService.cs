using ChatApp.Core.DTOs.Chat;
using Microsoft.AspNetCore.Http;

namespace ChatApp.Core.Interfaces;

public interface IFileService
{
    Task<FileDto> UploadFileAsync(IFormFile file, Guid uploaderId);
    Task<(Stream Stream, string ContentType, string FileName)?> GetFileAsync(Guid fileId, Guid userId);
    Task<(Stream Stream, string ContentType, string FileName)?> GetThumbnailAsync(Guid fileId, Guid userId);
    Task<bool> DeleteFileAsync(Guid fileId, Guid userId);
    Task<FileDto?> GetFileInfoAsync(Guid fileId, Guid userId);
}
