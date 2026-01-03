namespace ChatApp.Core.Entities;

public class ChatSettings
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public int SlowModeInterval { get; set; } // Seconds between messages (0 = disabled)
    public bool MembersCanAddMembers { get; set; } = true;
    public bool MembersCanSendMedia { get; set; } = true;
    public bool MembersCanSendStickers { get; set; } = true;
    public bool MembersCanPinMessages { get; set; }
    public bool MembersCanChangeInfo { get; set; }
    public bool JoinRequiresApproval { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation property
    public Chat Chat { get; set; } = null!;
}
