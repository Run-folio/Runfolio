export type Locale = "en" | "fr" | "es";

/** Nested message tree — add keys here and in each locale file. */
export type MessageTree = {
  footer: {
    about: string;
    privacy: string;
    terms: string;
    contact: string;
    settings: string;
    language: string;
    tagline: string;
  };
  settings: {
    title: string;
    accountSection: string;
    email: string;
    name: string;
    stravaSection: string;
    stravaConnected: string;
    stravaNotConnected: string;
    stravaConnect: string;
    reconnectStrava: string;
    disconnectStrava: string;
    disconnectStravaHint: string;
    disconnectStravaConfirm: string;
    signOut: string;
    languageSection: string;
    displaySection: string;
    textSize: string;
    textSizeDefault: string;
    textSizeLarge: string;
    reduceMotion: string;
    reduceMotionHint: string;
    backToApp: string;
    saveNote: string;
    openMyRaces: string;
    profileSection: string;
    preferencesSection: string;
    units: string;
    unitsKm: string;
    unitsMiles: string;
    connectedSection: string;
    dangerSection: string;
    deleteAccount: string;
    deleteAccountHint: string;
    deleteAccountConfirm: string;
    deleteAccountUnavailable: string;
    deleteAccountFailed: string;
  };
  language: {
    en: string;
    fr: string;
    es: string;
  };
};

export type Messages = MessageTree;
