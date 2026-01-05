namespace ChatApp.Core.DTOs.Chat;

public class UpdateChatRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public Guid? AvatarFileId { get; set; }
}
