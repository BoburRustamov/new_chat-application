namespace ChatApp.Core.Entities;

public class CallParticipant
{
    public Guid Id { get; set; }
    public Guid CallId { get; set; }
    public Guid UserId { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }

    // Navigation properties
    public Call Call { get; set; } = null!;
    public User User { get; set; } = null!;
}
