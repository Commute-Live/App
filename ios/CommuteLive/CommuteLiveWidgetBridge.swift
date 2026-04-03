import Foundation
import React
import WidgetKit

private let widgetAppGroupId = "group.com.commutelive.app"
private let widgetSnapshotDefaultsKey = "commutelive.widgetSnapshot"

@objc(CommuteLiveWidgetBridge)
class CommuteLiveWidgetBridge: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(syncWidgetSnapshot:resolver:rejecter:)
  func syncWidgetSnapshot(
    _ json: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: widgetAppGroupId) else {
      reject("widget_defaults_unavailable", "Unable to access shared widget defaults.", nil)
      return
    }

    defaults.set(json, forKey: widgetSnapshotDefaultsKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc(clearWidgetSnapshot:rejecter:)
  func clearWidgetSnapshot(
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: widgetAppGroupId) else {
      reject("widget_defaults_unavailable", "Unable to access shared widget defaults.", nil)
      return
    }

    defaults.removeObject(forKey: widgetSnapshotDefaultsKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }
}
