using CombinedStudies.Posts.Data;
using CombinedStudies.Posts.DTOs;
using CombinedStudies.Posts.Entities;
using CombinedStudies.Profiles.Data;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Posts.Services;

public class PostService(PostsDbContext db, ProfilesDbContext profiles) : IPostService
{
    private static string Name(string? first, string? last)
        => $"{first} {last}".Trim() is { Length: > 0 } n ? n : "Unknown";

    private async Task<Dictionary<string, (string name, string? avatar, string? headline)>> AuthorMapAsync(
        IEnumerable<string> authorIds)
    {
        var ids = authorIds.Distinct().ToList();
        return await profiles.Profiles
            .Where(p => ids.Contains(p.UserId))
            .Select(p => new { p.UserId, p.FirstName, p.LastName, p.ProfilePictureUrl, p.Headline })
            .ToDictionaryAsync(p => p.UserId,
                p => (Name(p.FirstName, p.LastName), (string?)p.ProfilePictureUrl, (string?)p.Headline));
    }

    private PostDto ToDto(Post p, string myUserId,
        Dictionary<string, (string name, string? avatar, string? headline)> authorMap)
    {
        authorMap.TryGetValue(p.AuthorId, out var a);
        return new PostDto(
            p.Id, p.AuthorId,
            a.name ?? "Unknown", a.avatar, a.headline,
            p.Content, p.ImageUrls, p.DocumentUrl, p.DocumentName,
            p.PollQuestion, p.PollOptions, p.ScheduledAt,
            p.Audience, p.CommentVisibility,
            p.CreatedAt, p.UpdatedAt,
            p.Likes.Count, p.Likes.Any(l => l.UserId == myUserId),
            p.Comments.Count, p.Reposts.Count, p.Reposts.Any(r => r.UserId == myUserId),
            p.Reactions.Count(r => r.Type == "agree"),
            p.Reactions.Count(r => r.Type == "disagree"),
            p.Reactions.Any(r => r.UserId == myUserId && r.Type == "agree"),
            p.Reactions.Any(r => r.UserId == myUserId && r.Type == "disagree"),
            p.Saves.Any(s => s.UserId == myUserId),
            p.PollOptions.Count == 0 ? [] : Enumerable.Range(0, p.PollOptions.Count)
                .Select(i => p.PollVotes.Count(v => v.OptionIndex == i)).ToList(),
            p.PollVotes.FirstOrDefault(v => v.UserId == myUserId)?.OptionIndex
        );
    }

    private static IQueryable<Post> WithAll(IQueryable<Post> q) =>
        q.Include(p => p.Likes).Include(p => p.Comments).Include(p => p.Reposts)
         .Include(p => p.Reactions).Include(p => p.Saves).Include(p => p.PollVotes);

