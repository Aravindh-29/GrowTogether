using System.Security.Claims;
using CombinedStudies.Groups.DTOs;
using CombinedStudies.Groups.Services;
using Microsoft.AspNetCore.Mvc;

namespace CombinedStudies.Api.Endpoints;

public static class GroupEndpoints
{
    public static IEndpointRouteBuilder MapGroupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/groups").WithTags("Groups").RequireAuthorization();

        // Create a new group
        group.MapPost("/", async (
            [FromBody] CreateGroupRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var result = await svc.CreateAsync(userId, req);
            return Results.Ok(result);
        }).WithName("CreateGroup").WithOpenApi();

        // My groups (groups I am a member of)
        group.MapGet("/mine", async (
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await svc.GetMineAsync(userId));
        }).WithName("GetMyGroups").WithOpenApi();

        // Discover groups I am NOT in
        group.MapGet("/discover", async (
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await svc.DiscoverAsync(userId));
        }).WithName("DiscoverGroups").WithOpenApi();

        // Group detail with member list
        group.MapGet("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var detail = await svc.GetDetailAsync(id, userId);
            return detail is null ? Results.NotFound() : Results.Ok(detail);
        }).WithName("GetGroupDetail").WithOpenApi();

        // Join a group directly (open join from discover)
        group.MapPost("/{id:guid}/join", async (
            Guid id,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.JoinAsync(id, userId);
            return ok ? Results.Ok() : Results.BadRequest(new { error = "Already a member or group not found." });
        }).WithName("JoinGroup").WithOpenApi();

        // Send group invite (creates pending invite + SignalR push)
        group.MapPost("/{id:guid}/invite", async (
            Guid id,
            [FromBody] InviteRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var (ok, error) = await svc.InviteAsync(id, userId, req.UserId);
            return ok ? Results.Ok() : Results.BadRequest(new { error });
        }).WithName("InviteToGroup").WithOpenApi();

        // My pending group invites
        group.MapGet("/invites/mine", async (
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            return Results.Ok(await svc.GetMyInvitesAsync(userId));
        }).WithName("GetMyGroupInvites").WithOpenApi();

        // Respond to a group invite (accept or decline)
        group.MapPost("/invites/{inviteId:guid}/respond", async (
            Guid inviteId,
            [FromBody] RespondInviteRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.RespondToInviteAsync(inviteId, userId, req.Accept);
            return ok ? Results.Ok() : Results.BadRequest(new { error = "Could not respond to invite." });
        }).WithName("RespondToGroupInvite").WithOpenApi();

        // Promote a member to admin (owner only)
        group.MapPost("/{id:guid}/members/promote", async (
            Guid id,
            [FromBody] PromoteRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.PromoteToAdminAsync(id, userId, req.UserId);
            return ok ? Results.Ok() : Results.Forbid();
        }).WithName("PromoteToAdmin").WithOpenApi();

        // Demote admin back to member (owner only)
        group.MapPost("/{id:guid}/members/demote", async (
            Guid id,
            [FromBody] PromoteRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.DemoteAdminAsync(id, userId, req.UserId);
            return ok ? Results.Ok() : Results.Forbid();
        }).WithName("DemoteAdmin").WithOpenApi();

        // Get group messages
        group.MapGet("/{id:guid}/messages", async (
            Guid id,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var msgs = await svc.GetGroupMessagesAsync(id, userId);
            return Results.Ok(msgs);
        }).WithName("GetGroupMessages").WithOpenApi();

        // Send a group message
        group.MapPost("/{id:guid}/messages", async (
            Guid id,
            [FromBody] SendGroupMessageRequest req,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var msg = await svc.SendGroupMessageAsync(id, userId, req.Text);
            return msg is null ? Results.Forbid() : Results.Ok(msg);
        }).WithName("SendGroupMessage").WithOpenApi();

        // Leave a group
        group.MapPost("/{id:guid}/leave", async (
            Guid id,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.LeaveAsync(id, userId);
            return ok ? Results.Ok() : Results.NotFound();
        }).WithName("LeaveGroup").WithOpenApi();

        // Delete a group (owner only)
        group.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            IGroupService svc) =>
        {
            var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
            var ok = await svc.DeleteAsync(id, userId);
            return ok ? Results.NoContent() : Results.Forbid();
        }).WithName("DeleteGroup").WithOpenApi();

        return app;
    }
}
