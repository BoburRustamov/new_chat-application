using ChatApp.Core.DTOs.Chat;
using ChatApp.Core.Entities;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using ChatApp.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace ChatApp.Infrastructure.Services;

public class FileService : IFileService
{
    private readonly AppDbContext _context;
    private readonly string _uploadPath;
    private readonly string _thumbnailPath;
    private const long MaxFileSize = 100 * 1024 * 1024; // 100MB
    private const int ThumbnailMaxWidth = 200;
    private const int ThumbnailMaxHeight = 200;

    private static readonly HashSet<string> AllowedImageTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"
    };

    private static readonly HashSet<string> AllowedVideoTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "video/mp4", "video/webm", "video/ogg", "video/quicktime"
    };

    private static readonly HashSet<string> AllowedAudioTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/aac"
    };

    private static readonly HashSet<string> AllowedDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "application/zip",
        "application/x-rar-compressed"
    };

    public FileService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _uploadPath = configuration["FileStorage:UploadPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
        _thumbnailPath = configuration["FileStorage:ThumbnailPath"] ?? Path.Combine(_uploadPath, "thumbnails");

        // Ensure directories exist
        Directory.CreateDirectory(_uploadPath);
        Directory.CreateDirectory(_thumbnailPath);
    }

    public async Task<FileDto> UploadFileAsync(IFormFile file, Guid uploaderId)
    {
        if (file.Length == 0)
            throw new BadRequestException("File is empty");

        if (file.Length > MaxFileSize)
            throw new BadRequestException($"File size exceeds the maximum allowed size of {MaxFileSize / (1024 * 1024)}MB");

        var contentType = file.ContentType.ToLowerInvariant();
        if (!IsAllowedContentType(contentType))
            throw new BadRequestException($"File type '{contentType}' is not allowed");

        var fileId = Guid.NewGuid();
        var fileExtension = Path.GetExtension(file.FileName);
        var storedFileName = $"{fileId}{fileExtension}";
        var filePath = Path.Combine(_uploadPath, storedFileName);

        // Save the file
        await using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var fileEntity = new FileEntity
        {
            Id = fileId,
            FileName = storedFileName,
            OriginalFileName = file.FileName,
            ContentType = contentType,
            Size = file.Length,
            Path = filePath,
            UploaderId = uploaderId
        };

        // Process image files for dimensions and thumbnail
        if (AllowedImageTypes.Contains(contentType))
        {
            await ProcessImageAsync(filePath, fileEntity);
        }

        _context.Files.Add(fileEntity);
        await _context.SaveChangesAsync();

        return MapToDto(fileEntity);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> GetFileAsync(Guid fileId, Guid userId)
    {
        var file = await _context.Files.FindAsync(fileId);
        if (file == null)
            return null;

        if (!File.Exists(file.Path))
            return null;

        var stream = new FileStream(file.Path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, file.ContentType, file.OriginalFileName);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> GetThumbnailAsync(Guid fileId, Guid userId)
    {
        var file = await _context.Files.FindAsync(fileId);
        if (file == null || string.IsNullOrEmpty(file.ThumbnailPath))
            return null;

        if (!File.Exists(file.ThumbnailPath))
            return null;

        var stream = new FileStream(file.ThumbnailPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, "image/jpeg", $"thumb_{file.OriginalFileName}");
    }

    public async Task<bool> DeleteFileAsync(Guid fileId, Guid userId)
    {
        var file = await _context.Files
            .FirstOrDefaultAsync(f => f.Id == fileId && f.UploaderId == userId);

        if (file == null)
            return false;

        // Delete physical files
        if (File.Exists(file.Path))
            File.Delete(file.Path);

        if (!string.IsNullOrEmpty(file.ThumbnailPath) && File.Exists(file.ThumbnailPath))
            File.Delete(file.ThumbnailPath);

        _context.Files.Remove(file);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<FileDto?> GetFileInfoAsync(Guid fileId, Guid userId)
    {
        var file = await _context.Files.FindAsync(fileId);
        if (file == null)
            return null;

        return MapToDto(file);
    }

    private async Task ProcessImageAsync(string filePath, FileEntity fileEntity)
    {
        try
        {
            using var image = await Image.LoadAsync(filePath);

            // Store dimensions
            fileEntity.Width = image.Width;
            fileEntity.Height = image.Height;

            // Generate thumbnail
            var thumbnailFileName = $"thumb_{fileEntity.FileName}";
            var thumbnailFilePath = Path.Combine(_thumbnailPath, thumbnailFileName);

            var resizeOptions = new ResizeOptions
            {
                Mode = ResizeMode.Max,
                Size = new Size(ThumbnailMaxWidth, ThumbnailMaxHeight)
            };

            image.Mutate(x => x.Resize(resizeOptions));
            await image.SaveAsJpegAsync(thumbnailFilePath);

            fileEntity.ThumbnailPath = thumbnailFilePath;
        }
        catch
        {
            // If image processing fails, continue without thumbnail
        }
    }

    private static bool IsAllowedContentType(string contentType)
    {
        return AllowedImageTypes.Contains(contentType) ||
               AllowedVideoTypes.Contains(contentType) ||
               AllowedAudioTypes.Contains(contentType) ||
               AllowedDocumentTypes.Contains(contentType);
    }

    private static FileDto MapToDto(FileEntity file)
    {
        return new FileDto
        {
            Id = file.Id,
            FileName = file.OriginalFileName,
            ContentType = file.ContentType,
            Size = file.Size,
            DownloadUrl = $"/api/files/{file.Id}",
            ThumbnailUrl = !string.IsNullOrEmpty(file.ThumbnailPath) ? $"/api/files/{file.Id}/thumbnail" : null,
            Duration = file.Duration,
            Width = file.Width,
            Height = file.Height
        };
    }
}
