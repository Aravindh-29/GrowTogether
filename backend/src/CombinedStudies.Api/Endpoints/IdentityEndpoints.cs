using System.Security.Claims;
using CombinedStudies.Identity.DTOs;
using CombinedStudies.Identity.Services;
using Microsoft.AspNetCore.Mvc;

namespace CombinedStudies.Api.Endpoints;

public static class IdentityEndpoints
{
    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/identity").WithTags("Identity");

        group.MapPost("/register", async (
            [FromBody] RegisterRequest req,
            IAuthService auth) =>
        {
            var (response, error) = await auth.RegisterAsync(req);
            return error is not null
                ? Results.Conflict(new { error })
                : Results.Ok(response);
        })
        .WithName("Register")
        .WithOpenApi();

        group.MapPost("/login", async (
            [FromBody] LoginRequest req,
            IAuthService auth) =>
        {
            var (response, error) = await auth.LoginAsync(req);
            return error is not null
                ? Results.Unauthorized()
                : Results.Ok(response);
        })
        .WithName("Login")
        .WithOpenApi();

        group.MapGet("/me", (ClaimsPrincipal user) =>
        {
            return Results.Ok(new
            {
                UserId = user.FindFirstValue(ClaimTypes.NameIdentifier),
                Email  = user.FindFirstValue(ClaimTypes.Email),
                Name   = user.FindFirstValue(ClaimTypes.Name)
            });
        })
        .RequireAuthorization()
        .WithName("Me")
        .WithOpenApi();

        group.MapPost("/google-auth", async (
            [FromBody] GoogleLoginRequest req,
            IAuthService auth) =>
        {
            var (response, error) = await auth.GoogleLoginAsync(req.AccessToken);
            return error is not null
                ? Results.Unauthorized()
                : Results.Ok(response);
        })
        .WithName("GoogleLogin")
        .WithOpenApi();

        group.MapPost("/change-password", async (
            [FromBody] ChangePasswordRequest req,
            ClaimsPrincipal user,
            IAuthService auth) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var (success, error) = await auth.ChangePasswordAsync(userId, req);
            return success
                ? Results.NoContent()
                : Results.BadRequest(new { error });
        })
        .RequireAuthorization()
        .WithName("ChangePassword")
        .WithOpenApi();

        return app;
    }
}
