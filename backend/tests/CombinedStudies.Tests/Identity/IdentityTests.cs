using System.Net;
using System.Net.Http.Json;
using CombinedStudies.Identity.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CombinedStudies.Tests.Identity;

[Collection("Integration")]
public class IdentityTests(WebApplicationFactory<Program> factory)
{
    private HttpClient Client => factory.CreateClient();

    private static RegisterRequest UniqueRegister() => new(
        $"user_{Guid.NewGuid():N}@test.com",
        "Password123!",
        "Test User"
    );

    [Fact]
    public async Task Register_Returns200_WithToken()
    {
        var resp = await Client.PostAsJsonAsync("/api/identity/register", UniqueRegister());
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var body = await resp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(body);
        Assert.NotEmpty(body.Token);
        Assert.NotEmpty(body.Email);
    }

    [Fact]
    public async Task Register_Returns409_WhenEmailTaken()
    {
        var req = UniqueRegister();
        await Client.PostAsJsonAsync("/api/identity/register", req);

        var resp2 = await Client.PostAsJsonAsync("/api/identity/register", req);
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task Login_Returns200_WithToken_WhenCredentialsValid()
    {
        var req = UniqueRegister();
        await Client.PostAsJsonAsync("/api/identity/register", req);

        var loginResp = await Client.PostAsJsonAsync("/api/identity/login",
            new LoginRequest(req.Email, req.Password));

        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);
        var body = await loginResp.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(body?.Token);
    }

    [Fact]
    public async Task Login_Returns401_WhenPasswordWrong()
    {
        var req = UniqueRegister();
        await Client.PostAsJsonAsync("/api/identity/register", req);

        var loginResp = await Client.PostAsJsonAsync("/api/identity/login",
            new LoginRequest(req.Email, "WrongPassword!"));

        Assert.Equal(HttpStatusCode.Unauthorized, loginResp.StatusCode);
    }

    [Fact]
    public async Task Me_Returns401_WithNoToken()
    {
        var resp = await Client.GetAsync("/api/identity/me");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Me_ReturnsUser_WithValidToken()
    {
        var req = UniqueRegister();
        var regResp = await Client.PostAsJsonAsync("/api/identity/register", req);
        var auth = await regResp.Content.ReadFromJsonAsync<AuthResponse>();

        var authedClient = factory.CreateClient();
        authedClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", auth!.Token);

        var meResp = await authedClient.GetAsync("/api/identity/me");
        Assert.Equal(HttpStatusCode.OK, meResp.StatusCode);
    }
}
