import SwiftUI
import WidgetKit

private let widgetKind = "CommuteLiveWidget"
private let widgetAppGroupId = "group.com.commutelive.app"
private let widgetSnapshotDefaultsKey = "commutelive.widgetSnapshot"
private let onTimeColorHex = "#34D399"
private let dueColorHex = "#EF4444"

private struct WidgetSnapshotSlot: Decodable, Identifiable {
  let id: String
  let color: String
  let textColor: String
  let routeLabel: String
  let badgeShape: String?
  let stopName: String
  let subLine: String?
  let subLineColor: String?
  let times: String
  let timesColor: String?
  let etaMinutes: Int?

  func withAdjustedEta(_ offset: Int) -> WidgetSnapshotSlot {
    guard let etaMinutes else { return self }
    let remaining = max(0, etaMinutes - offset)
    return WidgetSnapshotSlot(
      id: id,
      color: color,
      textColor: textColor,
      routeLabel: routeLabel,
      badgeShape: badgeShape,
      stopName: stopName,
      subLine: subLine,
      subLineColor: subLineColor,
      times: remaining == 0 ? "DUE" : "\(remaining)m",
      timesColor: remaining == 0 ? dueColorHex : (timesColor ?? onTimeColorHex),
      etaMinutes: remaining
    )
  }
}

private struct WidgetSnapshotPayload: Decodable {
  let status: String
  let updatedAt: String
  let city: String?
  let displayId: String?
  let displayName: String
  let brightness: Int
  let slots: [WidgetSnapshotSlot]

  static let placeholder = WidgetSnapshotPayload(
    status: "ready",
    updatedAt: ISO8601DateFormatter().string(from: Date()),
    city: "new-york",
    displayId: "sample",
    displayName: "Morning Commute",
    brightness: 60,
    slots: [
      WidgetSnapshotSlot(
        id: "1",
        color: "#EE352E",
        textColor: "#FFFFFF",
        routeLabel: "1",
        badgeShape: "circle",
        stopName: "Times Sq-42 St",
        subLine: nil,
        subLineColor: nil,
        times: "3m",
        timesColor: onTimeColorHex,
        etaMinutes: 3
      ),
      WidgetSnapshotSlot(
        id: "2",
        color: "#0039A6",
        textColor: "#FFFFFF",
        routeLabel: "M15",
        badgeShape: "pill",
        stopName: "2 Av / E 34 St",
        subLine: "Downtown",
        subLineColor: nil,
        times: "7m",
        timesColor: onTimeColorHex,
        etaMinutes: 7
      ),
    ]
  )

  static let empty = WidgetSnapshotPayload(
    status: "empty",
    updatedAt: ISO8601DateFormatter().string(from: Date()),
    city: nil,
    displayId: nil,
    displayName: "CommuteLive",
    brightness: 60,
    slots: []
  )

  func applyingElapsedMinutes(from now: Date = Date()) -> WidgetSnapshotPayload {
    guard let updatedAtDate = ISO8601DateFormatter().date(from: updatedAt) else {
      return self
    }

    let elapsedSeconds = max(0, now.timeIntervalSince(updatedAtDate))
    let elapsedMinutes = Int(elapsedSeconds / 60.0)
    guard elapsedMinutes > 0 else { return self }

    return WidgetSnapshotPayload(
      status: status,
      updatedAt: updatedAt,
      city: city,
      displayId: displayId,
      displayName: displayName,
      brightness: brightness,
      slots: slots.map { $0.withAdjustedEta(elapsedMinutes) }
    )
  }

  func withTimelineOffset(_ offset: Int) -> WidgetSnapshotPayload {
    WidgetSnapshotPayload(
      status: status,
      updatedAt: updatedAt,
      city: city,
      displayId: displayId,
      displayName: displayName,
      brightness: brightness,
      slots: slots.map { $0.withAdjustedEta(offset) }
    )
  }
}

private struct CommuteLiveWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshotPayload
}

