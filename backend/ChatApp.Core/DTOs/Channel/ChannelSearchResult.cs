namespace ChatApp.Core.DTOs.Channel;

public class ChannelSearchResult
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Username { get; set; } = null!;
    public string? AvatarUrl { get; set; }
    public int SubscriberCount { get; set; }
    public string? Description { get; set; }
}