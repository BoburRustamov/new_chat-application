using ChatApp.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Chat> Chats => Set<Chat>();
    public DbSet<ChatMember> ChatMembers => Set<ChatMember>();
    public DbSet<ChatSettings> ChatSettings => Set<ChatSettings>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<ScheduledMessage> ScheduledMessages => Set<ScheduledMessage>();
    public DbSet<MessageRead> MessageReads => Set<MessageRead>();
    public DbSet<FileEntity> Files => Set<FileEntity>();
    public DbSet<Reaction> Reactions => Set<Reaction>();
    public DbSet<Call> Calls => Set<Call>();
    public DbSet<CallParticipant> CallParticipants => Set<CallParticipant>();
    public DbSet<Channel> Channels => Set<Channel>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<DeletedMessage> DeletedMessages => Set<DeletedMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entry in entries)
        {
            var now = DateTime.UtcNow;

            if (entry.State == EntityState.Added)
            {
                if (entry.Entity is User user)
                {
                    user.CreatedAt = now;
                    user.UpdatedAt = now;
                }
                else if (entry.Entity is Chat chat)
                {
                    chat.CreatedAt = now;
                    chat.UpdatedAt = now;
                }
                else if (entry.Entity is Message message)
                {
                    message.CreatedAt = now;
                    message.UpdatedAt = now;
                }
                else if (entry.Entity is ChatMember member)
                {
                    member.JoinedAt = now;
                }
                else if (entry.Entity is FileEntity file)
                {
                    file.CreatedAt = now;
                }
                else if (entry.Entity is Reaction reaction)
                {
                    reaction.CreatedAt = now;
                }
                else if (entry.Entity is Call call)
                {
                    call.StartedAt = now;
                }
                else if (entry.Entity is CallParticipant participant)
                {
                    participant.JoinedAt = now;
                }
                else if (entry.Entity is MessageRead read)
                {
                    read.ReadAt = now;
                }
                else if (entry.Entity is ScheduledMessage scheduled)
                {
                    scheduled.CreatedAt = now;
                    scheduled.UpdatedAt = now;
                }
                else if (entry.Entity is ChatSettings settings)
                {
                    settings.CreatedAt = now;
                    settings.UpdatedAt = now;
                }
            }
            else if (entry.State == EntityState.Modified)
            {
                if (entry.Entity is User user)
                {
                    user.UpdatedAt = now;
                }
                else if (entry.Entity is Chat chat)
                {
                    chat.UpdatedAt = now;
                }
                else if (entry.Entity is Message message)
                {
                    message.UpdatedAt = now;
                }
                else if (entry.Entity is ScheduledMessage scheduled)
                {
                    scheduled.UpdatedAt = now;
                }
                else if (entry.Entity is ChatSettings settings)
                {
                    settings.UpdatedAt = now;
                }
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
