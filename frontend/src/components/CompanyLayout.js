import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';

const CompanyLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - responsive */}
      <div className={`
        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="relative h-full">
          {/* Close button for mobile */}
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-white z-50 bg-slate-800 rounded-lg"
            aria-label="Fermer menu"
          >
            <X size={24} />
          </button>
          <Sidebar role="COMPANY_ADMIN" onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 min-h-screen w-full">
        {/* Mobile Header */}
        <div className="lg:hidden sticky top-0 z-30 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Ouvrir menu"
          >
            <Menu size={24} />
          </button>
          <div className="flex-1">
            <span className="text-white font-semibold">Company Admin</span>
            <p className="text-xs text-slate-400">Gestion de l'entreprise</p>
          </div>
        </div>
        
        <main className="min-h-screen p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default CompanyLayout;
