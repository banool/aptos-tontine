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
  mainnet: {address: "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e", name: "tontine01"},
  testnet: {address: "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e", name: "tontine01"},
  devnet: {address: "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e", name: "tontine01"},
  local: {address: "0x81e2e2499407693c81fe65c86405ca70df529438339d9da7a6fc2520142b591e", name: "tontine01"},
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
