using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using CombinedStudies.Identity.Data;
using CombinedStudies.Identity.DTOs;
using CombinedStudies.Identity.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace CombinedStudies.Identity.Services;

public class AuthService(IdentityDbContext db, IConfiguration config) : IAuthService
{
    public async Task<(AuthResponse? Response, string? Error)> RegisterAsync(RegisterRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Email == normalizedEmail))
            return (null, "Email is already registered.");

        var user = User.Create(
            normalizedEmail,
            BCrypt.Net.BCrypt.HashPassword(request.Password),
            request.DisplayName.Trim()
        );

        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException)
        {
            // Race condition: another request registered the same email just before us
            return (null, "Email is already registered.");
        }

        return (IssueToken(user), null);
    }

    public async Task<(bool Success, string? Error)> ChangePasswordAsync(string userId, ChangePasswordRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == Guid.Parse(userId));
        if (user is null) return (false, "User not found.");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return (false, "Current password is incorrect.");

        user.UpdatePasswordHash(BCrypt.Net.BCrypt.HashPassword(request.NewPassword));
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<(AuthResponse? Response, string? Error)> LoginAsync(LoginRequest request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return (null, "Invalid email or password.");

        return (IssueToken(user), null);
    }

    public async Task<(AuthResponse? Response, string? Error)> GoogleLoginAsync(string accessToken)
    {
        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        HttpResponseMessage googleRes;
        try
        {
            googleRes = await http.GetAsync("https://www.googleapis.com/oauth2/v3/userinfo");
        }
        catch
        {
            return (null, "Could not reach Google.");
        }

        if (!googleRes.IsSuccessStatusCode)
            return (null, "Invalid Google token.");

        var info = await googleRes.Content.ReadFromJsonAsync<GoogleUserInfo>(
            new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (info?.Email is null)
            return (null, "Could not retrieve email from Google.");

        var email = info.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user is null)
        {
            var displayName = (info.Name ?? email.Split('@')[0]).Trim();
            user = User.Create(email, "", displayName);
            db.Users.Add(user);
            await db.SaveChangesAsync();
        }

        return (IssueToken(user), null);
    }

    private record GoogleUserInfo(string? Email, string? Name, string? Sub);

    private AuthResponse IssueToken(User user)
    {
        var secret = config["Jwt:Secret"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiry = DateTime.UtcNow.AddDays(double.Parse(config["Jwt:ExpiryDays"] ?? "7"));

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim(JwtRegisteredClaimNames.Name, user.DisplayName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"],
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: expiry,
            signingCredentials: creds
        );

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            user.Id,
            user.Email,
            user.DisplayName
        );
    }
}
