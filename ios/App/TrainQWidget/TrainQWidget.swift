//
//  TrainQWidget.swift
//  TrainQWidget
//
//  Complete redesign: shows today's workout, weekly progress, and streak.
//  Data is written by the main app via WidgetSyncPlugin into the shared
//  App Group UserDefaults (group.com.trainq.app → trainq_widget_data).
//

import WidgetKit
import SwiftUI
import UIKit

// MARK: - Shared Data Model

struct TrainQWidgetData: Codable {
    static let appGroupID = "group.com.trainq.app"
    static let defaultsKey = "trainq_widget_data"

    struct TodayWorkout: Codable {
        let workoutType: String      // "Push" | "Pull" | "Upper" | "Lower"
        let status: String           // "planned" | "completed" | "skipped" | "adaptive"
        let exercises: [String]
        let estimatedMinutes: Int
        let completedSets: Int
        let totalSets: Int
    }

    struct DayStatus: Codable {
        let weekday: String          // "Mo" | "Di" | ... | "So"
        let status: String           // "completed" | "planned" | "rest" | "none"
    }

    struct WeekProgress: Codable {
        let days: [DayStatus]
        let completedCount: Int
        let totalCount: Int
        let streak: Int
    }

    struct LastWorkout: Codable {
        let workoutType: String
        let durationMinutes: Int
        let exerciseCount: Int
        let daysAgo: Int
    }

    let todayWorkout: TodayWorkout?
    let weekProgress: WeekProgress
    let lastWorkout: LastWorkout?
    let totalWorkouts: Int

    static func load() -> TrainQWidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupID),
              let data = defaults.data(forKey: defaultsKey),
              let decoded = try? JSONDecoder().decode(TrainQWidgetData.self, from: data)
        else { return .placeholder }
        return decoded
    }

    static var placeholder: TrainQWidgetData {
        TrainQWidgetData(
            todayWorkout: TodayWorkout(
                workoutType: "Push",
                status: "planned",
                exercises: ["Bankdrücken", "Schulterdrücken", "Trizeps Pushdown", "Seitheben"],
                estimatedMinutes: 60,
                completedSets: 0,
                totalSets: 18
            ),
            weekProgress: WeekProgress(
                days: [
                    DayStatus(weekday: "Mo", status: "completed"),
                    DayStatus(weekday: "Di", status: "completed"),
                    DayStatus(weekday: "Mi", status: "planned"),
                    DayStatus(weekday: "Do", status: "none"),
                    DayStatus(weekday: "Fr", status: "planned"),
                    DayStatus(weekday: "Sa", status: "rest"),
                    DayStatus(weekday: "So", status: "rest")
                ],
                completedCount: 2,
                totalCount: 4,
                streak: 5
            ),
            lastWorkout: LastWorkout(workoutType: "Pull", durationMinutes: 52, exerciseCount: 6, daysAgo: 1),
            totalWorkouts: 42
        )
    }
}

// MARK: - Styling Helpers

extension String {
    var workoutColor: Color {
        switch self.lowercased() {
        case "push":  return Color(red: 1.0,  green: 0.45, blue: 0.1)
        case "pull":  return Color(red: 0.25, green: 0.6,  blue: 1.0)
        case "upper": return Color(red: 0.2,  green: 0.82, blue: 0.5)
        case "lower": return Color(red: 0.85, green: 0.3,  blue: 0.7)
        default:      return Color(red: 0.44, green: 0.35, blue: 0.9)
        }
    }

    var statusIcon: String {
        switch self {
        case "completed": return "checkmark.circle.fill"
        case "planned":   return "arrow.right.circle.fill"
        case "skipped":   return "xmark.circle.fill"
        case "adaptive":  return "bolt.circle.fill"
        default:          return "circle"
        }
    }

    var statusColor: Color {
        switch self {
        case "completed": return .green
        case "planned":   return .blue
        case "skipped":   return .orange
        case "adaptive":  return .purple
        default:          return .secondary
        }
    }

    var statusLabel: String {
        switch self {
        case "completed": return "Fertig ✓"
        case "planned":   return "Geplant"
        case "skipped":   return "Übersprungen"
        case "adaptive":  return "Adaptiert"
        default:          return "—"
        }
    }
}

// MARK: - Timeline

struct TrainQEntry: TimelineEntry {
    let date: Date
    let data: TrainQWidgetData
}

