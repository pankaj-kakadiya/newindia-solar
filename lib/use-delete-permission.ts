"use client";
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { canAdmin } from './adminAccess';

export function useDeletePermission(module: 'products' | 'production') {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.resolve(supabase.rpc('get_my_admin_access')).then(({ data, error }) => {
      if (alive) setAllowed(!error && canAdmin(data, module, 'delete'));
    }).catch(() => { if (alive) setAllowed(false); });
    return () => { alive = false; };
  }, [module]);
  return allowed;
}
