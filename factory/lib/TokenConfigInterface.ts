import NetworkConfigInterface from '../lib/NetworkConfigInterface';

export default interface TokenConfigInterface {
  testnet: NetworkConfigInterface;
  mainnet: NetworkConfigInterface;
  contractName: string;
  feeToSetter: string;
  contractAddress: string|null;
};
