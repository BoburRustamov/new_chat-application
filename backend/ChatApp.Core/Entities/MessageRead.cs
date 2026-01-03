namespace ChatApp.Core.Entities;

public class MessageRead
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public DateTime ReadAt { get; set; }

    // Navigation properties
    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
