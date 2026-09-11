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

    public static ChatMessage Create(Guid convId, string senderId, string text) => new()
    {
        ConversationId = convId,
        SenderId = senderId,
        Text = text,
        SentAt = DateTime.UtcNow
    };

    public void MarkRead() => ReadAt = DateTime.UtcNow;
}
