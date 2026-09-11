namespace CombinedStudies.Posts.Entities;

public class PostActivity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PostId { get; set; }
    public string PostAuthorId { get; set; } = "";
    public string ActorId { get; set; } = "";
    public string Type { get; set; } = ""; // "agree" | "disagree" | "comment"
    public string? ExtraText { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
