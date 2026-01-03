using ChatApp.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Infrastructure.Data.Configurations;

public class ChatMemberConfiguration : IEntityTypeConfiguration<ChatMember>
{
    public void Configure(EntityTypeBuilder<ChatMember> builder)
    {
        builder.ToTable("ChatMembers");

        builder.HasKey(cm => cm.Id);

        builder.Property(cm => cm.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(cm => cm.Role)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(MemberRole.Member);

        builder.Property(cm => cm.IsMuted)
            .HasDefaultValue(false);

        builder.Property(cm => cm.IsPinned)
            .HasDefaultValue(false);

        builder.Property(cm => cm.IsBanned)
            .HasDefaultValue(false);

        builder.HasOne(cm => cm.Chat)
            .WithMany(c => c.Members)
            .HasForeignKey(cm => cm.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cm => cm.User)
            .WithMany(u => u.ChatMemberships)
            .HasForeignKey(cm => cm.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cm => cm.BannedBy)
            .WithMany()
            .HasForeignKey(cm => cm.BannedById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(cm => cm.LastReadMessage)
            .WithMany()
            .HasForeignKey(cm => cm.LastReadMessageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(cm => cm.ChatId);
        builder.HasIndex(cm => cm.UserId);
        builder.HasIndex(cm => new { cm.ChatId, cm.UserId }).IsUnique();
        builder.HasIndex(cm => new { cm.ChatId, cm.IsBanned });
    }
}
