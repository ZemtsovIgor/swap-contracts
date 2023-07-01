import TokenConfig from './TokenConfig';

// Update the following array if you change the constructor arguments...
const ContractArguments = [
  TokenConfig.factory,
  TokenConfig.weth
] as const;

export default ContractArguments;
