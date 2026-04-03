#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CommuteLiveWidgetBridge, NSObject)

RCT_EXTERN_METHOD(syncWidgetSnapshot:(NSString *)json
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearWidgetSnapshot:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
