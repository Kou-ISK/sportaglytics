# Homebrew Cask for SporTagLytics

This directory contains the Homebrew Cask formula for installing SporTagLytics on macOS.

## For Users

To install SporTagLytics via Homebrew:

```bash
brew install --cask sportaglytics
```

## For Maintainers

### Creating a new release

1. Update version in `package.json`
2. Create and push a git tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
3. GitHub Actions will automatically build the DMG and create a release
4. Update the cask formula with new version and SHA256

### Cask Formula Template

After a release is created, submit to homebrew-cask or maintain in your own tap:

```ruby
cask "sportaglytics" do
  version "0.1.0"
  sha256 "YOUR_SHA256_HERE"

  url "https://github.com/Kou-ISK/sportaglytics/releases/download/v#{version}/SporTagLytics-#{version}.dmg"
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

### Getting SHA256

After GitHub Actions builds and releases the DMG:

```bash
curl -L https://github.com/Kou-ISK/sportaglytics/releases/download/v0.1.0/SporTagLytics-0.1.0.dmg | shasum -a 256
```

Or download the DMG and run:

```bash
shasum -a 256 SporTagLytics-0.1.0.dmg
```

### Creating Your Own Tap (Optional)

If you want to maintain your own Homebrew tap:

1. Create a repository named `homebrew-tap`
2. Add the cask formula to `Casks/sportaglytics.rb`
3. Users can then install with:
   ```bash
   brew tap Kou-ISK/tap
   brew install --cask sportaglytics
   ```

## Automated Updates

The workflow supports:

- **Tag-based releases**: Push a tag like `v0.1.0` to trigger a build
- **Manual dispatch**: Trigger builds manually from GitHub Actions UI
