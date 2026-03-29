// TrainQ Design Tokens — Master Reference
//
// This file re-exports all design token namespaces as a convenience.
// Import this file in any Swift/SwiftUI file to access the full token system.
//
// Token system mirrors: src/design/tokens.ts
//
// Usage:
//   Text("Hello").font(AppTypography.screenTitle)
//   .padding(AppSpacing.base)
//   .cornerRadius(AppRadius.standard)

// AppSpacing     → spacing values (4, 8, 12, 16, 20, 24, 32)
// AppTypography  → font definitions
// AppRadius      → corner radii (24, 16, 32, 8, full)
// ComponentSizes → heights, widths for UI components
// GlassSurface   → .glassSurface() view modifier

// MARK: - TrainQ Brand Colors

import SwiftUI

enum AppColors {
    static let accent       = Color(red: 0/255,  green: 122/255, blue: 255/255) // #007AFF
    static let accentDark   = Color(red: 10/255, green: 132/255, blue: 255/255) // #0A84FF
    static let success      = Color(red: 52/255, green: 199/255, blue: 89/255)  // #34C759
    static let danger       = Color(red: 255/255,green: 59/255,  blue: 48/255)  // #FF3B30

    // Progress ring colors (Live Activity)
    static let progressTrack = Color.white.opacity(0.2)
    static let progressFill  = accentDark

    // Text hierarchy (Live Activity / Widget — always on dark)
    static let textPrimary   = Color.white
    static let textSecondary = Color(white: 1.0, opacity: 0.6)
    static let textTertiary  = Color(white: 1.0, opacity: 0.4)
}
