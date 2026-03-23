import React from 'react';
import OnboardingFlowScreen from '../features/onboarding/screens/OnboardingFlowScreen';

export default function SignUpRoute() {
  return <OnboardingFlowScreen initialMode="signup" autoOpenAuth />;
}
