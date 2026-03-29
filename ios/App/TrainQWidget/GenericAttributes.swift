import ActivityKit
import Foundation

public struct GenericAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var values: [String: String]
        public init(values: [String: String]) { self.values = values }
    }

    public var id: String
    public var staticValues: [String: String]

    public init(id: String, staticValues: [String: String]) {
        self.id = id
        self.staticValues = staticValues
    }
}
