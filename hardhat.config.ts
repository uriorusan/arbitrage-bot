import { HardhatUserConfig, SolidityUserConfig } from "hardhat/types";
import '@typechain/hardhat';
import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-chai-matchers';
import { config as dotEnvConfig } from 'dotenv';

dotEnvConfig();

const solidityConfig: SolidityUserConfig = {
  compilers: [
    {
      version: "0.8.20",
    },
    {
      version: "0.8.10",
    },
    {
      version: "0.6.12",
    },
    {
      version: "0.7.6",
    },
    {
      version: "0.6.6",
    }
  ]
};

const config: HardhatUserConfig = {
  solidity: solidityConfig,
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6"
  },
};

export default config;
