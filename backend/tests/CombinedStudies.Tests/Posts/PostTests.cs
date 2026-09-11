using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CombinedStudies.Identity.DTOs;

namespace CombinedStudies.Tests.Posts;

[Collection("Integration")]
public class PostTests(TestFixture fixture)
{
    private RegisterRequest UniqueUser()
    {
        var email = $"post_{Guid.NewGuid():N}@test.com";
        fixture.TrackEmail(email);
        return new(email, "Password123!", "Post Tester");
    }

    private async Task<HttpClient> AuthedClientAsync()
    {
        var client = fixture.CreateClient();
        var reg  = await client.PostAsJsonAsync("/api/identity/register", UniqueUser());
        var auth = await reg.Content.ReadFromJsonAsync<AuthResponse>();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static async Task<string> CreatePostAsync(HttpClient client, object body)
    {
        var resp = await client.PostAsJsonAsync("/api/posts", body);
        resp.EnsureSuccessStatusCode();
        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("id").GetString()!;
    }

    // ── Auth guards ──────────────────────────────────────────────────────────

    [Fact]
    public async Task GetFeed_Returns401_WithNoToken()
    {
        var resp = await fixture.CreateClient().GetAsync("/api/posts/feed");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task GetMine_Returns401_WithNoToken()
    {
        var resp = await fixture.CreateClient().GetAsync("/api/posts/mine");
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task CreatePost_Returns401_WithNoToken()
    {
        var resp = await fixture.CreateClient().PostAsJsonAsync("/api/posts", new { content = "hello" });
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task CreatePost_Returns201_WithContent()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new { content = "My first post!" });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("My first post!", body.GetProperty("content").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("id").GetString()));
        Assert.Equal(0, body.GetProperty("likesCount").GetInt32());
        Assert.False(body.GetProperty("likedByMe").GetBoolean());
    }

    [Fact]
    public async Task CreatePost_Returns400_WhenContentEmpty()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new { content = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task CreatePost_DefaultAudience_IsAnyone()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new { content = "Default audience" });
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal("anyone", body.GetProperty("audience").GetString());
        Assert.Equal("anyone", body.GetProperty("commentVisibility").GetString());
    }

    [Fact]
    public async Task CreatePost_WithConnectionsAudience_IsPersisted()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new
        {
            content = "Connections only post",
            audience = "connections",
            commentVisibility = "connections"
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("connections", body.GetProperty("audience").GetString());
        Assert.Equal("connections", body.GetProperty("commentVisibility").GetString());
    }

    [Fact]
    public async Task CreatePost_WithImageUrl_IsPersisted()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new
        {
            content = "Post with image",
            imageUrls = new[] { "http://fake-storage/test-bucket/posts/test.jpg" }
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var urls = body.GetProperty("imageUrls");
        Assert.Equal(1, urls.GetArrayLength());
        Assert.Equal("http://fake-storage/test-bucket/posts/test.jpg", urls[0].GetString());
    }

    [Fact]
    public async Task CreatePost_WithDocument_IsPersisted()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new
        {
            content = "Post with doc",
            documentUrl = "http://fake-storage/test-bucket/docs/test.pdf",
            documentName = "report.pdf"
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("http://fake-storage/test-bucket/docs/test.pdf",
            body.GetProperty("documentUrl").GetString());
        Assert.Equal("report.pdf", body.GetProperty("documentName").GetString());
    }

    [Fact]
    public async Task CreatePost_WithPoll_StoresPollData()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/posts", new
        {
            content = "What do you prefer?",
            pollQuestion = "Tabs or spaces?",
            pollOptions = new[] { "Tabs", "Spaces" }
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Tabs or spaces?", body.GetProperty("pollQuestion").GetString());
        var opts = body.GetProperty("pollOptions").EnumerateArray()
            .Select(o => o.GetString()).ToList();
        Assert.Contains("Tabs", opts);
        Assert.Contains("Spaces", opts);
    }

