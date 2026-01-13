import ActivityKit
import WidgetKit
import SwiftUI

@main
struct TrainQLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrainQWorkoutAttributes.self) { context in
            ZStack {
                Color.black.opacity(0.8)
                VStack(alignment: .leading, spacing: 8) {
                    Text("TrainQ Live Activity ✅")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text(context.state.primaryLine)
                        .font(.subheadline)
                        .foregroundColor(.white.opacity(0.85))
                }
                .padding(16)
            }
            .widgetURL(URL(string: context.state.deepLink ?? ""))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.badge.uppercased())
                        .font(.caption2)
                        .foregroundColor(.white)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.subtitle)
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.8))
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.primaryLine)
                        .font(.caption)
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
            } compactLeading: {
                Text(context.state.badge.uppercased())
                    .font(.caption2)
            } compactTrailing: {
                Text(shortSubtitle(context.state.subtitle))
                    .font(.caption2)
            } minimal: {
                Text(context.state.badge.prefix(1))
                    .font(.caption2)
            }
        }
    }
}

private func shortSubtitle(_ subtitle: String) -> String {
    let comps = subtitle.split(separator: " ")
    if comps.count >= 2 { return String(comps[1]) }
    return subtitle
}
