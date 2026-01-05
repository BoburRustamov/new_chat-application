using System.ComponentModel.DataAnnotations;

namespace ChatApp.Core.DTOs.Channel;

public class UpdateChannelRequest
{
    [StringLength(128, MinimumLength = 3, ErrorMessage = "Name must be between 3 and 128 characters")]
    public string? Name { get; set; }

    [StringLength(512, ErrorMessage = "Description cannot exceed 512 characters")]
    public string? Description { get; set; }

    [StringLength(32, MinimumLength = 5, ErrorMessage = "Username must be between 5 and 32 characters")]
    [RegularExpression(@"^[a-zA-Z][a-zA-Z0-9_]*$", ErrorMessage = "Username must start with a letter and contain only letters, numbers, and underscores")]
    public string? Username { get; set; }

    public bool? IsPublic { get; set; }

    public Guid? AvatarFileId { get; set; }
}