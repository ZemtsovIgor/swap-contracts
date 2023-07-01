import NetworkConfigInterface from '../lib/NetworkConfigInterface';

export default interface TokenConfigInterface {
  testnet: NetworkConfigInterface;
  mainnet: NetworkConfigInterface;
  contractName: string;
  factory: string;
  weth: string;
  contractAddress: string|null;
};