    [Fact]
    public async Task CreatePost_WithScheduledAt_StoresScheduledAt()
    {
        var client = await AuthedClientAsync();
        var scheduled = DateTime.UtcNow.AddDays(1).ToString("o");
        var resp = await client.PostAsJsonAsync("/api/posts", new
        {
            content = "Scheduled post",
            scheduledAt = scheduled
        });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("scheduledAt").ValueKind == JsonValueKind.Null);
    }

    // ── Image upload ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UploadImage_Returns200_WithPublicUrl()
    {
        var client = await AuthedClientAsync();

        using var form = new MultipartFormDataContent();
        var fakeBytes = new byte[100];
        var fileContent = new ByteArrayContent(fakeBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "test.png");

        var resp = await client.PostAsync("/api/posts/upload-image", form);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var url = body.GetProperty("url").GetString()!;
        Assert.False(string.IsNullOrEmpty(url));
        Assert.Contains("posts/", url);
        Assert.EndsWith(".png", url);
    }

    [Fact]
    public async Task UploadImage_Returns400_ForInvalidExtension()
    {
        var client = await AuthedClientAsync();

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[100]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(fileContent, "file", "virus.exe");

        var resp = await client.PostAsync("/api/posts/upload-image", form);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task UploadImage_Returns400_WhenNoFile()
    {
        var client = await AuthedClientAsync();
        // Send a form with a text field but no file — server sees 0 files and returns 400
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("no_file"), "other_field");
        var resp = await client.PostAsync("/api/posts/upload-image", form);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task UploadImage_Returns400_ForOversizedFile()
    {
        var client = await AuthedClientAsync();

        using var form = new MultipartFormDataContent();
        var bigBytes = new byte[11 * 1024 * 1024]; // 11 MB > 10 MB limit
        var fileContent = new ByteArrayContent(bigBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(fileContent, "file", "big.jpg");

        var resp = await client.PostAsync("/api/posts/upload-image", form);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    // ── Document upload ───────────────────────────────────────────────────────

    [Fact]
    public async Task UploadDocument_Returns200_WithUrlAndOriginalName()
    {
        var client = await AuthedClientAsync();

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes("%PDF-1.4 fake pdf"));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(fileContent, "file", "report.pdf");

        var resp = await client.PostAsync("/api/posts/upload-document", form);

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var url = body.GetProperty("url").GetString()!;
        Assert.Contains("docs/", url);
        Assert.EndsWith(".pdf", url);
        Assert.Equal("report.pdf", body.GetProperty("name").GetString());
    }

    [Fact]
    public async Task UploadDocument_Returns400_ForInvalidExtension()
    {
        var client = await AuthedClientAsync();

        using var form = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(new byte[100]);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(fileContent, "file", "photo.png");

        var resp = await client.PostAsync("/api/posts/upload-document", form);
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task UploadDocument_Returns401_WithNoToken()
    {
        var client = fixture.CreateClient();
        using var form = new MultipartFormDataContent();
        var resp = await client.PostAsync("/api/posts/upload-document", form);
        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    // ── My posts ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetMine_ReturnsEmptyList_WhenNoPosts()
    {
        var client = await AuthedClientAsync();
        var body = await (await client.GetAsync("/api/posts/mine"))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, body.ValueKind);
        Assert.Equal(0, body.GetArrayLength());
    }

    [Fact]
    public async Task GetMine_ReturnsOnlyCurrentUserPosts()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        await clientA.PostAsJsonAsync("/api/posts", new { content = "A's post" });
        await clientB.PostAsJsonAsync("/api/posts", new { content = "B's post" });

        var mine = await (await clientA.GetAsync("/api/posts/mine"))
            .Content.ReadFromJsonAsync<JsonElement>();

        foreach (var post in mine.EnumerateArray())
            Assert.NotEqual("B's post", post.GetProperty("content").GetString());
    }

    // ── Feed ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GetFeed_ReturnsAllUsersPostsOrderedByNewest()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        await clientA.PostAsJsonAsync("/api/posts", new { content = "Post from A" });
        await clientB.PostAsJsonAsync("/api/posts", new { content = "Post from B" });

        var feed = await (await clientA.GetAsync("/api/posts/feed"))
            .Content.ReadFromJsonAsync<JsonElement>();

        var items = feed.GetProperty("items");
        Assert.True(items.GetArrayLength() >= 2);

        var contents = items.EnumerateArray().Select(p => p.GetProperty("content").GetString()).ToList();
        var idxA = contents.IndexOf("Post from A");
        var idxB = contents.IndexOf("Post from B");
        Assert.True(idxA >= 0 && idxB >= 0);
        Assert.True(idxB < idxA, "Newer post (B) should appear before older post (A)");
    }

    [Fact]
    public async Task GetFeed_NoDuplicatePosts()
    {
        var client = await AuthedClientAsync();
        await client.PostAsJsonAsync("/api/posts", new { content = "Unique post for dup check" });

        var feed = await (await client.GetAsync("/api/posts/feed"))
            .Content.ReadFromJsonAsync<JsonElement>();

        var ids = feed.GetProperty("items").EnumerateArray()
            .Select(p => p.GetProperty("id").GetString()).ToList();

        Assert.Equal(ids.Count, ids.Distinct().Count());
    }

    [Fact]
    public async Task GetFeed_Pagination_RespectsPageSize()
    {
        var client = await AuthedClientAsync();

        var feed = await (await client.GetAsync("/api/posts/feed?page=1&pageSize=3"))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.True(feed.GetProperty("items").GetArrayLength() <= 3);
        Assert.Equal(1, feed.GetProperty("page").GetInt32());
        Assert.Equal(3, feed.GetProperty("pageSize").GetInt32());
    }

    // ── Update ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdatePost_Returns200_WithNewContent()
    {
        var client = await AuthedClientAsync();
        var postId = await CreatePostAsync(client, new { content = "Original" });

        var resp = await client.PutAsJsonAsync($"/api/posts/{postId}", new { content = "Updated content" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated content", body.GetProperty("content").GetString());
    }

    [Fact]
    public async Task UpdatePost_CanChangeAudience()
    {
        var client = await AuthedClientAsync();
        var postId = await CreatePostAsync(client, new { content = "Public post", audience = "anyone" });

        var resp = await client.PutAsJsonAsync($"/api/posts/{postId}",
            new { content = "Now private", audience = "connections" });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("connections", body.GetProperty("audience").GetString());
    }

    [Fact]
    public async Task UpdatePost_Returns404_WhenNotOwner()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "A's post" });
        var resp = await clientB.PutAsJsonAsync($"/api/posts/{postId}", new { content = "Hijack!" });
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task DeletePost_Returns204_AndRemovedFromMine()
    {
        var client = await AuthedClientAsync();
        var postId = await CreatePostAsync(client, new { content = "Delete me" });

        var deleteResp = await client.DeleteAsync($"/api/posts/{postId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        var mine = await (await client.GetAsync("/api/posts/mine"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var ids = mine.EnumerateArray().Select(p => p.GetProperty("id").GetString()).ToList();
        Assert.DoesNotContain(postId, ids);
    }

    [Fact]
    public async Task DeletePost_Returns404_WhenNotOwner()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "A's post" });
        var resp = await clientB.DeleteAsync($"/api/posts/{postId}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Like / Unlike ─────────────────────────────────────────────────────────

    [Fact]
    public async Task ToggleLike_IncreasesLikeCount()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Like this!" });
        var liked = await (await clientB.PostAsJsonAsync($"/api/posts/{postId}/like", new { }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(1, liked.GetProperty("likesCount").GetInt32());
        Assert.True(liked.GetProperty("likedByMe").GetBoolean());
    }

    [Fact]
    public async Task ToggleLike_Twice_UnlikesPost()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Toggle like" });
        await clientB.PostAsJsonAsync($"/api/posts/{postId}/like", new { });
        var unliked = await (await clientB.PostAsJsonAsync($"/api/posts/{postId}/like", new { }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(0, unliked.GetProperty("likesCount").GetInt32());
        Assert.False(unliked.GetProperty("likedByMe").GetBoolean());
    }

    [Fact]
    public async Task ToggleLike_Returns404_ForNonExistentPost()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync($"/api/posts/{Guid.NewGuid()}/like", new { });
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Repost / Un-repost ───────────────────────────────────────────────────

    [Fact]
    public async Task ToggleRepost_IncreasesRepostCount()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Repost me!" });
        var reposted = await (await clientB.PostAsJsonAsync($"/api/posts/{postId}/repost", new { }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(1, reposted.GetProperty("repostsCount").GetInt32());
        Assert.True(reposted.GetProperty("repostedByMe").GetBoolean());
    }

    [Fact]
    public async Task ToggleRepost_Twice_RemovesRepost()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Toggle repost" });
        await clientB.PostAsJsonAsync($"/api/posts/{postId}/repost", new { });
        var unReposted = await (await clientB.PostAsJsonAsync($"/api/posts/{postId}/repost", new { }))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(0, unReposted.GetProperty("repostsCount").GetInt32());
        Assert.False(unReposted.GetProperty("repostedByMe").GetBoolean());
    }

    [Fact]
    public async Task ToggleRepost_Returns404_ForNonExistentPost()
    {
        var client = await AuthedClientAsync();
        var resp = await client.PostAsJsonAsync($"/api/posts/{Guid.NewGuid()}/repost", new { });
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    // ── Comments ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task AddComment_Returns201_WithContent()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Commentable post" });
        var resp = await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments",
            new { content = "Nice post!" });

        Assert.Equal(HttpStatusCode.Created, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Nice post!", body.GetProperty("content").GetString());
        Assert.Equal(postId, body.GetProperty("postId").GetString());
    }

    [Fact]
    public async Task GetComments_ReturnsPostedComments_InOrder()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Post with comments" });
        await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments", new { content = "First!" });
        await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments", new { content = "Second!" });

        var comments = await (await clientA.GetAsync($"/api/posts/{postId}/comments"))
            .Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(JsonValueKind.Array, comments.ValueKind);
        Assert.Equal(2, comments.GetArrayLength());
        Assert.Equal("First!", comments[0].GetProperty("content").GetString());
        Assert.Equal("Second!", comments[1].GetProperty("content").GetString());
    }

    [Fact]
    public async Task CommentsCount_IncrementsOnFeed_AfterAddingComment()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Count comments" });
        await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments", new { content = "Hello" });

        var feed = await (await clientA.GetAsync("/api/posts/feed"))
            .Content.ReadFromJsonAsync<JsonElement>();

        var post = feed.GetProperty("items").EnumerateArray()
            .FirstOrDefault(p => p.GetProperty("id").GetString() == postId);
        Assert.True(post.GetProperty("commentsCount").GetInt32() >= 1);
    }

    [Fact]
    public async Task DeleteComment_Returns204_ByOwner()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Delete comment test" });
        var commentResp = await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments",
            new { content = "Remove me" });
        var comment = await commentResp.Content.ReadFromJsonAsync<JsonElement>();
        var commentId = comment.GetProperty("id").GetString()!;

        var deleteResp = await clientB.DeleteAsync($"/api/posts/{postId}/comments/{commentId}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

        var remaining = await (await clientA.GetAsync($"/api/posts/{postId}/comments"))
            .Content.ReadFromJsonAsync<JsonElement>();
        var ids = remaining.EnumerateArray().Select(c => c.GetProperty("id").GetString()).ToList();
        Assert.DoesNotContain(commentId, ids);
    }

    [Fact]
    public async Task DeleteComment_Returns404_WhenNotCommentOwner()
    {
        var clientA = await AuthedClientAsync();
        var clientB = await AuthedClientAsync();
        var clientC = await AuthedClientAsync();

        var postId = await CreatePostAsync(clientA, new { content = "Post" });
        var commentResp = await clientB.PostAsJsonAsync($"/api/posts/{postId}/comments",
            new { content = "B's comment" });
        var comment = await commentResp.Content.ReadFromJsonAsync<JsonElement>();
        var commentId = comment.GetProperty("id").GetString()!;

        var resp = await clientC.DeleteAsync($"/api/posts/{postId}/comments/{commentId}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task AddComment_Returns400_WhenContentEmpty()
    {
        var client = await AuthedClientAsync();
        var postId = await CreatePostAsync(client, new { content = "Post" });
        var resp = await client.PostAsJsonAsync($"/api/posts/{postId}/comments", new { content = "" });
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }
}
