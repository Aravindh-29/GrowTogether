using CombinedStudies.Connections.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Connections.Data;

public class ConnectionsDbContext(DbContextOptions<ConnectionsDbContext> opts) : DbContext(opts)
{
    public DbSet<Connection> Connections => Set<Connection>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.HasDefaultSchema("connections");
        var e = m.Entity<Connection>();
        e.Property(c => c.SenderId).HasMaxLength(64);
        e.Property(c => c.ReceiverId).HasMaxLength(64);
        e.Property(c => c.Note).HasMaxLength(300);
        e.Property(c => c.Status).HasConversion<int>();
    }
}
