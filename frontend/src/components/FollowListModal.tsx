import React, { useEffect, useState } from 'react';
import { X, Users, UserCheck, UserPlus, Star, ShieldCheck, MapPin, Loader2 } from 'lucide-react';
import { FollowUser } from '../lib/types';
import { api } from '../lib/api';
import { useAuth } from '../lib/authContext';

interface FollowListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  type: 'followers' | 'following';
  onOpenUserProfile?: (userId: string) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName = 'Member',
  type,
  onOpenUserProfile,
}) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    let isMounted = true;
    setIsLoading(true);
    setError('');

    const fetchUsers = async () => {
      try {
        const data = type === 'followers'
          ? await api.getFollowers(userId)
          : await api.getFollowing(userId);
        if (isMounted) {
          setUsers(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load list');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUsers();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, type]);

  if (!isOpen) return null;

  const handleToggleFollow = async (targetUser: FollowUser, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || targetUser.id === currentUser.id) return;

    setActionLoadingId(targetUser.id);
    try {
      if (targetUser.is_following) {
        await api.unfollowUser(targetUser.id);
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_following: false } : u))
        );
      } else {
        await api.followUser(targetUser.id);
        setUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, is_following: true } : u))
        );
      }
    } catch (err: any) {
      console.error('Follow action failed:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const titleText = type === 'followers' ? 'Followers' : 'Following';

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-divider rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between bg-surface/90 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-ink text-base font-display">
                {titleText}
              </h3>
              <p className="text-[11px] text-ink-secondary">
                {userName}'s {type}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-canvas text-ink-secondary hover:text-ink transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List Content */}
        <div className="p-4 overflow-y-auto divide-y divide-divider/40 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-ink-secondary">
              <Loader2 className="w-6 h-6 animate-spin text-brand" />
              <span className="text-xs font-semibold">Loading {titleText.toLowerCase()}...</span>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-xs text-red-500 font-bold">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-canvas border border-divider flex items-center justify-center mx-auto text-ink-secondary">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-ink">
                No {titleText.toLowerCase()} yet
              </p>
              <p className="text-[11px] text-ink-secondary max-w-xs mx-auto">
                {type === 'followers'
                  ? 'When neighbors follow this profile, they will appear here.'
                  : 'Not following any community members yet.'}
              </p>
            </div>
          ) : (
            users.map((item) => {
              const isSelf = currentUser?.id === item.id;
              const avatar = item.avatar_url && item.avatar_url.trim() !== ''
                ? item.avatar_url
                : `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(item.name || 'user')}`;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onClose();
                    onOpenUserProfile?.(item.id);
                  }}
                  className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-canvas/60 rounded-2xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={avatar}
                      alt={item.name}
                      className="w-10 h-10 rounded-full object-cover border border-divider shrink-0 group-hover:ring-2 ring-brand/30 transition-all"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-ink truncate group-hover:text-brand transition-colors">
                          {item.name}
                        </span>
                        {item.trust_score && item.trust_score >= 80 && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-ink-secondary">
                        <span className="font-mono text-zinc-400">@{item.username || 'member'}</span>
                        {item.locality && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px] flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5 text-brand" />
                              {item.locality}
                            </span>
                          </>
                        )}
                        {item.rating && item.rating > 0 ? (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 font-bold text-ink">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              {item.rating.toFixed(1)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {!isSelf && currentUser && (
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={(e) => handleToggleFollow(item, e)}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all cursor-pointer shrink-0 inline-flex items-center gap-1 shadow-xs ${
                        item.is_following
                          ? 'bg-canvas hover:bg-red-500/10 text-ink-secondary hover:text-red-500 border border-divider hover:border-red-500/20'
                          : 'bg-brand hover:bg-brand-hover text-white'
                      }`}
                    >
                      {actionLoadingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : item.is_following ? (
                        <>
                          <UserCheck className="w-3 h-3 text-emerald-500" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3 h-3" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

