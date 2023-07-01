import NetworkConfigInterface from '../lib/NetworkConfigInterface';

export default interface TokenConfigInterface {
  testnet: NetworkConfigInterface;
  mainnet: NetworkConfigInterface;
  contractName: string;
  weth: string;
  tbcc: string;
  tbccFinanceSwapRouter: string;
  operatorAddress: string;
  tbccBurnAddress: string;
  tbccBurnRate: string;
  tbccVaultAddress: string;
  contractAddress: string;
  proxyAdminAddress: string;
  multiSigAddress: string;
};
