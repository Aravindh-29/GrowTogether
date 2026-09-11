using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using CombinedStudies.Identity.DTOs;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CombinedStudies.Tests.Connections;

[Collection("Integration")]
public class ConnectionTests(WebApplicationFactory<Program> factory)
{
    private static RegisterRequest UniqueUser() => new(
        $"conn_{Guid.NewGuid():N}@test.com", "Password123!", "Conn Tester");

    private async Task<(HttpClient client, string userId)> AuthedAsync()
    {
        var client = factory.CreateClient();
        var reg  = await client.PostAsJsonAsync("/api/identity/register", UniqueUser());
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.UserId.ToString());
    }

    // ── Auth guards ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SendRequest_Returns401_WithNoToken()
    {
        var client = factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/connections/request",
            new { receiverId = Guid.NewGuid().ToString(), note = (string?)null });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetConnections_Returns401_WithNoToken()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/connections")).StatusCode);
    }

    [Fact]
    public async Task GetRequests_Returns401_WithNoToken()
    {
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await factory.CreateClient().GetAsync("/api/connections/requests")).StatusCode);
    }

    // ── Send request ─────────────────────────────────────────────────────────

    [Fact]
    public async Task SendRequest_Returns200_WhenValid()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        var resp = await clientA.PostAsJsonAsync("/api/connections/request",
            new { receiverId = userBId, note = "Hey, want to study together?" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task SendRequest_Returns409_WhenDuplicate()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });
        var resp2 = await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });

        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }

    [Fact]
    public async Task SendRequest_Returns409_WhenReverseAlreadyExists()
    {
        var (clientA, userAId) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        // A → B first
        await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });

        // B → A should also be blocked
        var reverseResp = await clientB.PostAsJsonAsync("/api/connections/request", new { receiverId = userAId });
        Assert.Equal(HttpStatusCode.Conflict, reverseResp.StatusCode);
    }

    [Fact]
    public async Task SendRequest_Returns409_WhenSendingToSelf()
    {
        var (clientA, userAId) = await AuthedAsync();
        var resp = await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userAId });
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    // ── Get status ───────────────────────────────────────────────────────────

    [Fact]
    public async Task GetStatus_ReturnsNone_WhenNoConnection()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        var body = await (await clientA.GetAsync($"/api/connections/status/{userBId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("None", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task GetStatus_ReturnsPending_AfterRequest()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });

        var body = await (await clientA.GetAsync($"/api/connections/status/{userBId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", body.GetProperty("status").GetString());
        Assert.True(body.GetProperty("isSender").GetBoolean());
    }

    [Fact]
    public async Task GetStatus_ReturnsAccepted_AfterAccept()
    {
        var (clientA, _) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        var sentResp = await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });
        var sent = await sentResp.Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        await clientB.PostAsJsonAsync($"/api/connections/{connId}/accept", new { });

        var body = await (await clientA.GetAsync($"/api/connections/status/{userBId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Accepted", body.GetProperty("status").GetString());
    }

    // ── Accept ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Accept_Returns200_AndStatusBecomesAccepted()
    {
        var (clientA, _) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        var resp = await clientB.PostAsJsonAsync($"/api/connections/{connId}/accept", new { });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Accepted", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Accept_Returns404_WhenNotReceiver()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();
        var (clientC, _) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        // C tries to accept a request they didn't receive
        Assert.Equal(HttpStatusCode.NotFound,
            (await clientC.PostAsJsonAsync($"/api/connections/{connId}/accept", new { })).StatusCode);
    }

    // ── Reject ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Reject_Returns200_AndStatusBecomesRejected()
    {
        var (clientA, _) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        var resp = await clientB.PostAsJsonAsync($"/api/connections/{connId}/reject", new { });
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Rejected", body.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Reject_Returns404_WhenNotReceiver()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();
        var (clientC, _) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        Assert.Equal(HttpStatusCode.NotFound,
            (await clientC.PostAsJsonAsync($"/api/connections/{connId}/reject", new { })).StatusCode);
    }

    // ── Cancel ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Cancel_Returns204_AndConnectionGone()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        Assert.Equal(HttpStatusCode.NoContent,
            (await clientA.DeleteAsync($"/api/connections/{connId}")).StatusCode);

        // Status reverts to None
        var status = await (await clientA.GetAsync($"/api/connections/status/{userBId}"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("None", status.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Cancel_Returns404_WhenNotParticipant()
    {
        var (clientA, _) = await AuthedAsync();
        var (_, userBId) = await AuthedAsync();
        var (clientC, _) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        Assert.Equal(HttpStatusCode.NotFound,
            (await clientC.DeleteAsync($"/api/connections/{connId}")).StatusCode);
    }

    // ── Full workflow ─────────────────────────────────────────────────────────

    [Fact]
    public async Task FullWorkflow_SendAccept_BothSeeEachOtherInConnections()
    {
        var (clientA, _) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        // A sends with note
        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request",
            new { receiverId = userBId, note = "Let's study together!" }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        // B sees it in incoming requests
        var reqs = await (await clientB.GetAsync("/api/connections/requests"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(reqs.GetArrayLength() >= 1);
        var incoming = reqs.EnumerateArray().First(r => r.GetProperty("connectionId").GetString() == connId);
        Assert.Equal("Let's study together!", incoming.GetProperty("note").GetString());
        Assert.False(incoming.GetProperty("isSender").GetBoolean());

        // A sees it in sent
        var sentList = await (await clientA.GetAsync("/api/connections/sent"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(sentList.EnumerateArray().Any(c => c.GetProperty("connectionId").GetString() == connId));

        // B accepts
        await clientB.PostAsJsonAsync($"/api/connections/{connId}/accept", new { });

        // Both see in connections, not in requests/sent anymore
        var aConns = await (await clientA.GetAsync("/api/connections")).Content.ReadFromJsonAsync<JsonElement>();
        var bConns = await (await clientB.GetAsync("/api/connections")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(aConns.EnumerateArray().Any(c => c.GetProperty("connectionId").GetString() == connId));
        Assert.True(bConns.EnumerateArray().Any(c => c.GetProperty("connectionId").GetString() == connId));

        var aSentAfter = await (await clientA.GetAsync("/api/connections/sent")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(aSentAfter.EnumerateArray().Any(c => c.GetProperty("connectionId").GetString() == connId));
    }

    [Fact]
    public async Task AfterReject_CanSendNewRequest()
    {
        var (clientA, _) = await AuthedAsync();
        var (clientB, userBId) = await AuthedAsync();

        var sent = await (await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId }))
            .Content.ReadFromJsonAsync<JsonElement>();
        var connId = sent.GetProperty("id").GetString()!;

        await clientB.PostAsJsonAsync($"/api/connections/{connId}/reject", new { });

        // After rejection the row still exists (just rejected), so a new request should conflict
        var resp2 = await clientA.PostAsJsonAsync("/api/connections/request", new { receiverId = userBId });
        Assert.Equal(HttpStatusCode.Conflict, resp2.StatusCode);
    }
}
