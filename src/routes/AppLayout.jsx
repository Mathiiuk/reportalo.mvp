import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/navigation/BottomNav';

export const AppLayout = () => {
  return (
    <div className="w-full min-h-[100dvh] flex flex-col">
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
};
