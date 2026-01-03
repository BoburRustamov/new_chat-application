namespace ChatApp.Core.DTOs.Chat;

public class CreateGroupChatRequest
{
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public List<Guid> MemberIds { get; set; } = new();
}
