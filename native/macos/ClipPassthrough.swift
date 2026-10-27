import Foundation
import AVFoundation
import CoreMedia

// A Main-owned development helper. It is not packaged or enabled in normal launches.
private struct Request: Decodable {
    let version: Int
    let source: String
    let output: String
    let audioTrack: Int
    let start: Double
    let duration: Double
}
private struct ExportError: Error { let reason: String }
private func require(_ value: Bool, _ reason: String) throws {
    if !value { throw ExportError(reason: reason) }
}
private func subtype(_ track: AVAssetTrack) async throws -> FourCharCode {
    let formats = try await track.load(.formatDescriptions)
    try require(formats.count == 1, "changing-format")
    return CMFormatDescriptionGetMediaSubType(formats[0])
}
private func frameBoundary(_ track: AVAssetTrack, _ time: CMTime) -> Bool {
    guard let cursor = track.makeSampleCursor(presentationTimeStamp: time) else { return false }
    return abs(CMTimeSubtract(cursor.presentationTimeStamp, time).seconds) <= 1 / 120000000
}
@main private struct ClipPassthrough {
    static func main() async {
        do {
            try require(CommandLine.arguments.count == 2, "request-required")
            let requestURL = URL(fileURLWithPath: CommandLine.arguments[1])
            let data = try Data(contentsOf: requestURL)
            try require(data.count <= 64 * 1024, "request-bound")
            let request = try JSONDecoder().decode(Request.self, from: data)
            try require(request.version == 1 && request.start.isFinite && request.start >= 0 && request.duration.isFinite && request.duration > 0 && request.duration <= 7200 && request.audioTrack >= 0 && request.audioTrack <= 63, "unsupported-request")
            let output = URL(fileURLWithPath: request.output)
            try require(!FileManager.default.fileExists(atPath: output.path), "output-exists")
            let asset = AVURLAsset(url: URL(fileURLWithPath: request.source), options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
            let videos = try await asset.loadTracks(withMediaType: .video)
            let audios = try await asset.loadTracks(withMediaType: .audio)
            try require(videos.count == 1 && request.audioTrack < audios.count, "unsupported-tracks")
            let video = videos[0], audio = audios[request.audioTrack]
            try require(try await subtype(video) == kCMVideoCodecType_H264, "unsupported-video")
            try require(try await subtype(audio) == kAudioFormatMPEG4AAC, "unsupported-audio")
            let range = CMTimeRange(start: try exportTime(request.start), duration: try exportTime(request.duration))
            let sourceDuration = try await asset.load(.duration)
            let videoRange = try await video.load(.timeRange), audioRange = try await audio.load(.timeRange)
            try require(CMTimeRangeContainsTimeRange(videoRange, otherRange: range) && CMTimeRangeContainsTimeRange(audioRange, otherRange: range), "source-range")
            try require(frameBoundary(video, range.start) && (frameBoundary(video, range.end) || CMTimeCompare(range.end, sourceDuration) == 0), "non-frame-boundary")
            let composition = AVMutableComposition()
            guard let v = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid), let a = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else { throw ExportError(reason: "composition") }
            v.naturalTimeScale = try await video.load(.naturalTimeScale)
            a.naturalTimeScale = try await audio.load(.naturalTimeScale)
            v.preferredTransform = try await video.load(.preferredTransform)
            try v.insertTimeRange(range, of: video, at: .zero)
            try a.insertTimeRange(range, of: audio, at: .zero)
            guard let session = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else { throw ExportError(reason: "session") }
            // supportedFileTypes alone only describes the preset, not asset compatibility.
            let types = await session.compatibleFileTypes
            try require(types.contains(.mp4), "incompatible-mp4")
            session.timeRange = CMTimeRange(start: .zero, duration: range.duration)
            if #available(macOS 15.0, *) {
                try await session.export(to: output, as: .mp4)
            } else {
                session.outputURL = output
                session.outputFileType = .mp4
                await session.export()
                try require(session.status == .completed, "export-incomplete")
            }
            let result = AVURLAsset(url: output)
            let duration = try await result.load(.duration)
            try require(abs(duration.seconds - request.duration) <= 1 / 120000, "duration-mismatch")
            // Completion is not admission. The Main adapter must qualify before publication.
            let receipt: [String: Any] = ["version": 1, "status": "completed", "duration": duration.seconds, "audioTrack": request.audioTrack]
            FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: receipt))
            FileHandle.standardOutput.write(Data("\n".utf8))
        } catch {
            FileHandle.standardError.write(Data("Native export failed: \(error)\n".utf8))
            exit(1)
        }
    }
}
