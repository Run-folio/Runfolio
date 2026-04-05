import type { Messages } from "../types";

export const en: Messages = {
  footer: {
    about: "About",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    settings: "Settings",
    language: "Language",
    tagline: "Built on effort. Remembered forever."
  },
  settings: {
    title: "Settings",
    accountSection: "Account",
    email: "Email",
    name: "Name",
    stravaSection: "Strava",
    stravaConnected: "Strava is connected.",
    stravaNotConnected: "Strava is not connected. Connect to import activities and sync.",
    stravaConnect: "Connect Strava",
    reconnectStrava: "Reconnect Strava",
    disconnectStrava: "Disconnect Strava",
    disconnectStravaHint: "Removes your Strava tokens from Runfolio. Imported activities stay saved.",
    disconnectStravaConfirm:
      "Disconnect Strava? You can connect again later. Tokens are removed; saved activities remain in Runfolio.",
    signOut: "Sign out",
    languageSection: "Language",
    displaySection: "Display & accessibility",
    textSize: "Text size",
    textSizeDefault: "Default",
    textSizeLarge: "Large",
    reduceMotion: "Reduce motion",
    reduceMotionHint: "Limits decorative movement. Respects your system setting when off.",
    backToApp: "Back to Overview",
    saveNote: "Preferences are saved on this device.",
    openMyRaces: "My Races",
    profileSection: "Profile",
    preferencesSection: "Preferences",
    units: "Units",
    unitsKm: "Kilometres",
    unitsMiles: "Miles",
    connectedSection: "Connected accounts",
    dangerSection: "Danger zone",
    deleteAccount: "Delete account",
    deleteAccountHint: "Permanently remove your account and sign-in. This can’t be undone.",
    deleteAccountConfirm:
      "Delete your Runfolio account permanently? You will lose access and stored data tied to this login.",
    deleteAccountUnavailable: "Account deletion isn’t available.",
    deleteAccountFailed: "Could not delete account."
  },
  language: {
    en: "English",
    fr: "Français",
    es: "Español"
  }
};
