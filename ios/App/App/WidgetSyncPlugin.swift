//
//  WidgetSyncPlugin.swift
//  App
//
//  Capacitor plugin: receives widget data from JS and writes it to the
//  shared App Group UserDefaults so the TrainQWidget extension can read it.
//

import Foundation
import Capacitor
import WidgetKit

@objc(WidgetSyncPlugin)
public class WidgetSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetSyncPlugin"
    public let jsName = "WidgetSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncData", returnType: CAPPluginReturnPromise)
    ]

    @objc func syncData(_ call: CAPPluginCall) {
        guard let jsonString = call.getString("data"),
              let jsonData = jsonString.data(using: .utf8),
              let defaults = UserDefaults(suiteName: "group.com.trainq.app")
        else {
            call.reject("Invalid data or App Group not configured")
            return
        }

        defaults.set(jsonData, forKey: "trainq_widget_data")
        defaults.synchronize()
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
