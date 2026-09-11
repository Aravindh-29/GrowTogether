namespace CombinedStudies.Identity.Entities;

public class User
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Email { get; private set; } = "";
    public string PasswordHash { get; private set; } = "";
    public string DisplayName { get; private set; } = "";
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    private User() { }

    public static User Create(string email, string passwordHash, string displayName) => new()
    {
        Email = email,
        PasswordHash = passwordHash,
        DisplayName = displayName
    };

    public void UpdatePasswordHash(string newHash)
    {
        PasswordHash = newHash;
    }
}
