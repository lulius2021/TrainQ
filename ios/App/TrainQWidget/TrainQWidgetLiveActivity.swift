import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Live Activity Widget (uses GenericAttributes from capacitor-live-activity)

private let accentBlue = Color(red: 0.0, green: 0.478, blue: 1.0)

struct TrainQWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GenericAttributes.self) { context in

            // MARK: Lock Screen / Notification Banner
            let exerciseName  = context.state.values["exerciseName"]  ?? "Training"
            let setInfo       = context.state.values["setInfo"]       ?? ""
            let setDetail     = context.state.values["setDetail"]     ?? ""
            let completedSets = Int(context.state.values["completedSets"]  ?? "0") ?? 0
            let totalSets     = Int(context.state.values["totalSetsCount"] ?? "0") ?? 0
            let restEndsAt    = Double(context.state.values["restEndsAt"]  ?? "0") ?? 0.0
            let progressStr   = context.state.values["progress"]      ?? "0"
            let progress      = Double(progressStr) ?? 0.0

            let isResting     = restEndsAt > Double(Date().timeIntervalSince1970)
            let restEndDate   = Date(timeIntervalSince1970: restEndsAt)

            VStack(alignment: .leading, spacing: 8) {

                // ── Row 1: icon + name + overall % ──────────────────────────
                HStack(spacing: 8) {
                    Image(systemName: isResting ? "timer" : "dumbbell.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(accentBlue)

                    Text(isResting ? "Pause" : exerciseName)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Spacer()

                    // Overall progress bar
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.15))
                            .frame(width: 60, height: 4)
                        Capsule()
                            .fill(accentBlue)
                            .frame(width: 60 * CGFloat(progress), height: 4)
                    }

                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 12, weight: .medium).monospacedDigit())
                        .foregroundColor(.white.opacity(0.6))
                }

                // ── Row 2: set info / rest timer ────────────────────────────
                HStack(spacing: 10) {
                    if isResting {
                        // Live countdown – updates itself without pushes
                        HStack(spacing: 4) {
                            Image(systemName: "hourglass")
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                            Text(timerInterval: Date()...restEndDate, countsDown: true)
                                .font(.system(size: 22, weight: .bold).monospacedDigit())
                                .foregroundColor(.white)
                                .frame(minWidth: 60, alignment: .leading)
                        }

                        Spacer()

                        // Next set detail during rest
                        if !setDetail.isEmpty {
                            Text(setDetail)
                                .font(.system(size: 13, weight: .regular))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    } else {
                        // Set info + detail
                        VStack(alignment: .leading, spacing: 2) {
                            if !setInfo.isEmpty {
                                Text(setInfo)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(.white.opacity(0.75))
                            }
                            if !setDetail.isEmpty {
                                Text(setDetail)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }

                        Spacer()

                        // "Satz abhaken" button
                        Link(destination: URL(string: "trainq://complete-set")!) {
                            HStack(spacing: 5) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 18, weight: .semibold))
                                Text("Abhaken")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundColor(accentBlue)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(accentBlue.opacity(0.15))
                            .clipShape(Capsule())
                        }
                    }
                }

                // ── Row 3: set dot indicators ────────────────────────────────
                if totalSets > 0 {
                    let maxDots = min(totalSets, 10)
                    HStack(spacing: 5) {
                        ForEach(0..<maxDots, id: \.self) { i in
                            Circle()
                                .fill(i < completedSets ? accentBlue : Color.white.opacity(0.25))
                                .frame(width: 7, height: 7)
                        }
                        if totalSets > 10 {
                            Text("+\(totalSets - 10)")
                                .font(.system(size: 10))
                                .foregroundColor(.white.opacity(0.4))
                        }
                        Spacer()
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(Color(red: 0.07, green: 0.07, blue: 0.09))
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            let exerciseName = context.state.values["exerciseName"] ?? "Training"
            let setInfo      = context.state.values["setInfo"]      ?? ""
            let restEndsAt   = Double(context.state.values["restEndsAt"] ?? "0") ?? 0.0
            let progressStr  = context.state.values["progress"]     ?? "0"
            let progress     = Double(progressStr) ?? 0.0
            let isResting    = restEndsAt > Double(Date().timeIntervalSince1970)
            let restEndDate  = Date(timeIntervalSince1970: restEndsAt)

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: isResting ? "timer" : "dumbbell.fill")
                            .font(.system(size: 14))
                            .foregroundColor(accentBlue)
                        Text(isResting ? "Pause" : exerciseName)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if isResting {
                        Text(timerInterval: Date()...restEndDate, countsDown: true)
                            .font(.system(size: 14, weight: .bold).monospacedDigit())
                            .foregroundColor(.white)
                    } else {
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 13, weight: .medium).monospacedDigit())
                            .foregroundColor(.white.opacity(0.75))
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        if !isResting {
                            ZStack {
                                Circle()
                                    .stroke(Color.white.opacity(0.2), lineWidth: 2)
                                Circle()
                                    .trim(from: 0, to: progress)
                                    .stroke(accentBlue, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                                    .rotationEffect(.degrees(-90))
                            }
                            .frame(width: 16, height: 16)
                        }
                        if !setInfo.isEmpty {
                            Text(setInfo)
                                .font(.system(size: 13))
                                .foregroundColor(.white.opacity(0.75))
                        }
                        Spacer()
                        if !isResting {
                            Link(destination: URL(string: "trainq://complete-set")!) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(accentBlue)
                            }
                        }
                    }
                }

            } compactLeading: {
                Image(systemName: isResting ? "timer" : "dumbbell.fill")
                    .font(.system(size: 12))
                    .foregroundColor(accentBlue)

            } compactTrailing: {
                if isResting {
                    Text(timerInterval: Date()...restEndDate, countsDown: true)
                        .font(.system(size: 12, weight: .bold).monospacedDigit())
                        .foregroundColor(.white)
                } else {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 12, weight: .medium).monospacedDigit())
                        .foregroundColor(.white)
                }

            } minimal: {
                if isResting {
                    Image(systemName: "timer")
                        .font(.system(size: 12))
                        .foregroundColor(accentBlue)
                } else {
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.25), lineWidth: 2)
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(accentBlue, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 16, height: 16)
                }
            }
        }
    }
}
