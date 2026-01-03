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

    // Navigation properties
    public ICollection<ChatMember> ChatMemberships { get; set; } = new List<ChatMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<Chat> CreatedChats { get; set; } = new List<Chat>();
    public ICollection<FileEntity> UploadedFiles { get; set; } = new List<FileEntity>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public ICollection<Call> InitiatedCalls { get; set; } = new List<Call>();
    public ICollection<CallParticipant> CallParticipations { get; set; } = new List<CallParticipant>();
    public ICollection<MessageRead> MessageReads { get; set; } = new List<MessageRead>();
}
