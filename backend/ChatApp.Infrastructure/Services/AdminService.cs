using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChatApp.Core.DTOs.Admin;
using ChatApp.Core.Exceptions;
using ChatApp.Core.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace ChatApp.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly string _adminUsername;
    private readonly string _adminPassword;
    private readonly string _secretKey;
    private readonly string _issuer;
    private readonly string _audience;
    private readonly int _expirationMinutes;

    public AdminService(IConfiguration configuration)
    {
        _adminUsername = configuration["Admin:Username"] ?? throw new InvalidOperationException("Admin username not configured");
        _adminPassword = configuration["Admin:Password"] ?? throw new InvalidOperationException("Admin password not configured");
        _secretKey = configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured");
        _issuer = configuration["Jwt:Issuer"] ?? "ChatApp";
        _audience = configuration["Jwt:Audience"] ?? "ChatApp";
        _expirationMinutes = int.Parse(configuration["Jwt:ExpirationMinutes"] ?? "60");
    }

    public AdminAuthResponse Login(AdminLoginRequest request)
    {
        if (request.Username != _adminUsername || request.Password != _adminPassword)
        {
            throw new UnauthorizedException("Invalid admin credentials");
        }

        var token = GenerateAdminToken();

        return new AdminAuthResponse
        {
            AccessToken = token,
            ExpiresAt = DateTime.UtcNow.AddMinutes(_expirationMinutes),
            Username = _adminUsername
        };
    }

    public bool ValidateAdminToken(string token)
    {
        if (string.IsNullOrEmpty(token))
            return false;

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_secretKey);

        try
        {
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);

            // Check if the token has the admin role claim
            var roleClaim = principal.FindFirst(ClaimTypes.Role);
            return roleClaim?.Value == "Admin";
        }
        catch
        {
            return false;
        }
    }

    private string GenerateAdminToken()
    {
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secretKey));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.Name, _adminUsername),
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_expirationMinutes),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
