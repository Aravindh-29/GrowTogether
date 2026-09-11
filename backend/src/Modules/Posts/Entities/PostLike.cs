namespace CombinedStudies.Posts.Entities;

public class PostLike
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = "";
    public DateTime LikedAt { get; set; } = DateTime.UtcNow;
}
