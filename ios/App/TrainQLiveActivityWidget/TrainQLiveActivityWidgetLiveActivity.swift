import ActivityKit
import WidgetKit
import SwiftUI

struct TrainQAttributes: ActivityAttributes {
    // KEINE statischen Variablen mehr hier! Das verhindert den Fehler.
    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var setInfo: String
        var progressValue: Double
    }
}

@main
struct TrainQWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrainQAttributes.self) { context in
            // --- LOCK SCREEN ---
            HStack {
                ZStack {
                    Circle().stroke(Color.gray.opacity(0.3), lineWidth: 4)
                    Circle()
                        .trim(from: 0, to: context.state.progressValue)
                        .stroke(Color.blue, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    Image(systemName: "dumbbell.fill").font(.caption).foregroundColor(.white)
                }
                .frame(width: 45, height: 45)

                VStack(alignment: .leading) {
                    Text(context.state.exerciseName).font(.headline).foregroundColor(.white)
                    Text(context.state.setInfo).font(.caption).foregroundColor(.gray)
                }
                Spacer()
            }
            .padding()
            .activityBackgroundTint(Color.black.opacity(0.8))

        } dynamicIsland: { context in
            // --- DYNAMIC ISLAND ---
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                     Image(systemName: "dumbbell.fill").foregroundColor(.blue)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(Int(context.state.progressValue * 100))%")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.exerciseName)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.setInfo)
                }
            } compactLeading: {
                Image(systemName: "dumbbell.fill").foregroundColor(.blue)
            } compactTrailing: {
                Text("\(Int(context.state.progressValue * 100))%")
            } minimal: {
                Image(systemName: "dumbbell.fill").foregroundColor(.blue)
            }
        }
    }
}
