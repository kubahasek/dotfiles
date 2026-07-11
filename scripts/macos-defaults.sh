#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$REPO_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_DIR/.env"
  set +a
fi
: "${MAC_LOGINWINDOW_TEXT:?Set MAC_LOGINWINDOW_TEXT in .env; see ENV.md}"

# ------- Xcode -------
echo "Installing xcode-stuff 👨‍💻"
xcode-select --install
# ------- Xcode -------

# # ------- Install things from the App Store -------
# echo "Install things from the App Store e. g. Final Cut"
# open /System/Applications/App\ Store.app
# read -p "Press [Enter] key after you are done... ⌨️"
# # ------- Install things from the App Store -------

# ------- Homebrew -------
# Check for Homebrew,
# Install if we don't have it
if test ! $(which brew); then
  echo "Installing homebrew... 🍺"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Update homebrew recipes
echo "Updating homebrew... 🆕"
brew update

# echo "Installing stuff from Brewfile"
# brew bundle install --file=~/.dotfiles/Brewfile
# ------- Homebrew -------

# ------- Terminal Setup -------

# #Install Zsh & Oh My Zsh
# echo "Installing Oh My ZSH... 😱"
# curl -L http://install.ohmyz.sh | sh

# echo "Setting ZSH as shell... 💻"
# chsh -s /usr/local/bin/zshd

# ------- Terminal Setup -------

# ------- Mac Settings -------
echo "Setting some Mac settings... ⚙️"

#"Automatically quit printer app once the print jobs complete 🖨"
defaults write com.apple.print.PrintingPrefs "Quit When Finished" -bool true

# Check for software updates Daily
defaults write com.apple.SoftwareUpdate ScheduleFrequency -int 1

# Increasing audio quality for bluet tooth
defaults write com.apple.BluetoothAudioAgent "Apple Bitpool Min (editable)" -int 45

# Show filename extensions by default
defaults write NSGlobalDomain AppleShowAllExtensions -bool true

#"Showing icons for hard drives, servers, and removable media on the desktop ℹ️"
defaults write com.apple.finder ShowExternalHardDrivesOnDesktop -bool true

# Enable tap-to-click
defaults write com.apple.driver.AppleBluetoothMultitouch.trackpad Clicking -bool true
defaults -currentHost write NSGlobalDomain com.apple.mouse.tapBehavior -int 1

# show path bar and status bar in finder as default
defaults write com.apple.finder _FXShowPosixPathInTitle -bool true
defaults write com.apple.finder ShowStatusBar -bool true

# disable auto-correct
defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false

# set trackpad & mouse speet to a reasonable numbers
defaults write -g com.apple.trackpad.scaling 2
defaults write -g com.apple.mouse.scaling 2.5

# Use column view in all Finder windows by default
defaults write com.apple.finder FXPreferredViewStyle Clmv

# disable emoji replacement in message's
defaults write com.apple.messageshelper.MessageController SOInputLineSettings -dict-add "automaticEmojiSubstitutionEnablediMessage" -bool false

# disable writing .DS_store files to network drives
defaults write com.apple.desktopservices DSDontWriteNetworkStores -bool true

# Add a message to the lock screen
defaults write /Library/Preferences/com.apple.loginwindow LoginwindowText "$MAC_LOGINWINDOW_TEXT"

#"Setting screenshot format to PNG 📸"
defaults write com.apple.screencapture type -string "png"

# Disable "natural" scroll
defaults write NSGlobalDomain com.apple.swipescrolldirection -bool false

# ------- Mac Settings -------

killall Finder

echo "Done! 🥳"
