namespace ChatApp.Core.Entities;

public class DeletedMessage
{
    public Guid Id { get; set; }
    public Guid MessageId { get; set; }
    public Guid UserId { get; set; }
    public DateTime DeletedAt { get; set; }

    // Navigation properties
    public Message Message { get; set; } = null!;
    public User User { get; set; } = null!;
}
