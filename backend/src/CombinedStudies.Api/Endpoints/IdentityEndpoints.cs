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
                UserId = user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub),
                Email  = user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Email),
                Name   = user.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Name)
            });
        })
        .RequireAuthorization()
        .WithName("Me")
        .WithOpenApi();

        return app;
    }
}
