using ChatApp.Core.Entities;

namespace ChatApp.Core.DTOs.Call;

public class CallDto
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public string? ChatName { get; set; }
    public Guid InitiatorId { get; set; }
    public string InitiatorName { get; set; } = string.Empty;
    public string? InitiatorAvatarUrl { get; set; }
    public CallType Type { get; set; }
    public CallStatus Status { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public int? Duration { get; set; }
    public List<CallParticipantDto> Participants { get; set; } = new();
}
