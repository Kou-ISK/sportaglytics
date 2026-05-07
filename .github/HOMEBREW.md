# Homebrew Cask Notes

SporTagLytics is distributed through a dedicated Homebrew tap:

```bash
brew tap Kou-ISK/tap
brew install --cask sportaglytics
```

The maintainer-facing source of truth is [docs/homebrew-distribution.md](../docs/homebrew-distribution.md). Release sequencing is documented in [RELEASE.md](RELEASE.md).

## Generated Cask Shape

The release workflow updates `Kou-ISK/homebrew-tap` and writes `Casks/sportaglytics.rb` with architecture-specific DMG assets.

```ruby
cask "sportaglytics" do
  version "<version>"
  sha256 arm:   "<arm64-sha256>",
         intel: "<x64-sha256>"

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
```

Do not hand-edit this file in the main repository as if it were the actual cask. The actual cask lives in `Kou-ISK/homebrew-tap`.

## Manual Verification

```bash
brew update
brew untap Kou-ISK/tap
brew tap Kou-ISK/tap
brew install --cask sportaglytics
brew uninstall --cask sportaglytics
```
