import React from 'react';
import PrinterSelector from '@/components/PrinterSelector';
import VendeurConfigImprimante from '@/pages/vendeur/VendeurConfigImprimante';

/**
 * CompanyPrinterConfigPage - Printer configuration for Company Admin
 * Reuses the VendeurConfigImprimante component with admin context
 */
const CompanyPrinterConfigPage = () => {
  return <VendeurConfigImprimante />;
};

export default CompanyPrinterConfigPage;
