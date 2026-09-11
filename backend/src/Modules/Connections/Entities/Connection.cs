namespace CombinedStudies.Connections.Entities;

public enum ConnectionStatus { Pending = 0, Accepted = 1, Rejected = 2, Cancelled = 3 }

public class Connection
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string SenderId { get; private set; } = "";
    public string ReceiverId { get; private set; } = "";
    public ConnectionStatus Status { get; private set; } = ConnectionStatus.Pending;
    public string? Note { get; private set; }
    public DateTime SentAt { get; private set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; private set; }

    private Connection() { }

    public static Connection Create(string senderId, string receiverId, string? note = null) => new()
    {
        SenderId = senderId,
        ReceiverId = receiverId,
        Note = note,
        SentAt = DateTime.UtcNow,
        Status = ConnectionStatus.Pending
    };

    public void Accept()  { Status = ConnectionStatus.Accepted;  RespondedAt = DateTime.UtcNow; }
    public void Reject()  { Status = ConnectionStatus.Rejected;  RespondedAt = DateTime.UtcNow; }
    public void Cancel()  { Status = ConnectionStatus.Cancelled; RespondedAt = DateTime.UtcNow; }
}
