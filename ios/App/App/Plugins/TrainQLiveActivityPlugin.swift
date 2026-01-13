import Foundation
import Capacitor
import ActivityKit
import UIKit

@objc(TrainQLiveActivityPlugin)
public class TrainQLiveActivityPlugin: CAPPlugin {
    private let activityIdKey = "trainq_live_activity_id"
    private var currentState: TrainQWorkoutAttributes.ContentState?
    private var currentWorkoutId: String?
    private var isLiveTrainingRunning = false

    public override func load() {
        NotificationCenter.default.addObserver(self, selector: #selector(appDidEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appWillEnterForeground), name: UIApplication.willEnterForegroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc private func appDidEnterBackground() {
        print("[LiveActivity] didEnterBackground")
        guard isLiveTrainingRunning, let state = currentState, let workoutId = currentWorkoutId else { return }
        ensureActivity(workoutId: workoutId, state: state)
    }

    @objc private func appWillEnterForeground() {
        print("[LiveActivity] willEnterForeground")
        endActivityIfNeeded()
    }

    @objc private func appDidBecomeActive() {
        print("[LiveActivity] didBecomeActive")
        endActivityIfNeeded()
    }

    @objc func start(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve([:])
            return
        }
        print("[LiveActivity] start called")

        let payload = parsePayload(call)
        currentWorkoutId = payload.workoutId
        currentState = payload.state
        isLiveTrainingRunning = true

        if UIApplication.shared.applicationState == .background {
            ensureActivity(workoutId: payload.workoutId, state: payload.state)
        }
        call.resolve([:])
    }

    @objc func update(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LiveActivity] update called")

        let payload = parsePayload(call)
        currentWorkoutId = payload.workoutId
        currentState = payload.state
        isLiveTrainingRunning = true

        if UIApplication.shared.applicationState == .background {
            ensureActivity(workoutId: payload.workoutId, state: payload.state)
        }
        call.resolve()
    }

    @objc func end(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LiveActivity] end called")

        isLiveTrainingRunning = false
        currentState = nil
        currentWorkoutId = nil
        endActivityIfNeeded()
        call.resolve()
    }

    @objc func setLiveTrainingState(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LiveActivity] setLiveTrainingState called")

        let payload = parsePayload(call)
        currentWorkoutId = payload.workoutId
        currentState = payload.state
        isLiveTrainingRunning = true

        if UIApplication.shared.applicationState == .background {
            ensureActivity(workoutId: payload.workoutId, state: payload.state)
        }
        call.resolve()
    }

    @objc func clearLiveTrainingState(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LiveActivity] clearLiveTrainingState called")

        isLiveTrainingRunning = false
        currentState = nil
        currentWorkoutId = nil
        endActivityIfNeeded()
        call.resolve()
    }

    @objc func refresh(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LiveActivity] refresh called")

        guard isLiveTrainingRunning, let state = currentState, let workoutId = currentWorkoutId else {
            call.resolve()
            return
        }

        if UIApplication.shared.applicationState == .background {
            ensureActivity(workoutId: workoutId, state: state)
        }
        call.resolve()
    }

    @objc func debugStart(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LA] debugStart called")

        let workoutId = "debug"
        let state = TrainQWorkoutAttributes.ContentState(
            badge: "GYM",
            title: "Push (Brust/Schulter/Trizeps)",
            subtitle: "Übung 0/0",
            primaryLine: "Workout läuft",
            avatarLetter: "W",
            deepLink: "trainq://live?workoutId=debug",
            updatedAt: Int(Date().timeIntervalSince1970)
        )

        currentWorkoutId = workoutId
        currentState = state
        isLiveTrainingRunning = true

        Task { @MainActor in
            do {
                let activity = try Activity.request(
                    attributes: TrainQWorkoutAttributes(workoutId: workoutId),
                    contentState: state,
                    pushType: nil
                )
                UserDefaults.standard.set(activity.id, forKey: activityIdKey)
                print("[LA] requested id = \(activity.id)")
                call.resolve(["ok": true, "id": activity.id])
            } catch {
                print("[LA] request failed: \(error.localizedDescription)")
                call.resolve(["ok": false, "error": error.localizedDescription])
            }
        }
    }

    @objc func debugEnd(_ call: CAPPluginCall) {
        guard #available(iOS 16.1, *) else {
            call.resolve()
            return
        }
        print("[LA] debugEnd called")
        isLiveTrainingRunning = false
        currentState = nil
        currentWorkoutId = nil
        Task { @MainActor in
            self.endActivityIfNeeded()
            call.resolve(["ok": true])
        }
    }

    @available(iOS 16.1, *)
    private func findActivity() -> Activity<TrainQWorkoutAttributes>? {
        let storedId = UserDefaults.standard.string(forKey: activityIdKey)
        if let id = storedId {
            let match = Activity<TrainQWorkoutAttributes>.activities.first(where: { $0.id == id })
            if let match = match { return match }
        }
        return Activity<TrainQWorkoutAttributes>.activities.first
    }

    @available(iOS 16.1, *)
    private func ensureActivity(workoutId: String, state: TrainQWorkoutAttributes.ContentState) {
        let auth = ActivityAuthorizationInfo()
        if !auth.areActivitiesEnabled {
            print("[LiveActivity] activities disabled")
            return
        }

        if let activity = findActivity() {
            print("[LiveActivity] updating activity")
            Task { await activity.update(using: state) }
            return
        }

        let attributes = TrainQWorkoutAttributes(workoutId: workoutId)
        do {
            let activity = try Activity.request(attributes: attributes, contentState: state, pushType: nil)
            UserDefaults.standard.set(activity.id, forKey: activityIdKey)
            print("[LiveActivity] activity started id=\(activity.id)")
        } catch {
            print("[LiveActivity] request failed: \(error.localizedDescription)")
            return
        }
    }

    @available(iOS 16.1, *)
    private func endActivityIfNeeded() {
        guard let activity = findActivity() else { return }
        Task {
            await activity.end(dismissalPolicy: .immediate)
            UserDefaults.standard.removeObject(forKey: activityIdKey)
            print("[LiveActivity] activity ended")
        }
    }

    private func parsePayload(_ call: CAPPluginCall) -> (workoutId: String, state: TrainQWorkoutAttributes.ContentState) {
        let workoutId = call.getString("workoutId") ?? UUID().uuidString
        let badge = call.getString("badge") ?? "GYM"
        let title = call.getString("title") ?? "Workout"
        let subtitle = call.getString("subtitle") ?? ""
        let primaryLine = call.getString("primaryLine") ?? ""
        let avatarLetter = call.getString("avatarLetter") ?? "W"
        let deepLink = call.getString("deepLink")
        let updatedAt = call.getInt("updatedAt") ?? Int(Date().timeIntervalSince1970)

        let state = TrainQWorkoutAttributes.ContentState(
            badge: badge,
            title: title,
            subtitle: subtitle,
            primaryLine: primaryLine,
            avatarLetter: avatarLetter,
            deepLink: deepLink,
            updatedAt: updatedAt
        )

        return (workoutId, state)
    }
}
