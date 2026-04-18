import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { listVehicles, addUserVehicle, updateUserVehicle, deleteUserVehicle } from '../backend/vehicleService';
import { updateUserProfile } from '../backend/userProfileService';
import type { Vehicle } from '../backend/types';

interface VehiclesContextValue {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  selectedVehicle: Vehicle | null;
  setSelectedVehicleId: (id: string | null) => Promise<void>;
  addVehicle: (v: { label: string; makeModel: string; vin: string }) => Promise<Vehicle>;
  saveVehicle: (id: string, patch: Partial<{ label: string; makeModel: string; vin: string }>) => Promise<Vehicle>;
  removeVehicle: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const VehiclesContext = createContext<VehiclesContextValue | undefined>(undefined);

export const VehiclesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshProfile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleIdState] = useState<string | null>(user?.selectedVehicleId ?? null);

  const refresh = useCallback(async () => {
    if (!user) { setVehicles([]); return; }
    setVehicles(await listVehicles());
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { setSelectedVehicleIdState(user?.selectedVehicleId ?? null); }, [user?.selectedVehicleId]);

  const setSelectedVehicleId = useCallback(async (id: string | null) => {
    setSelectedVehicleIdState(id);
    await updateUserProfile({ selectedVehicleId: id });
    await refreshProfile();
  }, [refreshProfile]);

  const addVehicle = useCallback(async (v: { label: string; makeModel: string; vin: string }) => {
    const created = await addUserVehicle(v);
    await refresh();
    return created;
  }, [refresh]);

  const saveVehicle = useCallback(async (id: string, patch: Partial<{ label: string; makeModel: string; vin: string }>) => {
    const updated = await updateUserVehicle(id, patch);
    await refresh();
    return updated;
  }, [refresh]);

  const removeVehicle = useCallback(async (id: string) => {
    await deleteUserVehicle(id);
    await refresh();
  }, [refresh]);

  const selectedVehicle = useMemo(() => vehicles.find(v => v._id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId]);

  const value = useMemo<VehiclesContextValue>(() => ({
    vehicles, selectedVehicleId, selectedVehicle,
    setSelectedVehicleId, addVehicle, saveVehicle, removeVehicle, refresh,
  }), [vehicles, selectedVehicleId, selectedVehicle, setSelectedVehicleId, addVehicle, saveVehicle, removeVehicle, refresh]);

  return <VehiclesContext.Provider value={value}>{children}</VehiclesContext.Provider>;
};

export function useVehicles(): VehiclesContextValue {
  const ctx = useContext(VehiclesContext);
  if (!ctx) throw new Error('useVehicles must be used within VehiclesProvider');
  return ctx;
}
