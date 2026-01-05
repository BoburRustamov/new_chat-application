using System.ComponentModel.DataAnnotations;

namespace ChatApp.Core.DTOs.Admin;

public class AdminLoginRequest
{
    [Required]
    public string Username { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}