namespace ChatApp.Core.Entities;

public class Reaction
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    // Navigation properties
    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
