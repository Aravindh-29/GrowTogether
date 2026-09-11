namespace CombinedStudies.Posts.Entities;

public class PostReaction
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = "";
    public string Type { get; set; } = ""; // "agree" or "disagree"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
