import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, ChevronDown, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useBatches } from '../../context/BatchContext';
import { useNotifications } from '../../context/NotificationContext';
import { badgeCount } from '../../lib/notifications/format';
import { InventoryIcon } from '../ui/InventoryIcon';
import { BatchIcon } from '../ui/BatchIcon';
import { SettingsIcon } from '../ui/SettingsIcon';
import { HistoryIcon } from '../ui/HistoryIcon';
import { FarmIcon } from '../ui/FarmIcon';
import { BellIcon } from '../ui/BellIcon';

/*
 * Dark sidebar matching the card-header reference.
 * Top block features the farm avatar/icon, bold farm name, muted location,
 * dropdown chevron affordance, and live totals for pens and birds.
 * Below is the navigation list with high-contrast active state and badge counters.
 */
export function Sidebar({ isOpen, onClose }) {
  const { farm, farmLoading } = useAuth();
  const { batches, loading: batchesLoading, ready } = useBatches();
  const { unreadCount } = useNotifications();

  const [farmMenuOpen, setFarmMenuOpen] = useState(false);
  const farmMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (farmMenuRef.current && !farmMenuRef.current.contains(event.target)) {
        setFarmMenuOpen(false);
      }
    }
    if (farmMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [farmMenuOpen]);

  const loading = farmLoading || (batchesLoading && !ready);
  const farmName = farm?.name || 'My Farm';
  const farmLocation = farm?.location || 'Location not set';
  const farmAvatar = farm?.logoUrl || farm?.avatarUrl;

  const totalPens = farm?.pens?.length || (new Set(batches.map((b) => b.penId || b.housing).filter(Boolean)).size) || 0;
  const activeBatches = batches.filter((b) => (b.status || 'active') !== 'closed');
  const totalBirds = activeBatches.reduce((sum, b) => sum + (Number(b.currentBirds ?? b.birdCount) || 0), 0);

  const navItems = [
    { to: '/dashboard', label: 'Home', icon: FarmIcon },
    { to: '/batches', label: 'Batches', icon: BatchIcon },
    { to: '/inventory', label: 'Inventory', icon: InventoryIcon },
    { to: '/history', label: 'History', icon: HistoryIcon },
    { to: '/notifications', label: 'Notifications', icon: BellIcon, count: unreadCount },
    { to: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-200 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 left-0 h-screen w-62 bg-[#17191A] text-[#F5F7F5] flex flex-col z-40 transition-transform duration-200 ease-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Farm Header Block matching reference */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.08] shrink-0">
          <div className="relative" ref={farmMenuRef}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFarmMenuOpen((prev) => !prev)}
                className="flex-1 flex items-center gap-3 p-2 -m-1 rounded-xl hover:bg-white/[0.07] active:bg-white/[0.1] transition-colors text-left group cursor-pointer focus:outline-none min-w-0"
                aria-expanded={farmMenuOpen}
                aria-haspopup="true"
              >
                {/* Circular Avatar */}
                {farmAvatar ? (
                  <img
                    src={farmAvatar}
                    alt={farmName}
                    className="w-10 h-10 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#26282B] border border-white/10 flex items-center justify-center shrink-0 shadow-xs group-hover:border-white/20 transition-colors">
                    <FarmIcon size={20} className="brightness-0 invert opacity-90" />
                  </div>
                )}

                {/* Farm Name & Location */}
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="space-y-1.5 py-0.5">
                      <div className="h-4 w-28 bg-white/20 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-white tracking-tight truncate leading-tight group-hover:text-[#DFFF83] transition-colors">
                        {farmName}
                      </div>
                      <div className="text-xs text-stone-400 truncate leading-normal mt-0.5 font-normal">
                        {farmLocation}
                      </div>
                    </>
                  )}
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={16}
                  className={`text-stone-400 group-hover:text-white shrink-0 transition-transform duration-200 ${
                    farmMenuOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Mobile Drawer Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Close sidebar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Farm Settings / Details Dropdown */}
            {farmMenuOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-2 bg-[#202326] border border-white/10 rounded-xl shadow-2xl p-2 z-50 animate-slide-up text-xs"
                role="menu"
              >
               
                {/* Total Pens and Total Birds stats inside dropdown */}
                <div className="grid grid-cols-2 gap-2 px-1 mb-2">
                  <div className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-2 flex flex-col min-w-0">
                    <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider truncate">
                      Total Pens
                    </span>
                    <span className="text-xs font-bold text-white tabular-nums truncate mt-0.5">
                      {loading ? (
                        <span className="inline-block h-3 w-8 bg-white/15 rounded animate-pulse" />
                      ) : (
                        `${totalPens.toLocaleString()} ${totalPens === 1 ? 'Pen' : 'Pens'}`
                      )}
                    </span>
                  </div>

                  <div className="bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-2 flex flex-col min-w-0">
                    <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider truncate">
                      Total Birds
                    </span>
                    <span className="text-xs font-bold text-white tabular-nums truncate mt-0.5">
                      {loading ? (
                        <span className="inline-block h-3 w-10 bg-white/15 rounded animate-pulse" />
                      ) : (
                        `${totalBirds.toLocaleString()} ${totalBirds === 1 ? 'Bird' : 'Birds'}`
                      )}
                    </span>
                  </div>
                </div>

                <NavLink
                  to="/settings"
                  onClick={() => {
                    setFarmMenuOpen(false);
                    onClose?.();
                  }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition-colors font-medium"
                >
                  <Settings size={15} />
                  <span>Farm Settings</span>
                </NavLink>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 pt-2 space-y-1.5 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? 'bg-[#DFFF83] text-[#17191A] font-semibold'
                      : 'text-[#F5F7F5]/90 hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} className={isActive ? '' : 'invert opacity-90'} />
                    <span className="flex-1">{item.label}</span>
                    {item.count > 0 && (
                      <>
                        <span
                          aria-hidden="true"
                          className="min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold leading-5 text-center tabular-nums bg-red-500 text-white"
                        >
                          {badgeCount(item.count)}
                        </span>
                        <span className="sr-only">, {item.count} unread</span>
                      </>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: the farm slogan illustration ("Healthy Birds • Better
            Yields"). It's a transparent PNG with dark line art, so it's
            turned white (brightness-0 invert) to read on the charcoal, the
            same way the nav icons are. */}
        <div className="pb-5 pt-3 shrink-0 flex justify-center">
          <img
            src="/images/svg.webp"
            alt="Healthy Birds, Better Yields"
            className="w-26 h-26 object-contain brightness-0 invert opacity-90"
          />
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