    public async Task<PostDto?> GetByIdAsync(Guid postId, string myUserId)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == postId);
        if (post is null) return null;
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, myUserId, map);
    }

    public async Task<PostFeedResponse> GetFeedAsync(int page, int pageSize, string myUserId)
    {
        var total = await db.Posts.CountAsync();
        var posts = await WithAll(db.Posts)
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        var map = await AuthorMapAsync(posts.Select(p => p.AuthorId));
        return new PostFeedResponse(posts.Select(p => ToDto(p, myUserId, map)).ToList(), total, page, pageSize);
    }

    public async Task<List<PostDto>> GetMyPostsAsync(string userId)
    {
        var posts = await WithAll(db.Posts)
            .Where(p => p.AuthorId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();
        var map = await AuthorMapAsync([userId]);
        return posts.Select(p => ToDto(p, userId, map)).ToList();
    }

    public async Task<PostDto?> CreateAsync(string userId, CreatePostRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Content)) return null;
        var post = Post.Create(userId, req.Content.Trim(),
            req.ImageUrls, req.DocumentUrl, req.DocumentName,
            req.PollQuestion, req.PollOptions, req.ScheduledAt,
            req.Audience ?? "anyone", req.CommentVisibility ?? "anyone");
        db.Posts.Add(post);
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([userId]);
        return ToDto(post, userId, map);
    }

    public async Task<PostDto?> UpdateAsync(Guid id, string userId, UpdatePostRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Content)) return null;
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == id);
        if (post is null || post.AuthorId != userId) return null;
        post.Update(req.Content.Trim(),
            req.ImageUrls, req.DocumentUrl, req.DocumentName,
            req.PollQuestion, req.PollOptions, req.ScheduledAt,
            req.Audience ?? "anyone", req.CommentVisibility ?? "anyone");
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([userId]);
        return ToDto(post, userId, map);
    }

    public async Task<bool> DeleteAsync(Guid id, string userId)
    {
        var post = await db.Posts.FirstOrDefaultAsync(p => p.Id == id);
        if (post is null || post.AuthorId != userId) return false;
        db.Posts.Remove(post);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<PostDto?> ToggleLikeAsync(Guid id, string userId)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == id);
        if (post is null) return null;
        var existing = post.Likes.FirstOrDefault(l => l.UserId == userId);
        if (existing is not null) post.Likes.Remove(existing);
        else post.Likes.Add(new PostLike { PostId = id, UserId = userId });
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, userId, map);
    }

    public async Task<PostDto?> ToggleRepostAsync(Guid id, string userId)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == id);
        if (post is null) return null;
        var existing = post.Reposts.FirstOrDefault(r => r.UserId == userId);
        if (existing is not null) post.Reposts.Remove(existing);
        else post.Reposts.Add(new PostRepost { PostId = id, UserId = userId });
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, userId, map);
    }

    public async Task<List<PostCommentDto>> GetCommentsAsync(Guid postId)
    {
        var comments = await db.PostComments
            .Where(c => c.PostId == postId).OrderBy(c => c.CreatedAt).ToListAsync();
        var map = await AuthorMapAsync(comments.Select(c => c.AuthorId));
        return comments.Select(c =>
        {
            map.TryGetValue(c.AuthorId, out var a);
            return new PostCommentDto(c.Id, c.PostId, c.AuthorId,
                a.name ?? "Unknown", a.avatar, c.Content, c.CreatedAt);
        }).ToList();
    }

    public async Task<PostCommentDto?> AddCommentAsync(Guid postId, string userId, string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        var post = await db.Posts.FindAsync(postId);
        if (post is null) return null;
        var comment = new PostComment { PostId = postId, AuthorId = userId, Content = content.Trim() };
        db.PostComments.Add(comment);
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([userId]);
        map.TryGetValue(userId, out var a);
        _ = CreateActivityAsync(postId, post.AuthorId, userId, "comment",
            content.Length > 120 ? content[..120] : content);
        return new PostCommentDto(comment.Id, comment.PostId, comment.AuthorId,
            a.name ?? "Unknown", a.avatar, comment.Content, comment.CreatedAt);
    }

    public async Task<bool> DeleteCommentAsync(Guid commentId, string userId)
    {
        var comment = await db.PostComments.FindAsync(commentId);
        if (comment is null || comment.AuthorId != userId) return false;
        db.PostComments.Remove(comment);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<PostDto?> ToggleReactionAsync(Guid id, string userId, string type)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == id);
        if (post is null) return null;
        var existing = post.Reactions.FirstOrDefault(r => r.UserId == userId);
        bool isAdding = existing is null || existing.Type != type;
        if (existing is not null)
        {
            if (existing.Type == type) post.Reactions.Remove(existing);
            else existing.Type = type;
        }
        else post.Reactions.Add(new PostReaction { PostId = id, UserId = userId, Type = type });
        await db.SaveChangesAsync();
        if (isAdding) _ = CreateActivityAsync(id, post.AuthorId, userId, type);
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, userId, map);
    }

    public async Task<PostDto?> ToggleSaveAsync(Guid id, string userId)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == id);
        if (post is null) return null;
        var existing = post.Saves.FirstOrDefault(s => s.UserId == userId);
        if (existing is not null) post.Saves.Remove(existing);
        else post.Saves.Add(new PostSave { PostId = id, UserId = userId });
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, userId, map);
    }

    public async Task<PostFeedResponse> GetSavedAsync(string userId, int page, int pageSize)
    {
        var savedIds = await db.PostSaves
            .Where(s => s.UserId == userId)
            .Select(s => s.PostId)
            .ToListAsync();
        var total = savedIds.Count;
        var posts = await WithAll(db.Posts)
            .Where(p => savedIds.Contains(p.Id))
            .OrderByDescending(p => p.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync();
        var map = await AuthorMapAsync(posts.Select(p => p.AuthorId));
        return new PostFeedResponse(posts.Select(p => ToDto(p, userId, map)).ToList(), total, page, pageSize);
    }

    public async Task<PostDto?> VotePollAsync(Guid postId, string userId, int optionIndex)
    {
        var post = await WithAll(db.Posts).FirstOrDefaultAsync(p => p.Id == postId);
        if (post is null || post.PollOptions.Count == 0 || optionIndex < 0 || optionIndex >= post.PollOptions.Count)
            return null;
        var existing = post.PollVotes.FirstOrDefault(v => v.UserId == userId);
        if (existing is not null)
        {
            if (existing.OptionIndex == optionIndex) return null; // already voted for this option
            existing.OptionIndex = optionIndex;
        }
        else
            post.PollVotes.Add(new PostPollVote { PostId = postId, UserId = userId, OptionIndex = optionIndex });
        await db.SaveChangesAsync();
        var map = await AuthorMapAsync([post.AuthorId]);
        return ToDto(post, userId, map);
    }

    public async Task<List<PostReactionUserDto>> GetReactionsAsync(Guid postId)
    {
        var reactions = await db.PostReactions
            .Where(r => r.PostId == postId)
            .OrderBy(r => r.CreatedAt)
            .ToListAsync();
        if (reactions.Count == 0) return [];
        var map = await AuthorMapAsync(reactions.Select(r => r.UserId));
        return reactions.Select(r =>
        {
            map.TryGetValue(r.UserId, out var a);
            return new PostReactionUserDto(r.UserId, a.name ?? "Unknown", a.avatar, r.Type);
        }).ToList();
    }

    private async Task CreateActivityAsync(Guid postId, string postAuthorId, string actorId, string type, string? extraText = null)
    {
        if (actorId == postAuthorId) return;
        var existing = await db.PostActivities
            .FirstOrDefaultAsync(a => a.PostId == postId && a.ActorId == actorId && a.Type == type);
        if (existing is not null)
        {
            existing.IsRead = false;
            existing.CreatedAt = DateTime.UtcNow;
            existing.ExtraText = extraText;
        }
        else
        {
            db.PostActivities.Add(new PostActivity
            {
                PostId = postId,
                PostAuthorId = postAuthorId,
                ActorId = actorId,
                Type = type,
                ExtraText = extraText
            });
        }
        await db.SaveChangesAsync();
    }

    public async Task<List<PostActivityDto>> GetActivityAsync(string userId, int limit)
    {
        var activities = await db.PostActivities
            .Where(a => a.PostAuthorId == userId)
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .ToListAsync();
        if (activities.Count == 0) return [];
        var map = await AuthorMapAsync(activities.Select(a => a.ActorId));
        return activities.Select(a =>
        {
            map.TryGetValue(a.ActorId, out var actor);
            return new PostActivityDto(a.Id, a.PostId, a.ActorId,
                actor.name ?? "Unknown", actor.avatar, a.Type, a.ExtraText, a.IsRead, a.CreatedAt);
        }).ToList();
    }

    public async Task MarkActivityReadAsync(string userId)
    {
        await db.PostActivities
            .Where(a => a.PostAuthorId == userId && !a.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(a => a.IsRead, true));
    }

    public async Task<int> GetUnreadActivityCountAsync(string userId)
        => await db.PostActivities.CountAsync(a => a.PostAuthorId == userId && !a.IsRead);
}
