import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Megaphone, AlertCircle, CheckCircle } from 'lucide-react';
import { useChannelStore } from '@/entities/channel';

export function JoinChannelPage() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { joinByInviteCode } = useChannelStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [channelName, setChannelName] = useState('');

  useEffect(() => {
    if (!inviteCode) {
      setStatus('error');
      setErrorMessage('Invalid invite link');
      return;
    }

    const join = async () => {
      try {
        const channel = await joinByInviteCode(inviteCode);
        setChannelName(channel.name);
        setStatus('success');

        // Navigate to channel after short delay
        setTimeout(() => {
          navigate(`/chat/${channel.chatId}`);
        }, 1500);
      } catch (error: unknown) {
        setStatus('error');
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: { message?: string } } };
          setErrorMessage(
            axiosError.response?.data?.message || 'Failed to join channel'
          );
        } else {
          setErrorMessage('Failed to join channel');
        }
      }
    };

    join();
  }, [inviteCode, joinByInviteCode, navigate]);

  return (
    <div className="flex h-full items-center justify-center bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center shadow-lg">
        {status === 'loading' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[hsl(var(--primary))]">
                <Megaphone className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Joining Channel</h2>
            <p className="mb-6 text-[hsl(var(--muted-foreground))]">
              Please wait while we process your invite...
            </p>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Welcome!</h2>
            <p className="mb-4 text-[hsl(var(--muted-foreground))]">
              You've successfully joined{' '}
              <span className="font-medium text-[hsl(var(--foreground))]">
                {channelName}
              </span>
            </p>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Redirecting you to the channel...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500">
                <AlertCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-semibold">Couldn't Join</h2>
            <p className="mb-6 text-[hsl(var(--muted-foreground))]">{errorMessage}</p>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/channels/discover')}
                className="w-full rounded-lg bg-[hsl(var(--primary))] py-2.5 font-medium text-white hover:bg-[hsl(var(--primary))]/90"
              >
                Browse Channels
              </button>
              <button
                onClick={() => navigate('/chat')}
                className="w-full rounded-lg border border-[hsl(var(--border))] py-2.5 font-medium hover:bg-[hsl(var(--secondary))]"
              >
                Go to Chats
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
