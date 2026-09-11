using CombinedStudies.Chat.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Chat.Data;

public class ChatDbContext(DbContextOptions<ChatDbContext> opts) : DbContext(opts)
{
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ChatMessage> Messages => Set<ChatMessage>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.HasDefaultSchema("chat");

        var conv = m.Entity<Conversation>();
        conv.Property(c => c.User1Id).HasMaxLength(64);
        conv.Property(c => c.User2Id).HasMaxLength(64);
        conv.Property(c => c.LastMessage).HasMaxLength(101);
        conv.HasIndex(c => new { c.User1Id, c.User2Id }).IsUnique();
        conv.HasMany(c => c.Messages).WithOne().HasForeignKey(msg => msg.ConversationId).OnDelete(DeleteBehavior.Cascade);

        var msg = m.Entity<ChatMessage>();
        msg.Property(x => x.SenderId).HasMaxLength(64);
        msg.Property(x => x.Text).HasMaxLength(4000);
    }
}
