import React from 'react';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DiagnosisResult, diagnosisAsText } from '../components';
import { navigateToHomeVideoCall } from '../navigation/historyCrossTabNavigate';
import type { HistoryStackParamList } from '../types/navigation';

type Nav = NativeStackNavigationProp<HistoryStackParamList, 'DiagnosisHistoryDetail'>;
type R = RouteProp<HistoryStackParamList, 'DiagnosisHistoryDetail'>;

/** A saved diagnosis, shown with the same layout as a fresh result. */
export const DiagnosisHistoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();
  const { entry } = route.params;

  return (
    <DiagnosisResult
      entry={entry}
      onBack={() => navigation.goBack()}
      onGetMechanic={() => {
        const parent = navigation.getParent() as { navigate: (name: string, p?: object) => void } | undefined;
        parent?.navigate('HomeTab', { screen: 'TowTruckAssistant', params: { tripType: 'roadside' } });
      }}
      onAskExpert={() =>
        navigateToHomeVideoCall(navigation, {
          priorConversationSummary: diagnosisAsText(entry),
          vehicleId: entry.vehicleId ?? undefined,
        })
      }
    />
  );
};
