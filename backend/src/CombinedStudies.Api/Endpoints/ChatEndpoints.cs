using System.Security.Claims;
using CombinedStudies.Chat.Data;
using CombinedStudies.Chat.DTOs;
using CombinedStudies.Chat.Entities;
using CombinedStudies.Chat.Services;
using CombinedStudies.Api.Hubs;
using CombinedStudies.Connections.Data;
using CombinedStudies.Connections.Entities;
using CombinedStudies.Profiles.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Api.Endpoints;

public static class ChatEndpoints
{
    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/chats").WithTags("Chat").RequireAuthorization();

        // Start or get existing conversation with a user (must be accepted friends)
        g.MapPost("/start", async ([FromBody] StartConversationDto dto, ClaimsPrincipal user, IChatService svc, ConnectionsDbContext connDb) =>
        {
            var myUserId = UserId(user);
            if (myUserId == dto.UserId) return Results.BadRequest(new { error = "Cannot chat with yourself." });

            var areFriends = await connDb.Connections.AnyAsync(c =>
                c.Status == ConnectionStatus.Accepted &&
                ((c.SenderId == myUserId && c.ReceiverId == dto.UserId) ||
                 (c.SenderId == dto.UserId && c.ReceiverId == myUserId)));
            if (!areFriends) return Results.Forbid();

            var conv = await svc.GetOrCreateConversationAsync(myUserId, dto.UserId);
            return Results.Ok(new { id = conv.Id });
        });

        // List my conversations with profile info and real unread counts
        g.MapGet("/", async (ClaimsPrincipal user, IChatService svc, ProfilesDbContext profiles, ChatDbContext chatDb) =>
        {
            var myId = UserId(user);
            var convs = await svc.GetConversationsAsync(myId);
            if (convs.Count == 0) return Results.Ok(new List<ConversationSummaryDto>());

            var otherIds = convs.Select(c => c.User1Id == myId ? c.User2Id : c.User1Id).Distinct().ToList();
            var profileMap = await profiles.Profiles
                .Where(p => otherIds.Contains(p.UserId))
                .Select(p => new { p.UserId, p.Username, p.FirstName, p.MiddleName, p.LastName, p.ProfilePictureUrl })
                .ToDictionaryAsync(p => p.UserId);

            var convIds = convs.Select(c => c.Id).ToList();
            var unreadMap = await chatDb.Messages
                .Where(m => convIds.Contains(m.ConversationId) && m.SenderId != myId && m.ReadAt == null)
                .GroupBy(m => m.ConversationId)
                .Select(grp => new { ConvId = grp.Key, Count = grp.Count() })
                .ToDictionaryAsync(x => x.ConvId, x => x.Count);

            var summaries = convs.Select(c =>
            {
                var otherId = c.User1Id == myId ? c.User2Id : c.User1Id;
                profileMap.TryGetValue(otherId, out var prof);
                var name = prof is null ? otherId
                    : string.Join(" ", new[] { prof.FirstName, prof.MiddleName, prof.LastName }.Where(x => !string.IsNullOrEmpty(x)));
                return new ConversationSummaryDto(c.Id, otherId, prof?.Username, name, prof?.ProfilePictureUrl,
                    c.LastMessage, c.LastMessageAt, unreadMap.GetValueOrDefault(c.Id, 0));
            }).ToList();

            return Results.Ok(summaries);
        });

        // Get messages in a conversation
        g.MapGet("/{id:guid}/messages", async (Guid id, ClaimsPrincipal user, IChatService svc) =>
        {
            var msgs = await svc.GetMessagesAsync(id, UserId(user));
            return Results.Ok(msgs.Select(ToDto));
        });

        // Send a message
        g.MapPost("/{id:guid}/messages", async (
            Guid id,
            [FromBody] SendMessageDto dto,
            ClaimsPrincipal user,
            IChatService svc,
            IHubContext<ChatHub> hub,
            ProfilesDbContext profiles) =>
        {
            var msg = await svc.SendMessageAsync(id, UserId(user), dto.Text, dto.PostId);
            if (msg is null) return Results.NotFound();

            var msgDto = ToDto(msg);

            // Push to the recipient via SignalR
            var conv = await svc.GetConversationAsync(id, UserId(user));
            if (conv is not null)
            {
                var recipientId = conv.User1Id == UserId(user) ? conv.User2Id : conv.User1Id;
                await hub.Clients.Group($"user:{recipientId}").SendAsync("ReceiveMessage", msgDto);
            }

            return Results.Ok(msgDto);
        });

        // Mark messages as read
        g.MapPost("/{id:guid}/read", async (Guid id, ClaimsPrincipal user, IChatService svc) =>
        {
            await svc.MarkReadAsync(id, UserId(user));
            return Results.NoContent();
        });

        return app;
    }

    private static MessageDto ToDto(ChatMessage m) =>
        new(m.Id, m.ConversationId, m.SenderId, m.Text, m.SentAt, m.ReadAt, m.PostId);

    private static string UserId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)!;
}
