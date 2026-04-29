'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ItemHistoryModal from '@/components/ItemHistoryModal';

function HistoryPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const itemName = searchParams.get('item');
  const priceParam = searchParams.get('price');
  const price = priceParam ? parseFloat(priceParam) : undefined;

  if (!itemName) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#dc2626' }}>Parameter Tidak Valid</h2>
        <p>Nama barang tidak ditemukan dalam URL.</p>
      </div>
    );
  }

  // Handle closing by closing the tab
  const handleClose = () => {
    // Attempt to close tab, fallback to going back
    if (typeof window !== 'undefined') {
      window.close();
      // If it doesn't close (because not opened by script), we can try back
      setTimeout(() => {
        router.back();
      }, 300);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#f8fafc',
      padding: '20px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center'
    }}>
      {/* We use the same component but wrap it in a container that simulates the modal behavior without the fixed overlay breaking the flow */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 800, marginTop: '2vh' }}>
        <style dangerouslySetInnerHTML={{__html: `
          .modal-overlay {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            display: block !important;
            align-items: flex-start !important;
          }
          .modal-content {
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
            margin: 0 auto !important;
            background: white !important;
            border-radius: 16px !important;
          }
        `}} />
        <ItemHistoryModal 
          namaBarang={itemName} 
          currentPrice={price} 
          onClose={handleClose} 
        />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        Loading...
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  );
}
