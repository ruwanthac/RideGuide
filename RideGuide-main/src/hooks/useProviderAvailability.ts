import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../backend/userProfileService';
import { extractApiError } from '../backend/apiClient';

/** The mechanic / tow "online for new jobs" switch, shared by Home and Profile. */
export function useProviderAvailability() {
  const { user, refreshProfile } = useAuth();
  const isTow = user?.role === 'tow';
  const online = isTow ? user?.towAvailable !== false : user?.mechanicAvailable !== false;
  const [switching, setSwitching] = useState(false);

  const toggle = async () => {
    if (!user?._id || switching) return;
    setSwitching(true);
    try {
      await updateUserProfile(isTow ? { towAvailable: !online } : { mechanicAvailable: !online });
      await refreshProfile();
    } catch (e) {
      Alert.alert('Could not change your status', extractApiError(e, 'Please try again.'));
    } finally {
      setSwitching(false);
    }
  };

  return { online, switching, toggle };
}
