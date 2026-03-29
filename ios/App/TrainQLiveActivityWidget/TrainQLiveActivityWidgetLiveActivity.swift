import ActivityKit
import WidgetKit
import SwiftUI

struct TrainQAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var exerciseName: String
        var setInfo: String
        var progressValue: Double
    }
}

// MARK: - Live Activity Widget

@main
struct TrainQWidgetLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TrainQAttributes.self) { context in

            // MARK: Lock Screen Banner
            HStack(spacing: AppSpacing.md) {
                ProgressRingView(progress: context.state.progressValue)
                    .frame(width: 44, height: 44)

                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(context.state.exerciseName)
                        .font(AppTypography.primaryBody)
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)

                    Text(context.state.setInfo)
                        .font(AppTypography.caption)
                        .foregroundColor(AppColors.textSecondary)
                }

                Spacer()

                Text("\(Int(context.state.progressValue * 100))%")
                    .font(AppTypography.caption)
                    .foregroundColor(AppColors.textSecondary)
                    .monospacedDigit()
            }
            .padding(.horizontal, AppSpacing.base)
            .padding(.vertical, AppSpacing.sm)
            .activityBackgroundTint(Color.black.opacity(0.75))

        } dynamicIsland: { context in

            DynamicIsland {
                // MARK: Expanded
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: AppSpacing.xs) {
                        Image(systemName: "dumbbell.fill")
                            .font(.system(size: ComponentSizes.iconSmall))
                            .foregroundColor(AppColors.accentDark)
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(Int(context.state.progressValue * 100))%")
                        .font(AppTypography.caption)
                        .foregroundColor(AppColors.textSecondary)
                        .monospacedDigit()
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.exerciseName)
                        .font(AppTypography.primaryBody)
                        .foregroundColor(AppColors.textPrimary)
                        .lineLimit(1)
                }

                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: AppSpacing.sm) {
                        ProgressRingView(progress: context.state.progressValue)
                            .frame(width: 20, height: 20)

                        Text(context.state.setInfo)
                            .font(AppTypography.secondaryBody)
                            .foregroundColor(AppColors.textSecondary)
                    }
                }

            } compactLeading: {
                Image(systemName: "dumbbell.fill")
                    .font(.system(size: 12))
                    .foregroundColor(AppColors.accentDark)

            } compactTrailing: {
                Text("\(Int(context.state.progressValue * 100))%")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppColors.textPrimary)
                    .monospacedDigit()

            } minimal: {
                ProgressRingView(progress: context.state.progressValue)
                    .frame(width: 18, height: 18)
            }
        }
    }
}

// MARK: - Progress Ring Component

private struct ProgressRingView: View {
    let progress: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(AppColors.progressTrack, lineWidth: 3)

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AppColors.progressFill,
                    style: StrokeStyle(lineWidth: 3, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.4), value: progress)

            Image(systemName: "dumbbell.fill")
                .font(.system(size: 10, weight: .semibold))
                .foregroundColor(AppColors.textPrimary)
        }
    }
}
