using CombinedStudies.Groups.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Groups.Data;

public class GroupsDbContext(DbContextOptions<GroupsDbContext> options) : DbContext(options)
{
    public DbSet<Group>        Groups   => Set<Group>();
    public DbSet<GroupMember>  Members  => Set<GroupMember>();
    public DbSet<GroupInvite>  Invites  => Set<GroupInvite>();
    public DbSet<GroupMessage> Messages => Set<GroupMessage>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.HasDefaultSchema("groups");

        m.Entity<Group>(e =>
        {
            e.HasKey(g => g.Id);
            e.Property(g => g.Name).HasMaxLength(60).IsRequired();
            e.Property(g => g.Subject).HasMaxLength(60).IsRequired();
            e.Property(g => g.Description).HasMaxLength(200);
            e.Property(g => g.Color).HasMaxLength(20).IsRequired();
            e.Property(g => g.OwnerId).HasMaxLength(64).IsRequired();
            e.HasMany(g => g.Members).WithOne().HasForeignKey(m => m.GroupId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<GroupMember>(e =>
        {
            e.HasKey(m => m.Id);
            e.Property(m => m.UserId).HasMaxLength(64).IsRequired();
            e.HasIndex(m => new { m.GroupId, m.UserId }).IsUnique();
        });

        m.Entity<GroupMessage>(e =>
        {
            e.HasKey(gm => gm.Id);
            e.Property(gm => gm.SenderId).HasMaxLength(64).IsRequired();
            e.Property(gm => gm.Text).HasMaxLength(4000).IsRequired();
            e.Property(gm => gm.IsSystem).HasDefaultValue(false);
            e.HasIndex(gm => new { gm.GroupId, gm.SentAt });
        });

        m.Entity<GroupInvite>(e =>
        {
            e.HasKey(i => i.Id);
            e.Property(i => i.GroupName).HasMaxLength(60).IsRequired();
            e.Property(i => i.GroupColor).HasMaxLength(20).IsRequired();
            e.Property(i => i.InvitedByUserId).HasMaxLength(64).IsRequired();
            e.Property(i => i.InvitedByName).HasMaxLength(120).IsRequired();
            e.Property(i => i.UserId).HasMaxLength(64).IsRequired();
            e.Property(i => i.Status).HasConversion<string>();
            // Prevent duplicate pending invites for same group+user
            e.HasIndex(i => new { i.GroupId, i.UserId, i.Status });
        });
    }
}
