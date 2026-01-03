using ChatApp.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Infrastructure.Data.Configurations;

public class MessageConfiguration : IEntityTypeConfiguration<Message>
{
    public void Configure(EntityTypeBuilder<Message> builder)
    {
        builder.ToTable("Messages");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(m => m.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(MessageType.Text);

        builder.Property(m => m.IsEdited)
            .HasDefaultValue(false);

        builder.Property(m => m.IsDeleted)
            .HasDefaultValue(false);

        builder.Property(m => m.IsPinned)
            .HasDefaultValue(false);

        builder.HasOne(m => m.Chat)
            .WithMany(c => c.Messages)
            .HasForeignKey(m => m.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(m => m.Sender)
            .WithMany(u => u.Messages)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(m => m.File)
            .WithMany(f => f.Messages)
            .HasForeignKey(m => m.FileId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(m => m.ReplyTo)
            .WithMany(m => m.Replies)
            .HasForeignKey(m => m.ReplyToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(m => m.ForwardedFrom)
            .WithMany()
            .HasForeignKey(m => m.ForwardedFromId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(m => m.DeletedBy)
            .WithMany()
            .HasForeignKey(m => m.DeletedById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(m => m.PinnedBy)
            .WithMany()
            .HasForeignKey(m => m.PinnedById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(m => m.ChatId);
        builder.HasIndex(m => m.SenderId);
        builder.HasIndex(m => m.CreatedAt);
        builder.HasIndex(m => new { m.ChatId, m.CreatedAt });
        builder.HasIndex(m => new { m.ChatId, m.IsPinned })
            .HasFilter("\"IsPinned\" = true");
    }
}
