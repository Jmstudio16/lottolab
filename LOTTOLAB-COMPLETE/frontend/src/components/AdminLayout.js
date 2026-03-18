import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AdminLayout = ({ children, title, subtitle, role }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={role} />
      <div className="flex-1 ml-64">
        <Header title={title} subtitle={subtitle} />
        <main className="p-6">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};