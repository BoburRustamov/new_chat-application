using System.ComponentModel.DataAnnotations;

namespace ChatApp.Core.DTOs.Auth;

public class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}
