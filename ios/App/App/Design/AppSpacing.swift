// TrainQ Design Tokens — Spacing
// Mirrors src/design/tokens.ts → spacing
// Add this file to all targets that need spacing tokens (App, widgets).

import Foundation

enum AppSpacing {
    /// 4pt — micro gaps, icon-to-label
    static let xs:   CGFloat = 4
    /// 8pt — label-to-value, tight stacks
    static let sm:   CGFloat = 8
    /// 12pt — inner card gaps
    static let md:   CGFloat = 12
    /// 16pt — card internal padding, between items
    static let base: CGFloat = 16
    /// 20pt — screen horizontal padding, premium card padding
    static let lg:   CGFloat = 20
    /// 24pt — between sections
    static let xl:   CGFloat = 24
    /// 32pt — between major layout regions
    static let xxl:  CGFloat = 32

    // MARK: Layout
    /// Horizontal screen padding (all screens)
    static let screenPaddingX: CGFloat = lg
    /// Gap between cards within a section
    static let cardGap: CGFloat = base
    /// Gap between sections
    static let sectionGap: CGFloat = xl
}
