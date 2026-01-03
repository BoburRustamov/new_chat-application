namespace ChatApp.Core.Entities;

public enum CallType
{
    Voice,
    Video
}

public enum CallStatus
{
    Active,
    Ended,
    Missed
}

public class Call
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid InitiatorId { get; set; }
    public CallType Type { get; set; }
    public CallStatus Status { get; set; } = CallStatus.Active;
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }

    // Navigation properties
    public Chat Chat { get; set; } = null!;
    public User Initiator { get; set; } = null!;
    public ICollection<CallParticipant> Participants { get; set; } = new List<CallParticipant>();
}
