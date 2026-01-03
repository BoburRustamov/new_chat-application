namespace ChatApp.Core.Entities;

public class FileEntity
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string OriginalFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public string Path { get; set; } = string.Empty;
    public Guid UploaderId { get; set; }
    public int? Duration { get; set; } // For audio/video files, in seconds
    public int? Width { get; set; } // For images/videos
    public int? Height { get; set; } // For images/videos
    public string? ThumbnailPath { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public User Uploader { get; set; } = null!;
    public ICollection<Message> Messages { get; set; } = new List<Message>();
}
