using CombinedStudies.Identity.DTOs;

namespace CombinedStudies.Identity.Services;

public interface IAuthService
{
    Task<(AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request);
    Task<(AuthResponse? Response, string? Error)> LoginAsync(LoginRequest request);
}
