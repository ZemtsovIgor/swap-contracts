import TokenConfigInterface from '../lib/TokenConfigInterface';
import * as Networks from '../lib/Networks';

const TokenConfig: TokenConfigInterface = {
  testnet: Networks.bscTestnet,
  mainnet: Networks.bscMainnet,
  contractName: 'TBCCFinanceRouter',
  factory: '0x864741961F7e895A48aBf3e90e2EB9caD0E58EAC',
  weth: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
  contractAddress: '0xe24b39bAFD326B012D6139C38905A8D6eF3a4662'
};

export default TokenConfig;
