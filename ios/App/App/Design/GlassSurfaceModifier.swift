// TrainQ Design Tokens — Glass Surface Modifier
// Provides reusable glass effects for native surfaces (widgets, live activities, scanner overlay).

import SwiftUI

// MARK: - Glass Level

enum GlassLevel {
    /// Navbar, tab bar, floating buttons, modals
    case strong
    /// Sheets, overlays, quick actions
    case moderate
    /// Secondary cards, filters, segmented controls
    case subtle
}

// MARK: - Glass Surface Modifier

struct GlassSurface: ViewModifier {
    let level: GlassLevel
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(glassBackground)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(borderColor, lineWidth: 0.5)
            )
    }

    @ViewBuilder
    private var glassBackground: some View {
        switch level {
        case .strong:
            Rectangle()
                .fill(.ultraThinMaterial)
                .opacity(0.9)
        case .moderate:
            Rectangle()
                .fill(.thinMaterial)
                .opacity(0.85)
        case .subtle:
            Rectangle()
                .fill(.regularMaterial)
                .opacity(0.6)
        }
    }

    private var borderColor: Color {
        switch level {
        case .strong:   return Color.white.opacity(0.15)
        case .moderate: return Color.white.opacity(0.10)
        case .subtle:   return Color.white.opacity(0.08)
        }
    }
}

// MARK: - View Extension

extension View {
    /// Apply a glass surface with the specified level and radius.
    func glassSurface(
        _ level: GlassLevel = .moderate,
        radius: CGFloat = 24 // AppRadius.standard
    ) -> some View {
        modifier(GlassSurface(level: level, cornerRadius: radius))
    }

    /// Card preset — solid background, standard radius
    func cardSurface() -> some View {
        self
            .background(Color.secondary.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous)) // AppRadius.standard
    }
}

// MARK: - Live Activity Background

extension View {
    /// Lock Screen Live Activity background — dark glass
    func liveActivityBackground() -> some View {
        self
            .background(.black.opacity(0.75))
            .background(.ultraThinMaterial)
    }
}
