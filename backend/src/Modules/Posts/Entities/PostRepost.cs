namespace CombinedStudies.Posts.Entities;

public class PostRepost
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = "";
    public DateTime RepostedAt { get; set; } = DateTime.UtcNow;
}
