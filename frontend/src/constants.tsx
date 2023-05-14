/**
 * Network
 */
export const networks = {
  mainnet: "https://fullnode.mainnet.aptoslabs.com/",
  testnet: "https://fullnode.testnet.aptoslabs.com",
  devnet: "https://fullnode.devnet.aptoslabs.com/",
  local: "http://localhost:8080",
};

export type NetworkName = keyof typeof networks;

export const moduleLocations = {
  mainnet: {
    address:
      "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e",
    name: "tontine02",
  },
  testnet: {
    address:
      "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e",
    name: "tontine02",
  },
  devnet: {
    address:
      "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e",
    name: "tontine02",
  },
  local: {
    address:
      "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e",
    name: "tontine02",
  },
};

// Remove trailing slashes
for (const key of Object.keys(networks)) {
  const networkName = key as NetworkName;
  if (networks[networkName].endsWith("/")) {
    networks[networkName] = networks[networkName].slice(0, -1);
  }
}

export const defaultNetworkName: NetworkName = "mainnet" as const;

if (!(defaultNetworkName in networks)) {
  throw `defaultNetworkName '${defaultNetworkName}' not in Networks!`;
}

export const defaultNetwork = networks[defaultNetworkName];

/**
 * Feature
 */
export const features = {
  prod: "Production Mode",
  dev: "Development Mode",
};

export type FeatureName = keyof typeof features;

// Remove trailing slashes
for (const key of Object.keys(features)) {
  const featureName = key as FeatureName;
  if (features[featureName].endsWith("/")) {
    features[featureName] = features[featureName].slice(0, -1);
  }
}

export const defaultFeatureName: FeatureName = "prod" as const;

if (!(defaultFeatureName in features)) {
  throw `defaultFeatureName '${defaultFeatureName}' not in Features!`;
}

export const defaultFeature = features[defaultFeatureName];

export const MEMBER_STATUS_MUST_CONTRIBUTE_FUNDS: number = 128;
export const MEMBER_STATUS_MUST_RECONFIRM: number = 129;
export const MEMBER_STATUS_READY: number = 130;
export const MEMBER_STATUS_STILL_ELIGIBLE: number = 131;
export const MEMBER_STATUS_INELIGIBLE: number = 132;
export const MEMBER_STATUS_CAN_CLAIM_FUNDS: number = 133;
export const MEMBER_STATUS_CLAIMED_FUNDS: number = 134;
export const MEMBER_STATUS_NEVER_CLAIMED_FUNDS: number = 135;

export const OVERALL_STATUS_STAGING: number = 64;
export const OVERALL_STATUS_CANCELLED: number = 65;
export const OVERALL_STATUS_CAN_BE_LOCKED: number = 66;
export const OVERALL_STATUS_LOCKED: number = 67;
export const OVERALL_STATUS_FUNDS_CLAIMABLE: number = 68;
export const OVERALL_STATUS_FUNDS_CLAIMED: number = 69;
export const OVERALL_STATUS_FUNDS_NEVER_CLAIMED: number = 70;
export const OVERALL_STATUS_FALLBACK_EXECUTED: number = 71;
