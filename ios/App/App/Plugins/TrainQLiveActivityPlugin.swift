import Foundation
import Capacitor

// DISABLED: This plugin was interfering with the capacitor-live-activity plugin
// which uses GenericAttributes. All Live Activity management is now handled
// by the capacitor-live-activity JS plugin directly.
//
// Keeping file to prevent build errors from .m registration file.

@objc(TrainQLiveActivityPlugin)
public class TrainQLiveActivityPlugin: CAPPlugin {
    @objc func start(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func update(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func end(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func setLiveTrainingState(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func clearLiveTrainingState(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func refresh(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func debugStart(_ call: CAPPluginCall) { call.resolve([:]) }
    @objc func debugEnd(_ call: CAPPluginCall) { call.resolve([:]) }
}
