using System.Net.Http.Json;
using System.Text.Json;

namespace CombinedStudies.Mobile.Services;

public class AuthService : IAuthService
{
    private readonly HttpClient _http;
    private const string TokenKey = "auth_token";
    private const string UserKey = "auth_user";

    public AuthService(HttpClient http) => _http = http;

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var response = await _http.PostAsJsonAsync("api/identity/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<AuthResult>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new Exception("Empty response");

        await SecureStorage.SetAsync(TokenKey, result.Token);
        await SecureStorage.SetAsync(UserKey, JsonSerializer.Serialize(result));
        return result;
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, string displayName)
    {
        var response = await _http.PostAsJsonAsync("api/identity/register",
            new { email, password, displayName });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<AuthResult>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new Exception("Empty response");

        await SecureStorage.SetAsync(TokenKey, result.Token);
        await SecureStorage.SetAsync(UserKey, JsonSerializer.Serialize(result));
        return result;
    }

    public async Task<bool> IsAuthenticatedAsync()
    {
        var token = await SecureStorage.GetAsync(TokenKey);
        return !string.IsNullOrEmpty(token);
    }

    public Task SignOutAsync()
    {
        SecureStorage.Remove(TokenKey);
        SecureStorage.Remove(UserKey);
        return Task.CompletedTask;
    }
}
