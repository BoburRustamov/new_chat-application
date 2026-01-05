using ChatApp.Core.DTOs.Admin;

namespace ChatApp.Core.Interfaces;

public interface IAdminService
{
    AdminAuthResponse Login(AdminLoginRequest request);
    bool ValidateAdminToken(string token);
}