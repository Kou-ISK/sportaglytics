import CoreMedia

@main struct ExportTimeTests {
    static func main() throws {
        let start = 864003140.0 / 120000
        let end = (864003140.0 + 360360) / 120000
        let duration = try exportTime(end - start)
        let exact = try exportTime(3.003)
        precondition(CMTimeCompare(duration, exact) == 0)
        let sum = CMTimeAdd(try exportTime(start), duration)
        let expectedEnd = try exportTime(end)
        precondition(CMTimeCompare(sum, expectedEnd) == 0)
        for invalid in [Double.nan, Double.infinity, -1, Double.greatestFiniteMagnitude] {
            do { _ = try exportTime(invalid); fatalError("invalid time accepted") }
            catch is ExportTimeError { }
        }
        print("Native export rational clock: subtraction noise and invalid ranges passed")
    }
}
