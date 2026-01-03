namespace ChatApp.Core.Entities;

public enum ChatType
{
    Private,
    Group,
    Channel
}

public class Chat
{
    public Guid Id { get; set; }
    public ChatType Type { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? AvatarUrl { get; set; }
    public Guid? CreatedById { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation properties
    public User? CreatedBy { get; set; }
    public ICollection<ChatMember> Members { get; set; } = new List<ChatMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<Call> Calls { get; set; } = new List<Call>();
    public Channel? Channel { get; set; }
    public ChatSettings? Settings { get; set; }
    public ICollection<ScheduledMessage> ScheduledMessages { get; set; } = new List<ScheduledMessage>();
}
