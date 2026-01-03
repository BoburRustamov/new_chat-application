namespace ChatApp.Core.Entities;

public class Channel
{
    public Guid Id { get; set; }
    public Guid ChatId { get; set; }
    public string? Username { get; set; } // @channelname
    public bool IsPublic { get; set; } = true;
    public int SubscriberCount { get; set; }

    // Navigation property
    public Chat Chat { get; set; } = null!;
}
