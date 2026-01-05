using ChatApp.Core.DTOs.User;
using ChatApp.Core.Entities;

namespace ChatApp.Core.DTOs.Channel;

public class ChannelDto
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public string Name { get; set; } = null!;
    public string? Description { get; set; }
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
    public bool IsPublic { get; set; }
    public int SubscriberCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public UserDto? CreatedBy { get; set; }
    public bool IsSubscribed { get; set; }
    public MemberRole? UserRole { get; set; }
}