struct TrainQProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrainQEntry {
        TrainQEntry(date: .now, data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TrainQEntry) -> Void) {
        completion(TrainQEntry(date: .now, data: TrainQWidgetData.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrainQEntry>) -> Void) {
        let data = TrainQWidgetData.load()
        let entry = TrainQEntry(date: .now, data: data)
        // Refresh every 15 min; app also triggers reload via WidgetCenter on data changes
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    let entry: TrainQEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row
            HStack(alignment: .center) {
                Text("TrainQ")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)
                Spacer()
                if entry.data.weekProgress.streak > 0 {
                    HStack(spacing: 2) {
                        Text("🔥")
                            .font(.system(size: 10))
                        Text("\(entry.data.weekProgress.streak)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(.orange)
                    }
                }
            }

            Spacer(minLength: 6)

            if let workout = entry.data.todayWorkout {
                // Workout type — big focal element
                Text(workout.workoutType)
                    .font(.system(size: 28, weight: .black))
                    .foregroundStyle(workout.workoutType.workoutColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)

                Text("Day")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(workout.workoutType.workoutColor.opacity(0.7))

                Spacer(minLength: 6)

                // Status badge
                HStack(spacing: 4) {
                    Image(systemName: workout.status.statusIcon)
                        .font(.system(size: 11))
                    Text(workout.status.statusLabel)
                        .font(.system(size: 11, weight: .semibold))
                }
                .foregroundStyle(workout.status.statusColor)

                if workout.estimatedMinutes > 0 && workout.status != "completed" {
                    HStack(spacing: 3) {
                        Image(systemName: "clock")
                            .font(.system(size: 9))
                        Text("~\(workout.estimatedMinutes) Min")
                            .font(.system(size: 10))
                    }
                    .foregroundStyle(.tertiary)
                    .padding(.top, 1)
                }

            } else {
                Image(systemName: "bed.double.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 4)
                Text("Ruhetag")
                    .font(.system(size: 17, weight: .bold))
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            // Week progress bar
            VStack(alignment: .leading, spacing: 3) {
                let total = entry.data.weekProgress.totalCount
                let done  = entry.data.weekProgress.completedCount
                let progress: Double = total > 0 ? Double(done) / Double(total) : 0

                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.secondary.opacity(0.18)).frame(height: 5)
                        let w = geo.size.width * progress
                        if w > 0 {
                            Capsule()
                                .fill(entry.data.todayWorkout?.workoutType.workoutColor ?? .indigo)
                                .frame(width: w, height: 5)
                        }
                    }
                }
                .frame(height: 5)

                Text("\(done)/\(total) diese Woche")
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(12)
        .containerBackground(Color(UIColor.systemBackground), for: .widget)
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    let entry: TrainQEntry

    var body: some View {
        HStack(alignment: .top, spacing: 14) {

            // Left column: today
            VStack(alignment: .leading, spacing: 5) {
                Text("Heute")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.secondary)

                if let workout = entry.data.todayWorkout {
                    Text(workout.workoutType)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(workout.workoutType.workoutColor)

                    HStack(spacing: 4) {
                        Image(systemName: workout.status.statusIcon)
                            .font(.system(size: 10))
                        Text(workout.status.statusLabel)
                            .font(.system(size: 10, weight: .semibold))
                    }
                    .foregroundStyle(workout.status.statusColor)

                    if workout.estimatedMinutes > 0 {
                        HStack(spacing: 3) {
                            Image(systemName: "clock")
                                .font(.system(size: 9))
                            Text("~\(workout.estimatedMinutes) Min")
                                .font(.system(size: 10))
                        }
                        .foregroundStyle(.tertiary)
                    }

                    Spacer(minLength: 6)

                    // Exercise list
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(Array(workout.exercises.prefix(4).enumerated()), id: \.offset) { _, ex in
                            HStack(spacing: 5) {
                                Circle()
                                    .fill(workout.workoutType.workoutColor)
                                    .frame(width: 4, height: 4)
                                Text(ex)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                        if workout.exercises.count > 4 {
                            Text("+\(workout.exercises.count - 4) weitere")
                                .font(.system(size: 9))
                                .foregroundStyle(.quaternary)
                        }
                    }

                } else {
                    Image(systemName: "bed.double.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(.secondary)
                        .padding(.top, 4)
                    Text("Ruhetag")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.secondary)
                    Text("Erholung ist\nauch Training")
                        .font(.system(size: 10))
                        .foregroundStyle(.tertiary)
                        .lineLimit(2)
                }

                Spacer(minLength: 0)
            }

            // Divider
            Rectangle()
                .fill(.secondary.opacity(0.2))
                .frame(width: 0.5)
                .padding(.vertical, 2)

            // Right column: week
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("Diese Woche")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.secondary)
                    Spacer()
                    if entry.data.weekProgress.streak > 0 {
                        HStack(spacing: 2) {
                            Text("🔥")
                                .font(.system(size: 10))
                            Text("\(entry.data.weekProgress.streak)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.orange)
                        }
                    }
                }

                // Day dots
                HStack(spacing: 3) {
                    ForEach(entry.data.weekProgress.days, id: \.weekday) { day in
                        DayDot(day: day, accentColor: entry.data.todayWorkout?.workoutType.workoutColor ?? .indigo)
                    }
                }

                Spacer(minLength: 4)

                // Count
                let total = entry.data.weekProgress.totalCount
                let done  = entry.data.weekProgress.completedCount

                Text("\(done)")
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(entry.data.todayWorkout?.workoutType.workoutColor ?? .indigo)
                + Text(" / \(total)")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(.secondary)

                Text("Trainings abgeschlossen")
                    .font(.system(size: 9))
                    .foregroundStyle(.tertiary)

                Spacer(minLength: 4)

                // Progress bar
                let progress: Double = total > 0 ? Double(done) / Double(total) : 0
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.secondary.opacity(0.18)).frame(height: 6)
                        let w = geo.size.width * progress
                        if w > 0 {
                            Capsule()
                                .fill(entry.data.todayWorkout?.workoutType.workoutColor ?? .indigo)
                                .frame(width: w, height: 6)
                        }
                    }
                }
                .frame(height: 6)

                // Last workout hint
                if let last = entry.data.lastWorkout {
                    let when = last.daysAgo == 0 ? "Heute" : last.daysAgo == 1 ? "Gestern" : "vor \(last.daysAgo)T"
                    Text("\(last.workoutType) • \(when) • \(last.durationMinutes) Min")
                        .font(.system(size: 9))
                        .foregroundStyle(.quaternary)
                        .lineLimit(1)
                }
            }
        }
        .padding(13)
        .containerBackground(Color(UIColor.systemBackground), for: .widget)
    }
}

