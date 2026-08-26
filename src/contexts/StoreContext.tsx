"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";

type Store = {
  id: number;
  name: string;
};

type StoreContextType = {
  stores: Store[];
  currentStore: Store | null;
  setCurrentStore: (store: Store) => void;
  addStore: (name: string) => Promise<Store | null>;
  deleteStore: (id: number) => Promise<boolean>;
  loading: boolean;
  refreshStores: () => Promise<void>;
};

const StoreContext = createContext<StoreContextType>({
  stores: [],
  currentStore: null,
  setCurrentStore: () => {},
  addStore: async () => null,
  deleteStore: async () => false,
  loading: true,
  refreshStores: async () => {},
});

export function useStore() {
  return useContext(StoreContext);
}

const STORAGE_KEY = "selected_store_id";

export default function StoreProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStoreState] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("stores").select("*").order("id");
    const list: Store[] = data || [];
    setStores(list);
    return list;
  }, []);

  useEffect(() => {
    const init = async () => {
      const list = await fetchStores();
      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = savedId ? list.find((s) => s.id === Number(savedId)) : null;
      setCurrentStoreState(saved || list[0] || null);
      setLoading(false);
    };
    init();
  }, [fetchStores]);

  const setCurrentStore = (store: Store) => {
    setCurrentStoreState(store);
    localStorage.setItem(STORAGE_KEY, String(store.id));
  };

  const addStore = async (name: string): Promise<Store | null> => {
    const supabase = createClient();
    const { data, error } = await supabase.from("stores").insert({ name }).select().single();
    if (error || !data) return null;
    const newStore: Store = data;
    setStores((prev) => [...prev, newStore]);
    return newStore;
  };

  const deleteStore = async (id: number): Promise<boolean> => {
    const res = await fetch(`/api/stores?storeId=${id}`, { method: 'DELETE' });
    if (!res.ok) return false;
    const remaining = await fetchStores();
    if (currentStore?.id === id) {
      const next = remaining.find(s => s.id !== id) || null;
      if (next) setCurrentStore(next);
      else setCurrentStoreState(null);
    }
    return true;
  };

  const refreshStores = async () => {
    await fetchStores();
  };

  return (
    <StoreContext.Provider value={{ stores, currentStore, setCurrentStore, addStore, deleteStore, loading, refreshStores }}>
      {children}
    </StoreContext.Provider>
  );
}
