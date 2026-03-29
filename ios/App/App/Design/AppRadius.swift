// TrainQ Design Tokens — Corner Radius
// Mirrors src/design/tokens.ts → radius

import CoreGraphics

enum AppRadius {
    /// 24pt — standard cards, modals
    static let standard: CGFloat = 24
    /// 16pt — inputs, buttons, compact cards
    static let compact:  CGFloat = 16
    /// 32pt — sheet tops, large panels
    static let large:    CGFloat = 32
    /// 8pt — chips, tags
    static let chip:     CGFloat = 8
    /// 9999pt — pills, avatars, FABs
    static let full:     CGFloat = 9999
}
