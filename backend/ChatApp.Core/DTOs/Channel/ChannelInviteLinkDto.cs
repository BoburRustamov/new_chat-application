namespace ChatApp.Core.DTOs.Channel;

public class ChannelInviteLinkDto
{
    public Guid ChannelId { get; set; }
    public string InviteCode { get; set; } = null!;
    public string InviteLink { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public int? UsageLimit { get; set; }
    public int UsageCount { get; set; }
}

public class GenerateInviteLinkRequest
{
    public int? ExpiresInHours { get; set; }
    public int? UsageLimit { get; set; }
}