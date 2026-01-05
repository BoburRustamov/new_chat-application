namespace ChatApp.Core.DTOs.User;

public class UpdateProfileRequest
{
    public string? DisplayName { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public Guid? AvatarFileId { get; set; }
}
