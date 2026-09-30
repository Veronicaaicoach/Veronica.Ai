import React, { useState } from 'react';
import { Menu, Info, Users, Mail, HelpCircle, Settings , User} from 'lucide-react';

const SidebarItem = ({ icon, label, active = false, onClick, isExpanded }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, isExpanded: boolean }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center ${isExpanded ? 'gap-3 px-3' : 'justify-center px-0'} py-2.5 rounded-lg text-sm tracking-wider transition-colors ${active ? 'bg-pink-500/10 text-pink-500 font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}
    title={!isExpanded ? label : undefined}
  >
    <div className={`shrink-0 ${active ? 'text-pink-500' : 'text-white/40'}`}>{icon}</div>
    {isExpanded && <span className="truncate">{label}</span>}
  </button>
);

export function Sidebar({ onHowItWorksClick, onAboutClick, onContactClick, onHelpClick, onSettingsClick }: { onHowItWorksClick?: () => void, onAboutClick?: () => void, onContactClick?: () => void, onHelpClick?: () => void, onSettingsClick?: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside className={`${isExpanded ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out border-r border-white/10 bg-black/50 hidden md:flex flex-col h-full overflow-y-auto pb-4 shrink-0 overflow-x-hidden`}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-6 text-xs font-semibold tracking-[0.2em] uppercase opacity-60 hover:opacity-100 flex items-center ${isExpanded ? 'gap-2 justify-start' : 'justify-center'} mb-2 transition-all w-full`}
      >
        <Menu className="w-5 h-5 shrink-0" /> {isExpanded && <span>MENU</span>}
      </button>
      <nav className={`flex-1 ${isExpanded ? 'px-4' : 'px-3'} space-y-1.5 transition-all duration-300`}>
        <SidebarItem isExpanded={isExpanded} icon={<Info className="w-5 h-5" />} label="How It Works" onClick={onHowItWorksClick} />
        <SidebarItem isExpanded={isExpanded} icon={<Users className="w-5 h-5" />} label="About" onClick={onAboutClick} />
        <SidebarItem isExpanded={isExpanded} icon={<Mail className="w-5 h-5" />} label="Contact" onClick={onContactClick} />
        <SidebarItem isExpanded={isExpanded} icon={<HelpCircle className="w-5 h-5" />} label="Help" onClick={onHelpClick} />
        
        <div className="h-px bg-white/10 my-4 w-full" />
        
        <SidebarItem isExpanded={isExpanded} icon={<User className="w-5 h-5" />} label="Account" onClick={onSettingsClick} />
      </nav>
    </aside>
  );
}
