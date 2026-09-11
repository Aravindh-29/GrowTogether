using System.Security.Claims;
using CombinedStudies.Api.Hubs;
using CombinedStudies.Chat.Data;
using CombinedStudies.Connections.Data;
using CombinedStudies.Connections.Entities;
using CombinedStudies.Groups.Services;
using CombinedStudies.Posts.Services;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Api.Endpoints;

public static class NotificationEndpoints
{
    public static IEndpointRouteBuilder MapNotificationEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/notifications/counts", async (
            ClaimsPrincipal user,
            ConnectionsDbContext connDb,
            ChatDbContext chatDb,
            IGroupService groupSvc,
            IPostService postSvc) =>
        {
            var myUserId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;

            var pendingRequests = await connDb.Connections
                .CountAsync(c => c.ReceiverId == myUserId && c.Status == ConnectionStatus.Pending);

            var myConvIds = await chatDb.Conversations
                .Where(c => c.User1Id == myUserId || c.User2Id == myUserId)
                .Select(c => c.Id)
                .ToListAsync();

            var unreadMessages = myConvIds.Count == 0 ? 0 : await chatDb.Messages
                .CountAsync(m => myConvIds.Contains(m.ConversationId)
                              && m.SenderId != myUserId
                              && m.ReadAt == null);

            var pendingGroupInvites = await groupSvc.CountPendingInvitesAsync(myUserId);
            var unreadPostActivity = await postSvc.GetUnreadActivityCountAsync(myUserId);

            return Results.Ok(new { pendingRequests, unreadMessages, pendingGroupInvites, unreadPostActivity });
        }).RequireAuthorization().WithTags("Notifications");

        app.MapGet("/api/users/{userId}/online", (string userId) =>
            Results.Ok(new { online = ChatHub.IsOnline(userId) })
        ).RequireAuthorization().WithTags("Notifications");

        return app;
    }
}
