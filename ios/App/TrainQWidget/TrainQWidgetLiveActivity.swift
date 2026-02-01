//
//  TrainQWidgetLiveActivity.swift
//  TrainQWidget
//
//  Created by Julius on 31.01.26.
//

import ActivityKit
import WidgetKit
import SwiftUI

struct TrainQWidgetAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        // Dynamic stateful properties about your activity go here!
        var emoji: String
    }

    // Fixed non-changing properties about your activity go here!
    var name: String
}

struct TrainQWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrainQWidgetAttributes.self) { context in
            // Lock screen/banner UI goes here
            VStack {
                Text("Hello \(context.state.emoji)")
            }
            .activityBackgroundTint(Color.cyan)
            .activitySystemActionForegroundColor(Color.black)

        } dynamicIsland: { context in
            DynamicIsland {
                // Expanded UI goes here.  Compose the expanded UI through
                // various regions, like leading/trailing/center/bottom
                DynamicIslandExpandedRegion(.leading) {
                    Text("Leading")
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("Trailing")
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Bottom \(context.state.emoji)")
                    // more content
                }
            } compactLeading: {
                Text("L")
            } compactTrailing: {
                Text("T \(context.state.emoji)")
            } minimal: {
                Text(context.state.emoji)
            }
            .widgetURL(URL(string: "http://www.apple.com"))
            .keylineTint(Color.red)
        }
    }
}

extension TrainQWidgetAttributes {
    fileprivate static var preview: TrainQWidgetAttributes {
        TrainQWidgetAttributes(name: "World")
    }
}

extension TrainQWidgetAttributes.ContentState {
    fileprivate static var smiley: TrainQWidgetAttributes.ContentState {
        TrainQWidgetAttributes.ContentState(emoji: "😀")
     }
     
     fileprivate static var starEyes: TrainQWidgetAttributes.ContentState {
         TrainQWidgetAttributes.ContentState(emoji: "🤩")
     }
}

#Preview("Notification", as: .content, using: TrainQWidgetAttributes.preview) {
   TrainQWidgetLiveActivity()
} contentStates: {
    TrainQWidgetAttributes.ContentState.smiley
    TrainQWidgetAttributes.ContentState.starEyes
}
