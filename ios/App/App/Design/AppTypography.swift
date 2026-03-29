// TrainQ Design Tokens — Typography
// Mirrors src/design/tokens.ts → typography

import SwiftUI

enum AppTypography {
    // MARK: Display
    static var screenTitle:  Font { .system(size: 32, weight: .semibold, design: .default) }
    static var sectionTitle: Font { .system(size: 24, weight: .semibold, design: .default) }
    static var cardTitle:    Font { .system(size: 20, weight: .semibold, design: .default) }

    // MARK: Body
    static var primaryBody:   Font { .system(size: 17, weight: .medium,  design: .default) }
    static var body:          Font { .system(size: 16, weight: .regular, design: .default) }
    static var secondaryBody: Font { .system(size: 14, weight: .regular, design: .default) }

    // MARK: Utility
    static var caption:      Font { .system(size: 12, weight: .medium,   design: .default) }
    static var metricLarge:  Font { .system(size: 32, weight: .semibold, design: .default) }
    static var buttonLabel:  Font { .system(size: 16, weight: .semibold, design: .default) }
    static var tabLabel:     Font { .system(size: 11, weight: .medium,   design: .default) }
}

// MARK: - View Modifiers
extension View {
    func screenTitleStyle()  -> some View { self.font(AppTypography.screenTitle) }
    func sectionTitleStyle() -> some View { self.font(AppTypography.sectionTitle) }
    func cardTitleStyle()    -> some View { self.font(AppTypography.cardTitle) }
    func primaryBodyStyle()  -> some View { self.font(AppTypography.primaryBody) }
    func captionStyle()      -> some View { self.font(AppTypography.caption) }
    func metricLargeStyle()  -> some View { self.font(AppTypography.metricLarge) }
}
