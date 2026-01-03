using ChatApp.Core.Entities;

namespace ChatApp.Core.DTOs.Call;

public class InitiateCallRequest
{
    public Guid ChatId { get; set; }
    public CallType Type { get; set; }
}
