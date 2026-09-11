namespace CombinedStudies.Posts.Entities;

public class PostPollVote
{
    public Guid PostId { get; set; }
    public string UserId { get; set; } = "";
    public int OptionIndex { get; set; }
    public DateTime VotedAt { get; set; } = DateTime.UtcNow;
}
