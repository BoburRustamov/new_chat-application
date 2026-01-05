namespace ChatApp.Core.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? Bio { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public bool IsOnline { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Notification settings
    public bool PushNotificationsEnabled { get; set; } = true;
    public bool EmailNotificationsEnabled { get; set; } = false;
    public bool SoundEnabled { get; set; } = true;

    // Privacy settings
    public bool ShowOnlineStatus { get; set; } = true;
    public bool ShowLastSeen { get; set; } = true;
    public bool ShowReadReceipts { get; set; } = true;

    // Navigation properties
    public ICollection<ChatMember> ChatMemberships { get; set; } = new List<ChatMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<Chat> CreatedChats { get; set; } = new List<Chat>();
    public ICollection<FileEntity> UploadedFiles { get; set; } = new List<FileEntity>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public ICollection<Call> InitiatedCalls { get; set; } = new List<Call>();
    public ICollection<CallParticipant> CallParticipations { get; set; } = new List<CallParticipant>();
    public ICollection<MessageRead> MessageReads { get; set; } = new List<MessageRead>();
    public ICollection<DeletedMessage> DeletedMessages { get; set; } = new List<DeletedMessage>();
}
