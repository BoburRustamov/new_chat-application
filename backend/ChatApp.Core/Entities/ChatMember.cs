namespace ChatApp.Core.Entities;

public enum MemberRole
{
    Owner,
    Admin,
    Moderator,
    Member
}

public class ChatMember
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public Guid UserId { get; set; }
    public MemberRole Role { get; set; } = MemberRole.Member;
    public DateTime JoinedAt { get; set; }
    public Guid? LastReadMessageId { get; set; }
    public DateTime? LastReadAt { get; set; }
    public bool IsMuted { get; set; }
    public DateTime? MutedUntil { get; set; }
    public bool IsPinned { get; set; }
    public bool IsBanned { get; set; }
    public DateTime? BannedAt { get; set; }
    public Guid? BannedById { get; set; }

    // Navigation properties
    public Chat Chat { get; set; } = null!;
    public User User { get; set; } = null!;
    public User? BannedBy { get; set; }
    public Message? LastReadMessage { get; set; }
}
