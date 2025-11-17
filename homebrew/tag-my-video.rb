cask "tag-my-video" do
  version "0.1.0"
  sha256 arm:   "0000000000000000000000000000000000000000000000000000000000000000",
         intel: "0000000000000000000000000000000000000000000000000000000000000000"

  url "https://github.com/Kou-ISK/tag-my-video/releases/download/v#{version}/Tag My Video-#{version}-#{Hardware::CPU.arch}.zip",
      verified: "github.com/Kou-ISK/tag-my-video/"
  name "Tag My Video"
  desc "Video tagging application for sports analysis"
  homepage "https://github.com/Kou-ISK/tag-my-video"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Tag My Video.app"

  zap trash: [
    "~/Library/Application Support/tag-my-video",
    "~/Library/Preferences/com.kouisk.tagmyvideo.plist",
    "~/Library/Saved Application State/com.kouisk.tagmyvideo.savedState",
  ]
end
