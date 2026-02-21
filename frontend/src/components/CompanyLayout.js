import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const CompanyLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role="COMPANY_ADMIN" />
      <div className="flex-1 ml-64">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default CompanyLayout;
