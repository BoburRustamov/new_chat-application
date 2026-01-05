namespace ChatApp.Core.DTOs.User;

public class PrivacySettingsRequest
{
    public bool ShowOnlineStatus { get; set; }
    public bool ShowLastSeen { get; set; }
    public bool ShowReadReceipts { get; set; }
}