private struct CommuteLiveWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> CommuteLiveWidgetEntry {
    CommuteLiveWidgetEntry(date: Date(), snapshot: .placeholder)
  }

  func getSnapshot(in context: Context, completion: @escaping (CommuteLiveWidgetEntry) -> Void) {
    completion(CommuteLiveWidgetEntry(date: Date(), snapshot: loadSnapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<CommuteLiveWidgetEntry>) -> Void) {
    let now = Date()
    let snapshot = loadSnapshot().applyingElapsedMinutes(from: now)
    let hasCountdowns = snapshot.slots.contains { $0.etaMinutes != nil }
    let maxOffsets = hasCountdowns ? 30 : 0

    let entries = (0...maxOffsets).compactMap { offset -> CommuteLiveWidgetEntry? in
      guard let entryDate = Calendar.current.date(byAdding: .minute, value: offset, to: now) else {
        return nil
      }
      return CommuteLiveWidgetEntry(date: entryDate, snapshot: snapshot.withTimelineOffset(offset))
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: maxOffsets == 0 ? 15 : maxOffsets + 1, to: now) ?? now
    completion(Timeline(entries: entries, policy: .after(refreshDate)))
  }

  private func loadSnapshot() -> WidgetSnapshotPayload {
    guard
      let defaults = UserDefaults(suiteName: widgetAppGroupId),
      let json = defaults.string(forKey: widgetSnapshotDefaultsKey),
      let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(WidgetSnapshotPayload.self, from: data)
    else {
      return .empty
    }

    return snapshot
  }
}

private struct CommuteLiveWidgetView: View {
  @Environment(\.widgetFamily) private var family

  let entry: CommuteLiveWidgetEntry

  private var slotLimit: Int {
    switch family {
    case .systemSmall:
      return 1
    default:
      return 2
    }
  }

  private var visibleSlots: [WidgetSnapshotSlot] {
    Array(entry.snapshot.slots.prefix(slotLimit))
  }

  private var brightnessOverlayOpacity: Double {
    let brightness = min(max(entry.snapshot.brightness, 0), 100)
    return Double(100 - brightness) / 100.0 * 0.65
  }

  var body: some View {
    ZStack {
      widgetShell

      if entry.snapshot.status == "ready", !visibleSlots.isEmpty {
        ledCard
      } else {
        emptyState
      }
    }
    .widgetURL(URL(string: "commutelive://dashboard"))
  }

  private var widgetShell: some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(hex: "#06090D"),
          Color(hex: "#0B121A"),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )

      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .fill(Color(hex: "#5CE1E6").opacity(0.14))
        .blur(radius: 32)
        .padding(.horizontal, family == .systemSmall ? 18 : 24)
        .padding(.vertical, family == .systemSmall ? 22 : 18)

      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .fill(Color(hex: "#5CE1E6").opacity(0.1))
        .blur(radius: 18)
        .padding(.horizontal, family == .systemSmall ? 26 : 34)
        .padding(.vertical, family == .systemSmall ? 30 : 26)
    }
    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
  }

  private var ledCard: some View {
    VStack(alignment: .leading, spacing: family == .systemSmall ? 8 : 10) {
      ForEach(visibleSlots) { slot in
        HStack(spacing: family == .systemSmall ? 8 : 10) {
          RouteBadge(slot: slot, family: family)

          VStack(alignment: .leading, spacing: 2) {
            if !slot.stopName.isEmpty {
              Text(slot.stopName)
                .font(.system(size: family == .systemSmall ? 12 : 13, weight: .heavy, design: .rounded))
                .foregroundStyle(Color(hex: "#EAF6FF"))
                .lineLimit(1)
            }

            if let subLine = slot.subLine, !subLine.isEmpty {
              Text(subLine)
                .font(.system(size: family == .systemSmall ? 9 : 10, weight: .semibold, design: .rounded))
                .foregroundStyle(Color(hex: slot.subLineColor ?? "#AEBBC8"))
                .lineLimit(1)
            }
          }

          Spacer(minLength: 6)

          Text(slot.times)
            .font(.system(size: family == .systemSmall ? 12 : 13, weight: .black, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(Color(hex: slot.timesColor ?? "#DCE7F0"))
            .lineLimit(1)
        }
        .padding(.horizontal, family == .systemSmall ? 10 : 12)
        .padding(.vertical, family == .systemSmall ? 7 : 8)
        .frame(maxWidth: .infinity)
        .background(
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color(hex: "#0D131A"))
        )
      }

      Spacer(minLength: 0)

      HStack {
        Text(entry.snapshot.displayName.uppercased())
          .font(.system(size: 9, weight: .bold, design: .rounded))
          .tracking(0.8)
          .foregroundStyle(Color.white.opacity(0.46))
          .lineLimit(1)

        Spacer(minLength: 8)

        Text(relativeUpdatedText(entry.snapshot.updatedAt))
          .font(.system(size: 9, weight: .semibold, design: .rounded))
          .foregroundStyle(Color.white.opacity(0.36))
          .lineLimit(1)
      }
      .padding(.top, 2)
    }
    .padding(family == .systemSmall ? 12 : 14)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(Color(hex: "#04070A"))
    )
    .overlay {
      RoundedRectangle(cornerRadius: 18, style: .continuous)
        .fill(Color.black.opacity(brightnessOverlayOpacity))
    }
    .padding(family == .systemSmall ? 10 : 12)
  }

  private var emptyState: some View {
    VStack(alignment: .leading, spacing: 8) {
      Spacer(minLength: 0)

      Text(emptyTitle)
        .font(.system(size: family == .systemSmall ? 16 : 18, weight: .black, design: .rounded))
        .foregroundStyle(Color(hex: "#EAF6FF"))
        .lineLimit(2)

      Text(emptyMessage)
        .font(.system(size: family == .systemSmall ? 11 : 12, weight: .medium, design: .rounded))
        .foregroundStyle(Color.white.opacity(0.68))
        .lineLimit(3)

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .padding(18)
  }

  private var emptyTitle: String {
    entry.snapshot.status == "signed-out" ? "Sign In Required" : "No Live Display"
  }

  private var emptyMessage: String {
    entry.snapshot.status == "signed-out"
      ? "Open CommuteLive and sign in to start syncing your device preview."
      : "Open CommuteLive and choose a display for this city to populate the widget."
  }

  private func relativeUpdatedText(_ updatedAt: String) -> String {
    guard let date = ISO8601DateFormatter().date(from: updatedAt) else {
      return "Updated just now"
    }

    let formatter = RelativeDateTimeFormatter()
    formatter.unitsStyle = .short
    return "Updated \(formatter.localizedString(for: date, relativeTo: Date()))"
  }
}

