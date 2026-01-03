namespace ChatApp.Core.DTOs.Call;

public class CallParticipantDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public DateTime JoinedAt { get; set; }
    public DateTime? LeftAt { get; set; }
    public bool IsMuted { get; set; }
    public bool IsVideoOn { get; set; }
}
