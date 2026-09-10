import React from 'react';
import { Menu, Home, BarChart2, MessageSquare, FileText, Bookmark, Info, Users, Mail, HelpCircle, Settings } from 'lucide-react';

const SidebarItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm tracking-wider transition-colors ${active ? 'bg-pink-500/10 text-pink-500 font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}>
    <div className={active ? 'text-pink-500' : 'text-white/40'}>{icon}</div>
    {label}
  </button>
);

export function Sidebar({ onHowItWorksClick }: { onHowItWorksClick?: () => void }) {
  return (
    <aside className="w-64 border-r border-white/10 bg-black/50 hidden md:flex flex-col h-full overflow-y-auto pb-4 shrink-0">
      <div className="p-6 text-xs font-semibold tracking-[0.2em] uppercase opacity-50 flex items-center gap-2 mb-2">
        <Menu className="w-4 h-4" /> MENU
      </div>
      <nav className="flex-1 px-4 space-y-1">
        <SidebarItem icon={<Home className="w-4 h-4" />} label="Dashboard" active />
        <SidebarItem icon={<BarChart2 className="w-4 h-4" />} label="My Progress" />
        <SidebarItem icon={<MessageSquare className="w-4 h-4" />} label="Conversations" />
        <SidebarItem icon={<FileText className="w-4 h-4" />} label="Feedback" />
        <SidebarItem icon={<Bookmark className="w-4 h-4" />} label="Memories" />
        <div className="h-px bg-white/10 my-4" />
        <SidebarItem icon={<Info className="w-4 h-4" />} label="How It Works" onClick={onHowItWorksClick} />
        <SidebarItem icon={<Users className="w-4 h-4" />} label="About" />
        <SidebarItem icon={<Mail className="w-4 h-4" />} label="Contact" />
        <SidebarItem icon={<HelpCircle className="w-4 h-4" />} label="Help" />
        <div className="h-px bg-white/10 my-4" />
        <SidebarItem icon={<Settings className="w-4 h-4" />} label="Settings" />
      </nav>
    </aside>
  );
}
