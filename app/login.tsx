import React from 'react';
import OnboardingFlowScreen from '../features/onboarding/screens/OnboardingFlowScreen';

export default function LoginRoute() {
  return <OnboardingFlowScreen initialMode="signin" autoOpenAuth />;
}
