import { upgrades } from 'hardhat';
import TokenConfig from '../config/TokenConfig';

async function main() {
  console.log('Transferring ownership of ProxyAdmin...');

  await upgrades.admin.transferProxyAdminOwnership(TokenConfig.multiSigAddress);
  console.log("Transferred ownership of ProxyAdmin to:", TokenConfig.multiSigAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
