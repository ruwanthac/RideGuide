import React, { createContext, useContext, useMemo, useState } from 'react';

export type Vehicle = {
  id: string;
  label: string;
  makeModel: string;
  vin: string;
};

const DEFAULT_MAKE_MODEL = 'Toyota Camry 2020';
const DEFAULT_VIN = '1HGBH41JXMN109186';

export const INITIAL_VEHICLES: Vehicle[] = [
  { id: 'vehicle-1', label: 'Car 1', makeModel: DEFAULT_MAKE_MODEL, vin: DEFAULT_VIN },
];

interface VehiclesContextValue {
  vehicles: Vehicle[];
  setVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>;
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
}

const VehiclesContext = createContext<VehiclesContextValue | undefined>(undefined);

export const VehiclesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(INITIAL_VEHICLES[0].id);

  const value = useMemo(
    () => ({
      vehicles,
      setVehicles,
      selectedVehicleId,
      setSelectedVehicleId,
    }),
    [vehicles, selectedVehicleId]
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
