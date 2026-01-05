namespace ChatApp.Core.Entities;

public class Channel
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public string? Username { get; set; } // @channelname
    public bool IsPublic { get; set; } = true;
    public int SubscriberCount { get; set; }

    // Invite link support
    public string? InviteCode { get; set; }
    public DateTime? InviteCodeCreatedAt { get; set; }
    public DateTime? InviteCodeExpiresAt { get; set; }
    public int? InviteUsageLimit { get; set; }
    public int InviteUsageCount { get; set; } = 0;

    // Navigation property
    public Chat Chat { get; set; } = null!;
}
