using ChatApp.Core.Entities;

namespace ChatApp.Core.DTOs.Chat;

public class SendMessageRequest
{
    public Guid ChatId { get; set; }
    public string? Content { get; set; }
    public MessageType Type { get; set; } = MessageType.Text;
    public Guid? FileId { get; set; }
    public Guid? ReplyToId { get; set; }
}
