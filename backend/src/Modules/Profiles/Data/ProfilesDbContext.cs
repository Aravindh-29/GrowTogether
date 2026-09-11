using CombinedStudies.Profiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace CombinedStudies.Profiles.Data;

public class ProfilesDbContext(DbContextOptions<ProfilesDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<ProfileEducation> Educations => Set<ProfileEducation>();
    public DbSet<ProfileExperience> Experiences => Set<ProfileExperience>();
    public DbSet<ProfileProject> Projects => Set<ProfileProject>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.HasDefaultSchema("profiles");

        m.Entity<Profile>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.UserId).HasMaxLength(64).IsRequired();
            e.HasIndex(p => p.UserId).IsUnique();
            e.Property(p => p.Email).HasMaxLength(256).IsRequired();
            e.Property(p => p.FirstName).HasMaxLength(100).IsRequired();
            e.Property(p => p.MiddleName).HasMaxLength(100);
            e.Property(p => p.LastName).HasMaxLength(100).IsRequired();
            e.Property(p => p.Gender).HasMaxLength(30);
            e.Property(p => p.Phone).HasMaxLength(30);
            e.Property(p => p.ProfilePictureUrl);     // text — allows base64 data URLs
            e.Property(p => p.City).HasMaxLength(100);
            e.Property(p => p.Country).HasMaxLength(100);
            e.Property(p => p.Role).HasMaxLength(20);
            e.Property(p => p.Username).HasMaxLength(30);
            e.HasIndex(p => p.Username).IsUnique().HasFilter("\"Username\" IS NOT NULL");
            e.Property(p => p.Headline).HasMaxLength(220);
            e.Property(p => p.About).HasMaxLength(2600);
            e.Property(p => p.Website).HasMaxLength(500);
            e.Property(p => p.LinkedInUrl).HasMaxLength(500);
            e.Property(p => p.GitHubUrl).HasMaxLength(500);
            e.Property(p => p.TwitterUrl).HasMaxLength(500);
            e.Property(p => p.SubjectsKnown).HasColumnType("text[]");
            e.Property(p => p.SubjectsWanted).HasColumnType("text[]");
            e.Property(p => p.SubjectsCanTeach).HasColumnType("text[]");
            e.HasMany(p => p.Educations).WithOne().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(p => p.Experiences).WithOne().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(p => p.Projects).WithOne().HasForeignKey(x => x.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        m.Entity<ProfileEducation>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.School).HasMaxLength(200).IsRequired();
            e.Property(x => x.Degree).HasMaxLength(100);
            e.Property(x => x.FieldOfStudy).HasMaxLength(100);
            e.Property(x => x.Description).HasMaxLength(1000);
        });

        m.Entity<ProfileExperience>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Company).HasMaxLength(200).IsRequired();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.EmploymentType).HasMaxLength(50);
            e.Property(x => x.Location).HasMaxLength(200);
            e.Property(x => x.Description).HasMaxLength(2000);
        });

        m.Entity<ProfileProject>(e =>
        {
            e.HasKey(x => x.Id);
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.Url).HasMaxLength(500);
            e.Property(x => x.Technologies).HasColumnType("text[]");
        });
    }
}
