using ChatApp.Core.Entities;

namespace ChatApp.Core.DTOs.Chat;

public class MessageDto
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderUsername { get; set; } = null!;
    public string SenderDisplayName { get; set; } = null!;
    public string? SenderAvatarUrl { get; set; }
    public string? Content { get; set; }
    public MessageType Type { get; set; }
    public Guid? FileId { get; set; }
    public FileDto? File { get; set; }
    public Guid? ReplyToId { get; set; }
    public MessageDto? ReplyTo { get; set; }
    public bool IsEdited { get; set; }
    public DateTime? EditedAt { get; set; }
    public bool IsDeleted { get; set; }
    public bool IsPinned { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<ReactionDto> Reactions { get; set; } = new();
    public MessageStatus Status { get; set; }
}

public class FileDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = null!;
    public string ContentType { get; set; } = null!;
    public long Size { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string DownloadUrl { get; set; } = null!;
    public int? Duration { get; set; } // For audio/video files, in seconds
    public int? Width { get; set; } // For images/videos
    public int? Height { get; set; } // For images/videos
}

public class ReactionDto
{
    public string Emoji { get; set; } = null!;
    public int Count { get; set; }
    public List<Guid> UserIds { get; set; } = new();
}

public enum MessageStatus
{
    Sending,
    Sent,
    Delivered,
    Read
}
