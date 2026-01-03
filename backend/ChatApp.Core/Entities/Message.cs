namespace ChatApp.Core.Entities;

public enum MessageType
{
    Text,
    Image,
    Video,
    Audio,
    Voice,
    File,
    System
}

public class Message
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid SenderId { get; set; }
    public string? Content { get; set; }
    public MessageType Type { get; set; } = MessageType.Text;
    public Guid? FileId { get; set; }
    public Guid? ReplyToId { get; set; }
    public Guid? ForwardedFromId { get; set; }
    public bool IsEdited { get; set; }
    public DateTime? EditedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public Guid? DeletedById { get; set; }
    public bool IsPinned { get; set; }
    public DateTime? PinnedAt { get; set; }
    public Guid? PinnedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public Chat Chat { get; set; } = null!;
    public User Sender { get; set; } = null!;
    public FileEntity? File { get; set; }
    public Message? ReplyTo { get; set; }
    public Message? ForwardedFrom { get; set; }
    public User? DeletedBy { get; set; }
    public User? PinnedBy { get; set; }
    public ICollection<Message> Replies { get; set; } = new List<Message>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public ICollection<MessageRead> Reads { get; set; } = new List<MessageRead>();
}
