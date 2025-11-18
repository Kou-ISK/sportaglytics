cask "sportaglytics" do
  version "0.1.0"
  sha256 arm:   "52bae084e8cd3f4e8dc4f7f50f5c7a9939783d8b1a21c79bfdb9f816a13ad2a8",
         intel: "52fa7b7d4e1b9160cfcef9bd102966a2c78c115f47c9a67801159c54c42fba1a"

  url "https://github.com/Kou-ISK/sportaglytics/releases/download/v#{version}/SporTagLytics-#{version}-#{Hardware::CPU.arch}.dmg",
      verified: "github.com/Kou-ISK/sportaglytics/"
  name "SporTagLytics"
  desc "Video tagging application for sports analysis"
  homepage "https://github.com/Kou-ISK/sportaglytics"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "SporTagLytics.app"

  zap trash: [
    "~/Library/Application Support/sportaglytics",
    "~/Library/Preferences/com.kouisk.sportaglytics.plist",
    "~/Library/Saved Application State/com.kouisk.sportaglytics.savedState",
  ]
end
