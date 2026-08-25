import React, { useState, useEffect } from 'react';
import { Bell, Check, Sparkles, ShoppingBag, ArrowRightLeft, Tag, XCircle, RefreshCw } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { getNotifications, markNotificationsRead } from '../Services/nftServices';

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: 'NFT Minted' | 'NFT Sold' | 'NFT Purchased' | 'NFT Transferred' | 'NFT Listed' | 'NFT Delisted' | 'System';
  tokenId?: string;
  walletAddress?: string;
  price?: string;
  txHash?: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationCenter: React.FC = () => {
  const { isConnected, shortAddress, address } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await getNotifications(address || '', activeFilter);
      if (res.success && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 15000); // Polling every 15s for real-time notifications
    return () => clearInterval(interval);
  }, [address, activeFilter]);

  const handleMarkRead = async () => {
    await markNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'NFT Minted':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'NFT Sold':
      case 'NFT Purchased':
        return <ShoppingBag className="w-4 h-4 text-cyan-400" />;
      case 'NFT Listed':
        return <Tag className="w-4 h-4 text-amber-400" />;
      case 'NFT Delisted':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'NFT Transferred':
        return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'NFT Minted':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'NFT Purchased':
      case 'NFT Sold':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'NFT Listed':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'NFT Delisted':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'NFT Transferred':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="relative z-50">
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            handleMarkRead();
          }
        }}
        className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition"
        title="Real-time NFT Ecosystem Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 glass-panel rounded-2xl shadow-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Live System Notifications</h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchNotes}
                className="p-1 rounded text-slate-400 hover:text-white transition"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkRead}
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Check className="w-3 h-3" /> Mark read
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
            {['all', 'NFT Minted', 'NFT Listed', 'NFT Purchased', 'NFT Transferred'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2 py-1 rounded-md whitespace-nowrap transition ${
                  activeFilter === f
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all' ? 'All Activity' : f}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No notifications found
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item._id || item.txHash || Math.random()}
                  className={`p-3 rounded-xl border transition space-y-1.5 ${
                    !item.isRead
                      ? 'bg-slate-900/90 border-slate-700/80 shadow-sm'
                      : 'bg-slate-900/40 border-slate-800/60 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getTypeBadgeClass(
                        item.type
                      )}`}
                    >
                      {getEventIcon(item.type)}
                      <span>{item.type}</span>
                    </span>

                    <span className="text-[10px] text-slate-500">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.message}</p>

                  {item.txHash && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between pt-1 border-t border-slate-800/40">
                      <span>Tx: {item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</span>
                      {item.price && <span className="font-bold text-emerald-400">{item.price}</span>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
