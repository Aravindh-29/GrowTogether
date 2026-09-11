using System.Security.Claims;
using CombinedStudies.Api.Services;
using CombinedStudies.Posts.DTOs;
using CombinedStudies.Posts.Services;
using Microsoft.AspNetCore.Mvc;

namespace CombinedStudies.Api.Endpoints;

public static class PostEndpoints
{
    public static IEndpointRouteBuilder MapPostEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/posts").WithTags("Posts").RequireAuthorization();

        // POST /api/posts/upload-image
        g.MapPost("/upload-image", async (HttpRequest request, IStorageService storage) =>
        {
            if (!request.HasFormContentType || request.Form.Files.Count == 0)
                return Results.BadRequest(new { error = "No file provided." });
            var file = request.Form.Files[0];
            if (file.Length == 0) return Results.BadRequest(new { error = "File is empty." });
            if (file.Length > 10 * 1024 * 1024) return Results.BadRequest(new { error = "File too large (max 10 MB)." });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".jpg" or ".jpeg" or ".png" or ".gif" or ".webp"))
                return Results.BadRequest(new { error = "Only jpg/png/gif/webp allowed." });
            var objectName = $"posts/{Guid.NewGuid()}{ext}";
            var contentType = file.ContentType.StartsWith("image/") ? file.ContentType : "image/jpeg";
            await using var stream = file.OpenReadStream();
            var key = await storage.UploadAsync(stream, objectName, contentType, file.Length);
            return Results.Ok(new { url = storage.PublicUrl(key) });
        }).DisableAntiforgery();

        // POST /api/posts/upload-document
        g.MapPost("/upload-document", async (HttpRequest request, IStorageService storage) =>
        {
            if (!request.HasFormContentType || request.Form.Files.Count == 0)
                return Results.BadRequest(new { error = "No file provided." });
            var file = request.Form.Files[0];
            if (file.Length == 0) return Results.BadRequest(new { error = "File is empty." });
            if (file.Length > 25 * 1024 * 1024) return Results.BadRequest(new { error = "File too large (max 25 MB)." });
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".pdf" or ".doc" or ".docx" or ".ppt" or ".pptx" or ".xls" or ".xlsx" or ".txt" or ".csv"))
                return Results.BadRequest(new { error = "Unsupported document type." });
            var objectName = $"docs/{Guid.NewGuid()}{ext}";
            var contentType = file.ContentType is { Length: > 0 } ct ? ct : "application/octet-stream";
            await using var stream = file.OpenReadStream();
            var key = await storage.UploadAsync(stream, objectName, contentType, file.Length);
            return Results.Ok(new { url = storage.PublicUrl(key), name = file.FileName });
        }).DisableAntiforgery();

        // GET /api/posts/feed?page=1&pageSize=20
        g.MapGet("/feed", async (
            ClaimsPrincipal user,
            IPostService svc,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            var myId = UserId(user);
            if (page < 1) page = 1;
            if (pageSize is < 1 or > 50) pageSize = 20;
            var result = await svc.GetFeedAsync(page, pageSize, myId);
            return Results.Ok(result);
        });

        // GET /api/posts/mine
        g.MapGet("/mine", async (ClaimsPrincipal user, IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.GetMyPostsAsync(myId);
            return Results.Ok(result);
        });

        // GET /api/posts/saved
        g.MapGet("/saved", async (
            ClaimsPrincipal user,
            IPostService svc,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20) =>
        {
            var myId = UserId(user);
            if (page < 1) page = 1;
            if (pageSize is < 1 or > 50) pageSize = 20;
            var result = await svc.GetSavedAsync(myId, page, pageSize);
            return Results.Ok(result);
        });

        // POST /api/posts
        g.MapPost("/", async (
            [FromBody] CreatePostRequest dto,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.CreateAsync(myId, dto);
            if (result is null) return Results.BadRequest(new { error = "Content cannot be empty." });
            return Results.Created($"/api/posts/{result.Id}", result);
        });

        // GET /api/posts/{id}
        g.MapGet("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.GetByIdAsync(id, myId);
            return result is null ? Results.NotFound() : Results.Ok(result);
        });

        // PUT /api/posts/{id}
        g.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] UpdatePostRequest dto,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.UpdateAsync(id, myId, dto);
            if (result is null) return Results.NotFound();
            return Results.Ok(result);
        });

        // DELETE /api/posts/{id}
        g.MapDelete("/{id:guid}", async (
            Guid id,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var ok = await svc.DeleteAsync(id, myId);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // POST /api/posts/{id}/like
        g.MapPost("/{id:guid}/like", async (
            Guid id,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.ToggleLikeAsync(id, myId);
            if (result is null) return Results.NotFound();
            return Results.Ok(result);
        });

        // POST /api/posts/{id}/repost
        g.MapPost("/{id:guid}/repost", async (
            Guid id,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.ToggleRepostAsync(id, myId);
            if (result is null) return Results.NotFound();
            return Results.Ok(result);
        });

        // GET /api/posts/{id}/comments
        g.MapGet("/{id:guid}/comments", async (
            Guid id,
            IPostService svc) =>
        {
            var result = await svc.GetCommentsAsync(id);
            return Results.Ok(result);
        });

        // POST /api/posts/{id}/comments
        g.MapPost("/{id:guid}/comments", async (
            Guid id,
            [FromBody] CreateCommentRequest dto,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.AddCommentAsync(id, myId, dto.Content);
            if (result is null) return Results.BadRequest(new { error = "Post not found or empty content." });
            return Results.Created($"/api/posts/{id}/comments/{result.Id}", result);
        });

        // DELETE /api/posts/{id}/comments/{commentId}
        g.MapDelete("/{id:guid}/comments/{commentId:guid}", async (
            Guid id,
            Guid commentId,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var ok = await svc.DeleteCommentAsync(commentId, myId);
            return ok ? Results.NoContent() : Results.NotFound();
        });

        // POST /api/posts/{id}/react?type=agree|disagree
        g.MapPost("/{id:guid}/react", async (
            Guid id,
            [FromQuery] string type,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            if (type is not ("agree" or "disagree")) return Results.BadRequest(new { error = "type must be agree or disagree" });
            var myId = UserId(user);
            var result = await svc.ToggleReactionAsync(id, myId, type);
            if (result is null) return Results.NotFound();
            return Results.Ok(result);
        });

        // POST /api/posts/{id}/save
        g.MapPost("/{id:guid}/save", async (
            Guid id,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.ToggleSaveAsync(id, myId);
            if (result is null) return Results.NotFound();
            return Results.Ok(result);
        });

        // POST /api/posts/{id}/poll-vote?option=0
        g.MapPost("/{id:guid}/poll-vote", async (
            Guid id,
            [FromQuery] int option,
            ClaimsPrincipal user,
            IPostService svc) =>
        {
            var myId = UserId(user);
            var result = await svc.VotePollAsync(id, myId, option);
            if (result is null) return Results.BadRequest();
            return Results.Ok(result);
        });

        // GET /api/posts/{id}/reactions
        g.MapGet("/{id:guid}/reactions", async (Guid id, IPostService svc) =>
            Results.Ok(await svc.GetReactionsAsync(id)));

        // GET /api/posts/activity
        g.MapGet("/activity", async (
            ClaimsPrincipal user,
            IPostService svc,
            [FromQuery] int limit = 30) =>
        {
            var myId = UserId(user);
            return Results.Ok(await svc.GetActivityAsync(myId, limit));
        });

        // POST /api/posts/activity/mark-read
        g.MapPost("/activity/mark-read", async (ClaimsPrincipal user, IPostService svc) =>
        {
            await svc.MarkActivityReadAsync(UserId(user));
            return Results.Ok();
        });

        return app;
    }

    private static string UserId(ClaimsPrincipal user) =>
        user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? user.FindFirst("sub")?.Value
        ?? throw new InvalidOperationException("No user id in token");
}
