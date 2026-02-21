import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '@/api/auth';

export const Header = ({ title, subtitle }) => {
  const { user } = useAuth();
  
  return (
    <div className="bg-slate-900/50 border-b border-slate-800 px-6 py-4 sticky top-0 z-10 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold uppercase tracking-tight text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
            data-testid="header-notifications-button"
          >
            <Bell className="w-5 h-5 text-slate-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-400 rounded-full"></span>
          </button>
        </div>
      </div>
    </div>
  );
};