// MARK: - Large Widget

struct LargeWidgetView: View {
    let entry: TrainQEntry

    var accentColor: Color {
        entry.data.todayWorkout?.workoutType.workoutColor ?? .indigo
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {

            // ── Header ──────────────────────────────────────────────
            HStack {
                HStack(spacing: 6) {
                    Image(systemName: "dumbbell.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(accentColor)
                    Text("TrainQ")
                        .font(.system(size: 16, weight: .bold))
                }
                Spacer()
                if entry.data.weekProgress.streak > 0 {
                    HStack(spacing: 4) {
                        Text("🔥")
                            .font(.system(size: 14))
                        Text("\(entry.data.weekProgress.streak) Tage Streak")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(.orange)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(.orange.opacity(0.12), in: Capsule())
                }
            }

            Divider()

            // ── Week calendar row ────────────────────────────────────
            HStack(spacing: 0) {
                ForEach(entry.data.weekProgress.days, id: \.weekday) { day in
                    LargeDayColumn(day: day, accentColor: accentColor)
                    if day.weekday != entry.data.weekProgress.days.last?.weekday {
                        Spacer(minLength: 0)
                    }
                }
            }

            Divider()

            // ── Today's workout ──────────────────────────────────────
            if let workout = entry.data.todayWorkout {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Heute")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(.secondary)
                            HStack(alignment: .firstTextBaseline, spacing: 4) {
                                Text(workout.workoutType)
                                    .font(.system(size: 26, weight: .black))
                                    .foregroundStyle(workout.workoutType.workoutColor)
                                Text("Day")
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(workout.workoutType.workoutColor.opacity(0.6))
                            }
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 4) {
                            HStack(spacing: 5) {
                                Image(systemName: workout.status.statusIcon)
                                    .font(.system(size: 12))
                                Text(workout.status.statusLabel)
                                    .font(.system(size: 12, weight: .semibold))
                            }
                            .foregroundStyle(workout.status.statusColor)
                            if workout.estimatedMinutes > 0 {
                                HStack(spacing: 3) {
                                    Image(systemName: "clock")
                                        .font(.system(size: 10))
                                    Text("~\(workout.estimatedMinutes) Min")
                                        .font(.system(size: 11))
                                }
                                .foregroundStyle(.secondary)
                            }
                        }
                    }

                    // Exercise grid
                    let cols = [GridItem(.flexible()), GridItem(.flexible())]
                    LazyVGrid(columns: cols, spacing: 5) {
                        ForEach(Array(workout.exercises.prefix(6).enumerated()), id: \.offset) { _, ex in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(workout.workoutType.workoutColor)
                                    .frame(width: 5, height: 5)
                                Text(ex)
                                    .font(.system(size: 11))
                                    .lineLimit(1)
                                    .foregroundStyle(.primary)
                                Spacer(minLength: 0)
                            }
                        }
                    }

                    if workout.exercises.count > 6 {
                        Text("+ \(workout.exercises.count - 6) weitere Übungen")
                            .font(.system(size: 10))
                            .foregroundStyle(.tertiary)
                    }
                }
            } else {
                HStack(spacing: 14) {
                    Image(systemName: "bed.double.fill")
                        .font(.system(size: 28))
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Ruhetag")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundStyle(.secondary)
                        Text("Genieß die Erholung – morgen wieder Gas geben 💪")
                            .font(.system(size: 11))
                            .foregroundStyle(.tertiary)
                            .lineLimit(2)
                    }
                }
            }

            Spacer(minLength: 0)

            Divider()

            // ── Footer: stats ────────────────────────────────────────
            HStack {
                if let last = entry.data.lastWorkout {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Letztes Training")
                            .font(.system(size: 9))
                            .foregroundStyle(.tertiary)
                        let when = last.daysAgo == 0 ? "Heute" : last.daysAgo == 1 ? "Gestern" : "vor \(last.daysAgo) Tagen"
                        Text("\(last.workoutType) · \(when) · \(last.durationMinutes) Min · \(last.exerciseCount) Übungen")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 1) {
                    Text("Gesamt")
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                    Text("\(entry.data.totalWorkouts) Trainings")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .containerBackground(Color(UIColor.systemBackground), for: .widget)
    }
}

