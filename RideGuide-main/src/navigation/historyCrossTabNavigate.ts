/** Cross-tab navigation from History stack into Home stack (typed loosely for tab composite). */

export function navigateToHomeVideoCall(
  navigation: { getParent: () => unknown },
  params: { priorConversationSummary?: string; vehicleId?: string }
) {
  const parent = navigation.getParent() as { navigate: (name: string, p?: object) => void } | undefined;
  parent?.navigate('HomeTab', {
    screen: 'VideoCall',
    params,
  });
}

export function navigateToHomeChatAssistant(
  navigation: { getParent: () => unknown },
  params: { sessionId?: string }
) {
  const parent = navigation.getParent() as { navigate: (name: string, p?: object) => void } | undefined;
  parent?.navigate('HomeTab', {
    screen: 'ChatAssistant',
    params,
  });
}

export function navigateToTowOwnerTracking(
  navigation: { getParent: () => unknown },
  requestId: string
) {
  const parent = navigation.getParent() as { navigate: (name: string, p?: object) => void } | undefined;
  parent?.navigate('HomeTab', {
    screen: 'TowOwnerTracking',
    params: { requestId },
  });
}

/** Open Profile tab → Privacy (e.g. provider must add phone before accepting a job). */
export function navigateToProfilePrivacy(navigation: { getParent: () => unknown }) {
  const parent = navigation.getParent() as { navigate: (name: string, p?: object) => void } | undefined;
  parent?.navigate('ProfileTab', {
    screen: 'Privacy',
  });
}
