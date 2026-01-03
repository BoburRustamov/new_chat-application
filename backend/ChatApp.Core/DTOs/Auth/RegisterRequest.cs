using System.ComponentModel.DataAnnotations;

namespace ChatApp.Core.DTOs.Auth;

public class RegisterRequest
{
    [Required]
    [MaxLength(100)]
    public string DisplayName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(6)]
    [MaxLength(100)]
    public string Password { get; set; } = string.Empty;

    [Required]
    [RegularExpression(@"^[a-zA-Z0-9_]{3,50}$", ErrorMessage = "Username must be 3-50 characters and contain only letters, numbers, and underscores")]
    public string Username { get; set; } = string.Empty;
}
