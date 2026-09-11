namespace CombinedStudies.Posts.Entities;

public class Post
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string AuthorId { get; private set; } = "";
    public string Content { get; private set; } = "";
    public List<string> ImageUrls { get; private set; } = [];
    public string? DocumentUrl { get; private set; }
    public string? DocumentName { get; private set; }
    public string? PollQuestion { get; private set; }
    public List<string> PollOptions { get; private set; } = [];
    public DateTime? ScheduledAt { get; private set; }
    public string Audience { get; private set; } = "anyone";
    public string CommentVisibility { get; private set; } = "anyone";
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public List<PostLike> Likes { get; private set; } = [];
    public List<PostComment> Comments { get; private set; } = [];
    public List<PostRepost> Reposts { get; private set; } = [];
    public List<PostReaction> Reactions { get; private set; } = [];
    public List<PostSave> Saves { get; private set; } = [];
    public List<PostPollVote> PollVotes { get; private set; } = [];

    private Post() { }

    public static Post Create(string authorId, string content, List<string>? imageUrls = null,
        string? documentUrl = null, string? documentName = null,
        string? pollQuestion = null, List<string>? pollOptions = null,
        DateTime? scheduledAt = null,
        string audience = "anyone", string commentVisibility = "anyone") => new()
    {
        AuthorId = authorId,
        Content = content,
        ImageUrls = imageUrls ?? [],
        DocumentUrl = documentUrl,
        DocumentName = documentName,
        PollQuestion = pollQuestion,
        PollOptions = pollOptions ?? [],
        ScheduledAt = scheduledAt,
        Audience = audience,
        CommentVisibility = commentVisibility,
    };

    public void Update(string content, List<string>? imageUrls = null,
        string? documentUrl = null, string? documentName = null,
        string? pollQuestion = null, List<string>? pollOptions = null,
        DateTime? scheduledAt = null,
        string audience = "anyone", string commentVisibility = "anyone")
    {
        Content = content;
        ImageUrls = imageUrls ?? [];
        DocumentUrl = documentUrl;
        DocumentName = documentName;
        PollQuestion = pollQuestion;
        PollOptions = pollOptions ?? [];
        ScheduledAt = scheduledAt;
        Audience = audience;
        CommentVisibility = commentVisibility;
        UpdatedAt = DateTime.UtcNow;
    }
}
