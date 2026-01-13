import ActivityKit
import Foundation

struct TrainQWorkoutAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var badge: String
        var title: String
        var subtitle: String
        var primaryLine: String
        var avatarLetter: String
        var deepLink: String?
        var updatedAt: Int
    }

    var workoutId: String
}
