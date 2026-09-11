using System.Security.Claims;
using CombinedStudies.Api.Hubs;
using CombinedStudies.Connections.DTOs;
using CombinedStudies.Connections.Services;
using CombinedStudies.Profiles.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Api.Endpoints;

public static class ConnectionEndpoints
{
    public static IEndpointRouteBuilder MapConnectionEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/connections").WithTags("Connections").RequireAuthorization();

        g.MapPost("/request", async (
            [FromBody] SendRequestDto dto,
            ClaimsPrincipal user,
            IConnectionService svc,
            IHubContext<ChatHub> hub,
            ProfilesDbContext profiles) =>
        {
            var myId = UserId(user);
            var result = await svc.SendRequestAsync(myId, dto.ReceiverId, dto.Note);
            if (result is null) return Results.Conflict(new { error = "Request already exists or invalid." });

            var senderProf = await profiles.Profiles
                .Where(p => p.UserId == myId)
                .Select(p => new { p.FirstName, p.LastName })
                .FirstOrDefaultAsync();
            var senderName = senderProf is null ? "Someone"
                : $"{senderProf.FirstName} {senderProf.LastName}".Trim();

            await hub.Clients.Group($"user:{dto.ReceiverId}")
                .SendAsync("NewConnectionRequest", new { connectionId = result.Id, senderId = myId, senderName });

            return Results.Ok(result);
        });

        g.MapPost("/{id:guid}/accept", async (
            Guid id,
            ClaimsPrincipal user,
            IConnectionService svc,
            IHubContext<ChatHub> hub,
            ProfilesDbContext profiles) =>
        {
            var myId = UserId(user);
            var result = await svc.AcceptAsync(id, myId);
            if (result is null) return Results.NotFound();

            var acceptorProf = await profiles.Profiles
                .Where(p => p.UserId == myId)
                .Select(p => new { p.FirstName, p.LastName })
                .FirstOrDefaultAsync();
            var acceptorName = acceptorProf is null ? "Someone"
                : $"{acceptorProf.FirstName} {acceptorProf.LastName}".Trim();

            await hub.Clients.Group($"user:{result.SenderId}")
                .SendAsync("ConnectionAccepted", new { connectionId = result.Id, acceptorId = myId, acceptorName });

            return Results.Ok(result);
        });

        g.MapPost("/{id:guid}/reject", async (
            Guid id,
            ClaimsPrincipal user,
            IConnectionService svc,
            IHubContext<ChatHub> hub,
            ProfilesDbContext profiles) =>
        {
            var myId = UserId(user);
            var result = await svc.RejectAsync(id, myId);
            if (result is null) return Results.NotFound();

            var rejectorProf = await profiles.Profiles
                .Where(p => p.UserId == myId)
                .Select(p => new { p.FirstName, p.LastName })
                .FirstOrDefaultAsync();
            var rejectorName = rejectorProf is null ? "Someone"
                : $"{rejectorProf.FirstName} {rejectorProf.LastName}".Trim();

            await hub.Clients.Group($"user:{result.SenderId}")
                .SendAsync("ConnectionRejected", new { connectionId = result.Id, rejectorId = myId, rejectorName });

            return Results.Ok(result);
        });

        g.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal user, IConnectionService svc) =>
        {
            var ok = await svc.CancelAsync(id, UserId(user));
            return ok ? Results.NoContent() : Results.NotFound();
        });

        g.MapGet("/", async (ClaimsPrincipal user, IConnectionService svc, ProfilesDbContext profiles) =>
            Results.Ok(await EnrichAsync(await svc.GetConnectionsAsync(UserId(user)), UserId(user), profiles)));

        g.MapGet("/requests", async (ClaimsPrincipal user, IConnectionService svc, ProfilesDbContext profiles) =>
            Results.Ok(await EnrichAsync(await svc.GetIncomingRequestsAsync(UserId(user)), UserId(user), profiles)));

        g.MapGet("/sent", async (ClaimsPrincipal user, IConnectionService svc, ProfilesDbContext profiles) =>
            Results.Ok(await EnrichAsync(await svc.GetSentRequestsAsync(UserId(user)), UserId(user), profiles)));

        g.MapGet("/status/{targetUserId}", async (string targetUserId, ClaimsPrincipal user, IConnectionService svc) =>
        {
            var conn = await svc.GetBetweenAsync(UserId(user), targetUserId);
            if (conn is null) return Results.Ok(new { status = "None", connectionId = (Guid?)null, isSender = false });
            return Results.Ok(new { status = conn.Status.ToString(), connectionId = (Guid?)conn.Id, isSender = conn.SenderId == UserId(user) });
        });

        return app;
    }

    private static async Task<List<ConnectionWithProfileDto>> EnrichAsync(
        List<ConnectionDto> conns, string myUserId, ProfilesDbContext profiles)
    {
        if (conns.Count == 0) return [];
        var otherIds = conns.Select(c => c.SenderId == myUserId ? c.ReceiverId : c.SenderId).Distinct().ToList();
        var profileMap = await profiles.Profiles
            .Where(p => otherIds.Contains(p.UserId))
            .Select(p => new { p.UserId, p.Username, p.FirstName, p.MiddleName, p.LastName, p.ProfilePictureUrl, p.Role, p.Headline, p.City, p.Country })
            .ToDictionaryAsync(p => p.UserId);

        return conns.Select(c =>
        {
            var otherId = c.SenderId == myUserId ? c.ReceiverId : c.SenderId;
            profileMap.TryGetValue(otherId, out var prof);
            var name = prof is null ? otherId
                : string.Join(" ", new[] { prof.FirstName, prof.MiddleName, prof.LastName }.Where(x => !string.IsNullOrEmpty(x)));
            return new ConnectionWithProfileDto(
                c.Id, otherId, prof?.Username, name, prof?.ProfilePictureUrl,
                prof?.Role, prof?.Headline, prof?.City, prof?.Country,
                c.Status, c.Note, c.SentAt, c.RespondedAt,
                IsSender: c.SenderId == myUserId);
        }).ToList();
    }

    private static string UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)!;
}
