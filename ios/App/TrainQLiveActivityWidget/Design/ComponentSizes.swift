// TrainQ Design Tokens — Component Sizes
// Mirrors src/design/tokens.ts → componentSizes

import CoreGraphics

enum ComponentSizes {
    // MARK: Buttons & Inputs
    static let primaryButton:    CGFloat = 52
    static let secondaryButton:  CGFloat = 44
    static let input:            CGFloat = 52
    static let segmentedControl: CGFloat = 40
    static let chip:             CGFloat = 32
    static let fab:              CGFloat = 56

    // MARK: Navigation
    static let tabBarHeight: CGFloat = 84 // includes 34pt safe area
    static let navBarHeight: CGFloat = 52

    // MARK: Icons
    static let iconSmall:  CGFloat = 20
    static let iconMedium: CGFloat = 24
    static let iconLarge:  CGFloat = 32

    // MARK: List Rows
    static let settingsRowHeight: CGFloat = 56
    static let listRowHeight:     CGFloat = 56
}
