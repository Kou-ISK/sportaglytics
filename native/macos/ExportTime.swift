import CoreMedia

struct ExportTimeError: Error {}
/** Preserve the requested clock within half a tick; avoid truncating subtraction noise. */
func exportTime(_ seconds: Double) throws -> CMTime {
    let scale: CMTimeScale = 120000000
    let ticks = seconds * Double(scale)
    guard seconds.isFinite, seconds >= 0, ticks.isFinite, ticks < 9e18 else { throw ExportTimeError() }
    return CMTime(value: Int64(ticks.rounded()), timescale: scale)
}
