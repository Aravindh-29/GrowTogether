using CombinedStudies.Posts.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Posts.Data;

public class PostsDbContext(DbContextOptions<PostsDbContext> opts) : DbContext(opts)
{
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostLike> PostLikes => Set<PostLike>();
    public DbSet<PostComment> PostComments => Set<PostComment>();
    public DbSet<PostRepost> PostReposts => Set<PostRepost>();
    public DbSet<PostReaction> PostReactions => Set<PostReaction>();
    public DbSet<PostSave> PostSaves => Set<PostSave>();
    public DbSet<PostActivity> PostActivities => Set<PostActivity>();
    public DbSet<PostPollVote> PostPollVotes => Set<PostPollVote>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.HasDefaultSchema("posts");

        var post = m.Entity<Post>();
        post.Property(p => p.AuthorId).HasMaxLength(64);
        post.Property(p => p.Content).HasMaxLength(3000);
        post.Property(p => p.DocumentName).HasMaxLength(255);
        post.Property(p => p.PollQuestion).HasMaxLength(300);
        post.Property(p => p.PollOptions).HasColumnType("jsonb");
        post.Property(p => p.ImageUrls).HasColumnType("jsonb").HasDefaultValueSql("'[]'::jsonb");
        post.Property(p => p.Audience).HasMaxLength(20).HasDefaultValue("anyone");
        post.Property(p => p.CommentVisibility).HasMaxLength(20).HasDefaultValue("anyone");

        var like = m.Entity<PostLike>();
        like.HasKey(l => new { l.PostId, l.UserId });
        like.Property(l => l.UserId).HasMaxLength(64);

        var comment = m.Entity<PostComment>();
        comment.Property(c => c.AuthorId).HasMaxLength(64);
        comment.Property(c => c.Content).HasMaxLength(2000);

        var repost = m.Entity<PostRepost>();
        repost.HasKey(r => new { r.PostId, r.UserId });
        repost.Property(r => r.UserId).HasMaxLength(64);

        var reaction = m.Entity<PostReaction>();
        reaction.HasKey(r => new { r.PostId, r.UserId });
        reaction.Property(r => r.UserId).HasMaxLength(64);
        reaction.Property(r => r.Type).HasMaxLength(10);

        var save = m.Entity<PostSave>();
        save.HasKey(s => new { s.PostId, s.UserId });
        save.Property(s => s.UserId).HasMaxLength(64);

        var vote = m.Entity<PostPollVote>();
        vote.HasKey(v => new { v.PostId, v.UserId });
        vote.Property(v => v.UserId).HasMaxLength(64);

        var activity = m.Entity<PostActivity>();
        activity.Property(a => a.PostAuthorId).HasMaxLength(64);
        activity.Property(a => a.ActorId).HasMaxLength(64);
        activity.Property(a => a.Type).HasMaxLength(20);
        activity.Property(a => a.ExtraText).HasMaxLength(200);
        activity.HasIndex(a => new { a.PostAuthorId, a.IsRead });
    }
}
