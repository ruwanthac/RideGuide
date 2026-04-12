import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeUserVehicles,
  addUserVehicle,
  updateUserVehicle,
  deleteUserVehicle,
  updateUserProfile,
} from '../backend';

export type Vehicle = {
  id: string;
  label: string;
  makeModel: string;
  vin: string;
};

interface VehiclesContextValue {
  vehicles: Vehicle[];
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  addVehicle: () => Promise<void>;
  saveVehicle: (vehicleId: string, makeModel: string, vin: string) => Promise<void>;
  removeVehicle: (vehicleId: string) => Promise<void>;
}

const VehiclesContext = createContext<VehiclesContextValue | undefined>(undefined);

export const VehiclesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleIdState] = useState('');
  const [listReady, setListReady] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setVehicles([]);
      setSelectedVehicleIdState('');
      setListReady(false);
      return;
    }
    const unsub = subscribeUserVehicles(
      user.uid,
      (list) => {
        setVehicles(
          list.map(({ id, data }) => ({
            id,
            label: data.label,
            makeModel: data.makeModel,
            vin: data.vin,
          }))
        );
        setListReady(true);
      },
      () => setListReady(true)
    );
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!listReady || vehicles.length === 0) return;
    setSelectedVehicleIdState((prev) => {
      const fromProfile = profile?.selectedVehicleId;
      if (fromProfile && vehicles.some((v) => v.id === fromProfile)) {
        return fromProfile;
      }
      if (prev && vehicles.some((v) => v.id === prev)) {
        return prev;
      }
      return vehicles[0]!.id;
    });
  }, [listReady, vehicles, profile?.selectedVehicleId]);

  const setSelectedVehicleId = useCallback(
    (id: string) => {
      setSelectedVehicleIdState(id);
      if (user?.uid) {
        updateUserProfile(user.uid, { selectedVehicleId: id }).catch(() => {});
      }
    },
    [user?.uid]
  );

  const addVehicle = useCallback(async () => {
    if (!user?.uid) return;
    const n = vehicles.length + 1;
    const id = await addUserVehicle(user.uid, {
      label: `Car ${n}`,
      makeModel: '',
      vin: '',
    });
    setSelectedVehicleId(id);
  }, [user?.uid, vehicles.length, setSelectedVehicleId]);

  const saveVehicle = useCallback(
    async (vehicleId: string, makeModel: string, vin: string) => {
      if (!user?.uid) return;
      await updateUserVehicle(user.uid, vehicleId, {
        makeModel: makeModel.trim(),
        vin: vin.trim(),
      });
    },
    [user?.uid]
  );

  const removeVehicle = useCallback(
    async (vehicleId: string) => {
      if (!user?.uid) return;
      await deleteUserVehicle(user.uid, vehicleId);
    },
    [user?.uid]
  );

  const value = useMemo(
    () => ({
      vehicles,
      selectedVehicleId,
      setSelectedVehicleId,
      addVehicle,
      saveVehicle,
      removeVehicle,
    }),
    [
      vehicles,
      selectedVehicleId,
      setSelectedVehicleId,
      addVehicle,
      saveVehicle,
      removeVehicle,
    ]
  );

  return (
    <VehiclesContext.Provider value={value}>{children}</VehiclesContext.Provider>
  );
};

export const useVehicles = (): VehiclesContextValue => {
  const ctx = useContext(VehiclesContext);
  if (!ctx) {
    throw new Error('useVehicles must be used within a VehiclesProvider');
  }
  return ctx;
};
