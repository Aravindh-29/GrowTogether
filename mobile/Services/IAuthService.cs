namespace CombinedStudies.Mobile.Services;

public record AuthResult(string Token, string UserId, string Email, string DisplayName);

public interface IAuthService
{
    Task<AuthResult> LoginAsync(string email, string password);
    Task<AuthResult> RegisterAsync(string email, string password, string displayName);
    Task<bool> IsAuthenticatedAsync();
    Task SignOutAsync();
}
