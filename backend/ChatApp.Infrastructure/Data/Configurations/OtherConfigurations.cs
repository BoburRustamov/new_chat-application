using ChatApp.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Infrastructure.Data.Configurations;

public class ChatSettingsConfiguration : IEntityTypeConfiguration<ChatSettings>
{
    public void Configure(EntityTypeBuilder<ChatSettings> builder)
    {
        builder.ToTable("ChatSettings");

        builder.HasKey(cs => cs.Id);

        builder.Property(cs => cs.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(cs => cs.SlowModeInterval)
            .HasDefaultValue(0);

        builder.Property(cs => cs.MembersCanAddMembers)
            .HasDefaultValue(true);

        builder.Property(cs => cs.MembersCanSendMedia)
            .HasDefaultValue(true);

        builder.Property(cs => cs.MembersCanSendStickers)
            .HasDefaultValue(true);

        builder.Property(cs => cs.MembersCanPinMessages)
            .HasDefaultValue(false);

        builder.Property(cs => cs.MembersCanChangeInfo)
            .HasDefaultValue(false);

        builder.Property(cs => cs.JoinRequiresApproval)
            .HasDefaultValue(false);

        builder.HasOne(cs => cs.Chat)
            .WithOne(c => c.Settings)
            .HasForeignKey<ChatSettings>(cs => cs.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(cs => cs.ChatId).IsUnique();
    }
}

public class ScheduledMessageConfiguration : IEntityTypeConfiguration<ScheduledMessage>
{
    public void Configure(EntityTypeBuilder<ScheduledMessage> builder)
    {
        builder.ToTable("ScheduledMessages");

        builder.HasKey(sm => sm.Id);

        builder.Property(sm => sm.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(sm => sm.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(MessageType.Text);

        builder.Property(sm => sm.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(ScheduledMessageStatus.Pending);

        builder.HasOne(sm => sm.Chat)
            .WithMany(c => c.ScheduledMessages)
            .HasForeignKey(sm => sm.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sm => sm.Sender)
            .WithMany()
            .HasForeignKey(sm => sm.SenderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(sm => sm.File)
            .WithMany()
            .HasForeignKey(sm => sm.FileId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(sm => sm.ReplyTo)
            .WithMany()
            .HasForeignKey(sm => sm.ReplyToId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(sm => sm.SentMessage)
            .WithMany()
            .HasForeignKey(sm => sm.SentMessageId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(sm => new { sm.ScheduledAt, sm.Status });
        builder.HasIndex(sm => sm.SenderId);
    }
}

public class MessageReadConfiguration : IEntityTypeConfiguration<MessageRead>
{
    public void Configure(EntityTypeBuilder<MessageRead> builder)
    {
        builder.ToTable("MessageReads");

        builder.HasKey(mr => mr.Id);

        builder.Property(mr => mr.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.HasOne(mr => mr.Message)
            .WithMany(m => m.Reads)
            .HasForeignKey(mr => mr.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(mr => mr.User)
            .WithMany(u => u.MessageReads)
            .HasForeignKey(mr => mr.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(mr => mr.MessageId);
        builder.HasIndex(mr => mr.UserId);
        builder.HasIndex(mr => new { mr.MessageId, mr.UserId }).IsUnique();
    }
}

public class FileEntityConfiguration : IEntityTypeConfiguration<FileEntity>
{
    public void Configure(EntityTypeBuilder<FileEntity> builder)
    {
        builder.ToTable("Files");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(f => f.FileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(f => f.OriginalFileName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(f => f.ContentType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(f => f.Path)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(f => f.ThumbnailPath)
            .HasMaxLength(500);

        builder.HasOne(f => f.Uploader)
            .WithMany(u => u.UploadedFiles)
            .HasForeignKey(f => f.UploaderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(f => f.UploaderId);
    }
}

public class ReactionConfiguration : IEntityTypeConfiguration<Reaction>
{
    public void Configure(EntityTypeBuilder<Reaction> builder)
    {
        builder.ToTable("Reactions");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(r => r.Emoji)
            .IsRequired()
            .HasMaxLength(50);

        builder.HasOne(r => r.Message)
            .WithMany(m => m.Reactions)
            .HasForeignKey(r => r.MessageId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.User)
            .WithMany(u => u.Reactions)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => r.MessageId);
        builder.HasIndex(r => new { r.MessageId, r.UserId, r.Emoji }).IsUnique();
    }
}

public class CallConfiguration : IEntityTypeConfiguration<Call>
{
    public void Configure(EntityTypeBuilder<Call> builder)
    {
        builder.ToTable("Calls");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(c => c.Type)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(c => c.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(CallStatus.Active);

        builder.HasOne(c => c.Chat)
            .WithMany(ch => ch.Calls)
            .HasForeignKey(c => c.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Initiator)
            .WithMany(u => u.InitiatedCalls)
            .HasForeignKey(c => c.InitiatorId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(c => c.ChatId);
        builder.HasIndex(c => c.Status);
    }
}

public class CallParticipantConfiguration : IEntityTypeConfiguration<CallParticipant>
{
    public void Configure(EntityTypeBuilder<CallParticipant> builder)
    {
        builder.ToTable("CallParticipants");

        builder.HasKey(cp => cp.Id);

        builder.Property(cp => cp.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.HasOne(cp => cp.Call)
            .WithMany(c => c.Participants)
            .HasForeignKey(cp => cp.CallId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(cp => cp.User)
            .WithMany(u => u.CallParticipations)
            .HasForeignKey(cp => cp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(cp => cp.CallId);
        builder.HasIndex(cp => new { cp.CallId, cp.UserId }).IsUnique();
    }
}

public class ChannelConfiguration : IEntityTypeConfiguration<Channel>
{
    public void Configure(EntityTypeBuilder<Channel> builder)
    {
        builder.ToTable("Channels");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(c => c.Username)
            .HasMaxLength(50);

        builder.Property(c => c.IsPublic)
            .HasDefaultValue(true);

        builder.Property(c => c.SubscriberCount)
            .HasDefaultValue(0);

        builder.HasOne(c => c.Chat)
            .WithOne(ch => ch.Channel)
            .HasForeignKey<Channel>(c => c.ChatId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(c => c.ChatId).IsUnique();
        builder.HasIndex(c => c.Username).IsUnique();
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("RefreshTokens");

        builder.HasKey(rt => rt.Id);

        builder.Property(rt => rt.Id)
            .HasDefaultValueSql("gen_random_uuid()");

        builder.Property(rt => rt.Token)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(rt => rt.IsRevoked)
            .HasDefaultValue(false);

        builder.HasOne(rt => rt.User)
            .WithMany()
            .HasForeignKey(rt => rt.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(rt => rt.Token).IsUnique();
        builder.HasIndex(rt => rt.UserId);
    }
}
