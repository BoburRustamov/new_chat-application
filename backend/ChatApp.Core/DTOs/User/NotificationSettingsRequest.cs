namespace ChatApp.Core.DTOs.User;

public class NotificationSettingsRequest
{
    public bool PushEnabled { get; set; }
    public bool EmailEnabled { get; set; }
    public bool SoundEnabled { get; set; }
}
