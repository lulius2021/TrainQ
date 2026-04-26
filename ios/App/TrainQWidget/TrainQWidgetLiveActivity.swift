import ActivityKit
import WidgetKit
import SwiftUI

// MARK: - Live Activity Widget (uses GenericAttributes from capacitor-live-activity)

private let accentBlue = Color(red: 0.0, green: 0.478, blue: 1.0)
private let bgColor = Color(red: 0.07, green: 0.07, blue: 0.09)

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

            VStack(alignment: .leading, spacing: 12) {

                // ── Row 1: icon + name + overall % ──────────────────────────
                HStack(spacing: 10) {
                    Image(systemName: isResting ? "timer" : "dumbbell.fill")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(accentBlue)

                    Text(isResting ? "Pause" : exerciseName)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(1)

                    Spacer()

                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 14, weight: .bold).monospacedDigit())
                        .foregroundColor(accentBlue)
                }

                // ── Progress bar ────────────────────────────────────────────
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.12))
                            .frame(height: 5)
                        Capsule()
                            .fill(accentBlue)
                            .frame(width: geo.size.width * CGFloat(progress), height: 5)
                    }
                }
                .frame(height: 5)

                // ── Row 2: set info / rest timer ────────────────────────────
                HStack(spacing: 12) {
                    if isResting {
                        // Live countdown
                        HStack(spacing: 6) {
                            Image(systemName: "hourglass")
                                .font(.system(size: 14))
                                .foregroundColor(.white.opacity(0.7))
                            Text(timerInterval: Date()...restEndDate, countsDown: true)
                                .font(.system(size: 28, weight: .bold).monospacedDigit())
                                .foregroundColor(.white)
                                .frame(minWidth: 70, alignment: .leading)
                        }

                        Spacer()

                        if !setDetail.isEmpty {
                            Text(setDetail)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white.opacity(0.6))
                        }
                    } else {
                        // Set info + detail
                        VStack(alignment: .leading, spacing: 3) {
                            if !setInfo.isEmpty {
                                Text(setInfo)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            if !setDetail.isEmpty {
                                Text(setDetail)
                                    .font(.system(size: 22, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }

                        Spacer()

                        // "Satz abhaken" button
                        Link(destination: URL(string: "trainq://complete-set")!) {
                            HStack(spacing: 6) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 20, weight: .semibold))
                                Text("Abhaken")
                                    .font(.system(size: 14, weight: .bold))
                            }
                            .foregroundColor(accentBlue)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(accentBlue.opacity(0.15))
                            .clipShape(Capsule())
                        }
                    }
                }

                // ── Row 3: set dot indicators ────────────────────────────────
                if totalSets > 0 {
                    let maxDots = min(totalSets, 12)
                    HStack(spacing: 6) {
                        ForEach(0..<maxDots, id: \.self) { i in
                            Circle()
                                .fill(i < completedSets ? accentBlue : Color.white.opacity(0.2))
                                .frame(width: 9, height: 9)
                        }
                        if totalSets > 12 {
                            Text("+\(totalSets - 12)")
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.white.opacity(0.4))
                        }
                        Spacer()
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .activityBackgroundTint(bgColor)
            .activitySystemActionForegroundColor(.white)

        } dynamicIsland: { context in
            let exerciseName = context.state.values["exerciseName"] ?? "Training"
            let setInfo      = context.state.values["setInfo"]      ?? ""
            let setDetail    = context.state.values["setDetail"]    ?? ""
            let restEndsAt   = Double(context.state.values["restEndsAt"] ?? "0") ?? 0.0
            let progressStr  = context.state.values["progress"]     ?? "0"
            let progress     = Double(progressStr) ?? 0.0
            let isResting    = restEndsAt > Double(Date().timeIntervalSince1970)
            let restEndDate  = Date(timeIntervalSince1970: restEndsAt)

            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: isResting ? "timer" : "dumbbell.fill")
                            .font(.system(size: 15))
                            .foregroundColor(accentBlue)
                        Text(isResting ? "Pause" : exerciseName)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.white)
                            .lineLimit(1)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    if isResting {
                        Text(timerInterval: Date()...restEndDate, countsDown: true)
                            .font(.system(size: 15, weight: .bold).monospacedDigit())
                            .foregroundColor(.white)
                    } else {
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 14, weight: .bold).monospacedDigit())
                            .foregroundColor(accentBlue)
                    }
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            if !setInfo.isEmpty {
                                Text(setInfo)
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            if !setDetail.isEmpty {
                                Text(setDetail)
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                            }
                        }
                        Spacer()
                        if !isResting {
                            Link(destination: URL(string: "trainq://complete-set")!) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.system(size: 24))
                                    .foregroundColor(accentBlue)
                            }
                        }
                    }
                }

            } compactLeading: {
                Image(systemName: isResting ? "timer" : "dumbbell.fill")
                    .font(.system(size: 13))
                    .foregroundColor(accentBlue)

            } compactTrailing: {
                if isResting {
                    Text(timerInterval: Date()...restEndDate, countsDown: true)
                        .font(.system(size: 13, weight: .bold).monospacedDigit())
                        .foregroundColor(.white)
                } else {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: 13, weight: .bold).monospacedDigit())
                        .foregroundColor(.white)
                }

            } minimal: {
                if isResting {
                    Image(systemName: "timer")
                        .font(.system(size: 13))
                        .foregroundColor(accentBlue)
                } else {
                    ZStack {
                        Circle()
                            .stroke(Color.white.opacity(0.25), lineWidth: 2.5)
                        Circle()
                            .trim(from: 0, to: progress)
                            .stroke(accentBlue, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                    }
                    .frame(width: 18, height: 18)
                }
            }
        }
    }
}