private struct RouteBadge: View {
  let slot: WidgetSnapshotSlot
  let family: WidgetFamily

  var body: some View {
    Text(slot.routeLabel)
      .font(.system(size: family == .systemSmall ? 11 : 12, weight: .black, design: .rounded))
      .foregroundStyle(Color(hex: slot.textColor))
      .lineLimit(1)
      .minimumScaleFactor(0.7)
      .frame(
        width: badgeWidth,
        height: family == .systemSmall ? 28 : 30,
        alignment: .center
      )
      .background(badgeBackground)
  }

  private var badgeWidth: CGFloat {
    switch slot.badgeShape {
    case "pill":
      return family == .systemSmall ? 48 : 54
    case "rail":
      return family == .systemSmall ? 56 : 62
    default:
      return family == .systemSmall ? 28 : 30
    }
  }

  @ViewBuilder
  private var badgeBackground: some View {
    switch slot.badgeShape {
    case "pill":
      Capsule(style: .continuous)
        .fill(Color(hex: slot.color))
    case "rail":
      RoundedRectangle(cornerRadius: 9, style: .continuous)
        .fill(Color(hex: slot.color))
    default:
      Circle()
        .fill(Color(hex: slot.color))
    }
  }
}

private extension Color {
  init(hex: String) {
    let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    Scanner(string: cleaned).scanHexInt64(&int)

    let r, g, b, a: UInt64
    switch cleaned.count {
    case 8:
      (r, g, b, a) = ((int >> 24) & 0xff, (int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff)
    default:
      (r, g, b, a) = ((int >> 16) & 0xff, (int >> 8) & 0xff, int & 0xff, 0xff)
    }

    self.init(
      .sRGB,
      red: Double(r) / 255,
      green: Double(g) / 255,
      blue: Double(b) / 255,
      opacity: Double(a) / 255
    )
  }
}

struct CommuteLiveWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: widgetKind, provider: CommuteLiveWidgetProvider()) { entry in
      CommuteLiveWidgetView(entry: entry)
    }
    .configurationDisplayName("Current Display")
    .description("Shows the live CommuteLive display preview on your Home Screen.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
