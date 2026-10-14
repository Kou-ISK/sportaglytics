import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid release version');
const reports = {};
for (const arch of ['arm64', 'x64']) {
  const report = JSON.parse(
    await readFile(`dist/mac-verification/final-${arch}.json`, 'utf8'),
  );
  if (
    report.version !== version ||
    report.arch !== arch ||
    !report.gatekeeperAccepted ||
    !report.notarized ||
    !report.stapled ||
    !/^[a-f0-9]{64}$/.test(report.dmgSha256)
  )
    throw Error('Invalid final DMG verification report');
  reports[arch] = report;
}
await mkdir('homebrew-tap/Casks', { recursive: true });
await writeFile(
  'homebrew-tap/Casks/sportaglytics.rb',
  `cask "sportaglytics" do
  arch arm: "arm64", intel: "x64"

  version "${version}"
  sha256 arm: "${reports.arm64.dmgSha256}",
         intel: "${reports.x64.dmgSha256}"

  url "https://github.com/Kou-ISK/sportaglytics/releases/download/v#{version}/SporTagLytics-#{version}-#{arch}.dmg",
      verified: "github.com/Kou-ISK/sportaglytics/"
  name "SporTagLytics"
  desc "Video tagging application for sports analysis"
  homepage "https://github.com/Kou-ISK/sportaglytics"

  livecheck do
    url :url
    strategy :github_releases do |json|
      json.filter_map do |release|
        next if release["draft"] || release["prerelease"]
        version = release["tag_name"]&.match(/^v(\\d+\\.\\d+\\.\\d+)$/)&.[](1)
        next unless version
        names = release.fetch("assets", []).map { |asset| asset["name"] }
        version if %w[arm64 x64].all? { |arch| names.include?("SporTagLytics-#{version}-#{arch}.dmg") }
      end
    end
  end

  app "SporTagLytics.app"

  zap trash: [
    "~/Library/Application Support/sportaglytics",
    "~/Library/Preferences/com.kouisk.sportaglytics.plist",
    "~/Library/Saved Application State/com.kouisk.sportaglytics.savedState",
  ]
end
`,
);
