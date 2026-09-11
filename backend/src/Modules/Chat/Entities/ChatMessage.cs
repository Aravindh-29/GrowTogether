namespace CombinedStudies.Chat.Entities;

public class ChatMessage
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid ConversationId { get; private set; }
    public string SenderId { get; private set; } = "";
    public string Text { get; private set; } = "";
    public DateTime SentAt { get; private set; } = DateTime.UtcNow;
    public DateTime? ReadAt { get; private set; }

    private ChatMessage() { }

    public Guid? PostId { get; private set; }

    public static ChatMessage Create(Guid convId, string senderId, string text, Guid? postId = null) => new()
    {
        ConversationId = convId,
        SenderId = senderId,
        Text = text,
        PostId = postId,
        SentAt = DateTime.UtcNow
    };

    public void MarkRead() => ReadAt = DateTime.UtcNow;
}