// MARK: - Reusable subviews

struct DayDot: View {
    let day: TrainQWidgetData.DayStatus
    let accentColor: Color

    var body: some View {
        VStack(spacing: 2) {
            ZStack {
                Circle()
                    .fill(bgColor)
                    .frame(width: 22, height: 22)
                icon
            }
            Text(day.weekday)
                .font(.system(size: 7, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder var icon: some View {
        switch day.status {
        case "completed":
            Image(systemName: "checkmark")
                .font(.system(size: 8, weight: .black))
                .foregroundStyle(.white)
        case "planned":
            Circle()
                .fill(accentColor.opacity(0.8))
                .frame(width: 6, height: 6)
        case "rest":
            Image(systemName: "minus")
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.tertiary)
        default:
            EmptyView()
        }
    }

    var bgColor: Color {
        switch day.status {
        case "completed": return .green
        case "planned":   return accentColor.opacity(0.2)
        case "rest":      return .secondary.opacity(0.1)
        default:          return .secondary.opacity(0.06)
        }
    }
}

struct LargeDayColumn: View {
    let day: TrainQWidgetData.DayStatus
    let accentColor: Color

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: 7)
                    .fill(bgColor)
                    .frame(width: 30, height: 30)
                icon
            }
            Text(day.weekday)
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder var icon: some View {
        switch day.status {
        case "completed":
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(.white)
        case "planned":
            Circle()
                .fill(accentColor)
                .frame(width: 8, height: 8)
        case "rest":
            Image(systemName: "minus")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.tertiary)
        default:
            EmptyView()
        }
    }

    var bgColor: Color {
        switch day.status {
        case "completed": return .green
        case "planned":   return accentColor.opacity(0.18)
        case "rest":      return .secondary.opacity(0.1)
        default:          return .secondary.opacity(0.06)
        }
    }
}

// MARK: - Entry View dispatcher

struct TrainQWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: TrainQEntry

    var body: some View {
        switch family {
        case .systemSmall:  SmallWidgetView(entry: entry)
        case .systemMedium: MediumWidgetView(entry: entry)
        case .systemLarge:  LargeWidgetView(entry: entry)
        default:            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Widget definition

struct TrainQWidget: Widget {
    let kind: String = "TrainQWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TrainQProvider()) { entry in
            TrainQWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("TrainQ")
        .description("Heutiges Workout, Wochenfortschritt und Streak – alles auf einen Blick.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall)  { TrainQWidget() } timeline: {
    TrainQEntry(date: .now, data: .placeholder)
}
#Preview("Medium", as: .systemMedium) { TrainQWidget() } timeline: {
    TrainQEntry(date: .now, data: .placeholder)
}
#Preview("Large", as: .systemLarge)  { TrainQWidget() } timeline: {
    TrainQEntry(date: .now, data: .placeholder)
}
