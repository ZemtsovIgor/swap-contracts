import TokenConfig from './TokenConfig';

// Update the following array if you change the constructor arguments...
const ContractArguments = [] as const;

export const InitializeArguments = [
  TokenConfig.weth,
  TokenConfig.tbcc,
  TokenConfig.tbccFinanceSwapRouter,
  TokenConfig.operatorAddress,
  TokenConfig.tbccBurnAddress,
  TokenConfig.tbccVaultAddress,
  TokenConfig.tbccBurnRate,
  TokenConfig.multiSigAddress,
] as const;

export default ContractArguments;
