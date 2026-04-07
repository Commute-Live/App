import {
  BatchSize,
  DatadogProviderConfiguration,
  DdLogs,
  SdkVerbosity,
  UploadFrequency,
} from '@datadog/mobile-react-native';

export function createDatadogConfig(): DatadogProviderConfiguration {
  const clientToken = process.env.EXPO_PUBLIC_DD_CLIENT_TOKEN ?? '';
  const applicationId = process.env.EXPO_PUBLIC_DD_APPLICATION_ID ?? '';
  const site = (process.env.EXPO_PUBLIC_DD_SITE ?? 'US5') as
    | 'US1'
    | 'US3'
    | 'US5'
    | 'EU1'
    | 'AP1'
    | 'US1_FED';

  const config = new DatadogProviderConfiguration(
    clientToken,
    __DEV__ ? 'development' : 'production',
    applicationId,
    true, // trackInteractions
    true, // trackResources
    true, // trackErrors
  );

  config.site = site;
  config.batchSize = BatchSize.SMALL;
  config.uploadFrequency = UploadFrequency.FREQUENT;
  config.verbosity = SdkVerbosity.ERROR;
  config.serviceName = 'commutelive-mobile';
  config.nativeCrashReportEnabled = true;
  config.sessionSamplingRate = 100;
  config.resourceTracingSamplingRate = 100;

  return config;
}

export function setDatadogUser(user: {id: string; email: string}): void {
  import('@datadog/mobile-react-native').then(({DdSdkReactNative}) => {
    DdSdkReactNative.setUserInfo({id: user.id, email: user.email});
  });
}

export function clearDatadogUser(): void {
  import('@datadog/mobile-react-native').then(({DdSdkReactNative}) => {
    DdSdkReactNative.setUserInfo({id: '', email: ''});
  });
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.debug(message, context);
    DdLogs.debug(message, context ?? {});
  },
  info(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.log(message, context);
    DdLogs.info(message, context ?? {});
  },
  warn(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.warn(message, context);
    DdLogs.warn(message, context ?? {});
  },
  error(message: string, context?: Record<string, unknown>): void {
    if (__DEV__) console.error(message, context);
    DdLogs.error(message, context ?? {});
  },
};
