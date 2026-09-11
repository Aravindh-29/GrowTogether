namespace CombinedStudies.Posts.Entities;

public class PostSave
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = "";
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
