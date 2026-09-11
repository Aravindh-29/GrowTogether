using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CombinedStudies.Identity.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CombinedStudies.Tests.Chat;

[Collection("Integration")]
public class ChatTests(WebApplicationFactory<Program> factory)
{
    private static RegisterRequest UniqueUser() => new(
        $"chat_{Guid.NewGuid():N}@test.com", "Password123!", "Chat Tester");

    private async Task<(HttpClient client, string userId)> AuthedAsync()
    {
        var client = factory.CreateClient();
        var reg  = await client.PostAsJsonAsync("/api/identity/register", UniqueUser());
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.UserId.ToString());
    }

    /// <summary>Creates two users that are already accepted friends.</summary>
    private async Task<(HttpClient clientA, string userAId, HttpClient clientB, string userBId)> ConnectedPairAsync()
    {
        var (clientA, userAId) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        // A sends request to B
        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        // B accepts
        await clientB.PostAsJsonAsync($"/api/connections/{connId}/accept", new { });

        return (clientA, userAId, clientB, userBId);
    }

    // ── Auth guards ──────────────────────────────────────────────────────────

    [Fact]
    public async Task StartConversation_Returns401_WithNoToken()
    {
        var resp = await factory.CreateClient().PostAsJsonAsync("/api/chats/start",
            new { userId = Guid.NewGuid().ToString() });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetConversations_Returns401_WithNoToken()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/chats")).StatusCode);
    }

    [Fact]
    public async Task GetMessages_Returns401_WithNoToken()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync($"/api/chats/{Guid.NewGuid()}/messages")).StatusCode);
    }

    // ── Start conversation ────────────────────────────────────────────────────

    [Fact]
    public async Task StartConversation_Returns200_AndCreatesConversation()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        var resp = await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var id = body.GetProperty("id").GetString();
        Assert.False(string.IsNullOrEmpty(id));
        Assert.True(Guid.TryParse(id, out _));
    }

    [Fact]
    public async Task StartConversation_Returns403_WhenNotFriends()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        // No accepted connection — must get 403
        var resp = await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId });
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task StartConversation_IsIdempotent_ReturnsSameId()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        var r1 = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var r2 = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(r1.GetProperty("id").GetString(), r2.GetProperty("id").GetString());
    }

    [Fact]
    public async Task StartConversation_IsIdempotent_WhenInitiatedFromOtherSide()
    {
        var (clientA, userAId, clientB, userBId) = await ConnectedPairAsync();

        var fromA = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();

        // B starts the same conversation — canonical User1Id < User2Id ordering means same record
        var fromB = await (await clientB.PostAsJsonAsync("/api/chats/start", new { userId = userAId }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(fromA.GetProperty("id").GetString(), fromB.GetProperty("id").GetString());
    }

    [Fact]
    public async Task StartConversation_Returns400_WhenSelfChat()
    {
        var (clientA, userAId) = await AuthedAsync();
        var resp = await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userAId });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    // ── Get conversations ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetConversations_Returns200_WithEmptyList_WhenNone()
    {
        var (clientA, _) = await AuthedAsync();
        var resp = await clientA.GetAsync("/api/chats");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Equal(0, body.GetArrayLength());
    }

    [Fact]
    public async Task GetConversations_Returns200_AfterStarting()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId });

        var body = await (await clientA.GetAsync("/api/chats"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.True(body.GetArrayLength() >= 1);
    }

    [Fact]
    public async Task GetConversations_ShowsOtherUser()
    {
        var (clientA, userAId, clientB, userBId) = await ConnectedPairAsync();

        var started = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = started.GetProperty("id").GetString()!;

        var aConvs = await (await clientA.GetAsync("/api/chats"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var theConv = aConvs.EnumerateArray().First(c => c.GetProperty("id").GetString() == convId);
        Assert.Equal(userBId, theConv.GetProperty("otherUserId").GetString());

        // B also sees it once they start from their side
        await clientB.PostAsJsonAsync("/api/chats/start", new { userId = userAId });
        var bConvs = await (await clientB.GetAsync("/api/chats"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(bConvs.EnumerateArray().Any(c => c.GetProperty("id").GetString() == convId));
    }

    // ── Get messages ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMessages_Returns200_WithEmptyList_WhenNone()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        var conv = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = conv.GetProperty("id").GetString()!;

        var resp = await clientA.GetAsync($"/api/chats/{convId}/messages");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Equal(0, body.GetArrayLength());
    }

    [Fact]
    public async Task GetMessages_Returns200_WithEmptyList_WhenNotParticipant()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();
        var (clientC, _) = await AuthedAsync();

        var conv = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = conv.GetProperty("id").GetString()!;

        // C is not a participant — service returns []
        var resp = await clientC.GetAsync($"/api/chats/{convId}/messages");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, body.GetArrayLength());
    }

    // ── Send message ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SendMessage_Returns200_AndMessageAppearsInHistory()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        var conv = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = conv.GetProperty("id").GetString()!;

        var resp = await clientA.PostAsJsonAsync($"/api/chats/{convId}/messages",
            new { text = "Hello from the test!" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var msg = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Hello from the test!", msg.GetProperty("text").GetString());
        Assert.Equal(convId, msg.GetProperty("conversationId").GetString());
        Assert.False(string.IsNullOrEmpty(msg.GetProperty("id").GetString()));

        var history = await (await clientA.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, history.GetArrayLength());
        Assert.Equal("Hello from the test!", history[0].GetProperty("text").GetString());
    }

    [Fact]
    public async Task SendMessage_Returns404_WhenNotParticipant()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();
        var (clientC, _) = await AuthedAsync();

        var conv = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = conv.GetProperty("id").GetString()!;

        var resp = await clientC.PostAsJsonAsync($"/api/chats/{convId}/messages",
            new { text = "I shouldn't be able to send this!" });
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task SendMessage_BothParticipants_CanSend()
    {
        var (clientA, userAId, clientB, userBId) = await ConnectedPairAsync();

        var convResp = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = convResp.GetProperty("id").GetString()!;

        var msgA = await (await clientA.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Hi from A!" }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var msgB = await (await clientB.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Hi from B!" }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("Hi from A!", msgA.GetProperty("text").GetString());
        Assert.Equal("Hi from B!", msgB.GetProperty("text").GetString());

        var history = await (await clientA.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, history.GetArrayLength());
    }

    // ── Mark read ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task MarkRead_Returns204()
    {
        var (clientA, _, _, userBId) = await ConnectedPairAsync();

        var conv = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = conv.GetProperty("id").GetString()!;

        var resp = await clientA.PostAsJsonAsync($"/api/chats/{convId}/read", new { });
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
    }

    [Fact]
    public async Task MarkRead_SetsReadAt_OnMessagesFromOtherUser()
    {
        var (clientA, userAId, clientB, userBId) = await ConnectedPairAsync();

        var convResp = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = convResp.GetProperty("id").GetString()!;

        // B sends a message to A
        await clientB.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Did you read this?" });

        // Before mark read — readAt is null
        var before = await (await clientA.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Null, before[0].GetProperty("readAt").ValueKind);

        // A marks as read
        await clientA.PostAsJsonAsync($"/api/chats/{convId}/read", new { });

        // After mark read — readAt is set
        var after = await (await clientA.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.NotEqual(JsonValueKind.Null, after[0].GetProperty("readAt").ValueKind);
    }

    // ── Full workflow ─────────────────────────────────────────────────────────

    [Fact]
    public async Task FullChatWorkflow_ConversationAppearsWithLastMessage()
    {
        var (clientA, userAId, clientB, userBId) = await ConnectedPairAsync();

        // A starts conversation
        var started = await (await clientA.PostAsJsonAsync("/api/chats/start", new { userId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var convId = started.GetProperty("id").GetString()!;

        // A sends two messages
        await clientA.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Message 1" });
        await clientA.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Message 2" });

        // B starts their side (idempotent, same conversation)
        await clientB.PostAsJsonAsync("/api/chats/start", new { userId = userAId });

        // B sees the conversation and last message
        var bConvs = await (await clientB.GetAsync("/api/chats"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var bTheConv = bConvs.EnumerateArray().First(c => c.GetProperty("id").GetString() == convId);
        Assert.Equal("Message 2", bTheConv.GetProperty("lastMessage").GetString());

        // B reads messages
        var messages = await (await clientB.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, messages.GetArrayLength());

        // B replies
        await clientB.PostAsJsonAsync($"/api/chats/{convId}/messages", new { text = "Got it!" });

        // B marks A's messages as read
        await clientB.PostAsJsonAsync($"/api/chats/{convId}/read", new { });

        // A sees 3 messages total
        var allMsgs = await (await clientA.GetAsync($"/api/chats/{convId}/messages"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(3, allMsgs.GetArrayLength());
        Assert.Equal("Got it!", allMsgs[2].GetProperty("text").GetString());
    }
}
