namespace CombinedStudies.Chat.Entities;

public class Conversation
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string User1Id { get; private set; } = "";
    public string User2Id { get; private set; } = "";
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? LastMessageAt { get; private set; }
    public string? LastMessage { get; private set; }
    public List<ChatMessage> Messages { get; private set; } = [];

    private Conversation() { }

    // Canonical order: User1Id < User2Id (string comparison) to prevent duplicates
    public static Conversation Create(string a, string b)
    {
        var (u1, u2) = string.Compare(a, b, StringComparison.Ordinal) < 0 ? (a, b) : (b, a);
        return new Conversation { User1Id = u1, User2Id = u2, CreatedAt = DateTime.UtcNow };
    }

    public void UpdateLastMessage(string text)
    {
        LastMessage = text.Length > 100 ? text[..100] + "…" : text;
        LastMessageAt = DateTime.UtcNow;
    }
}
