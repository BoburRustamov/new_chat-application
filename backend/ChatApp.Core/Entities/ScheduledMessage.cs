namespace ChatApp.Core.Entities;

public enum ScheduledMessageStatus
{
    Pending,
    Sent,
    Failed,
    Cancelled
}

public class ScheduledMessage
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid SenderId { get; set; }
    public string? Content { get; set; }
    public MessageType Type { get; set; } = MessageType.Text;
    public Guid? FileId { get; set; }
    public Guid? ReplyToId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public ScheduledMessageStatus Status { get; set; } = ScheduledMessageStatus.Pending;
    public Guid? SentMessageId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Chat Chat { get; set; } = null!;
    public User Sender { get; set; } = null!;
    public FileEntity? File { get; set; }
    public Message? ReplyTo { get; set; }
    public Message? SentMessage { get; set; }
}
