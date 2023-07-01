// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import '../lib/IWETH.sol';
import '../lib/ITBCCFinanceRouter.sol';
import '../lib/ITBCCFinancePair.sol';
import '../lib/ITBCCFinanceFactory.sol';
import '../lib/ITBCCDEFIAPES.sol';

contract TBCCFinanceFeeHandler is UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct RemoveLiquidityInfo {
        ITBCCFinancePair pair;
        uint amount;
        uint amountAMin;
        uint amountBMin;
    }

    struct SwapInfo {
        uint amountIn;
        uint amountOutMin;
        address[] path;
    }

    struct LPData {
        address lpAddress;
        address token0;
        uint256 token0Amt;
        address token1;
        uint256 token1Amt;
        uint256 userBalance;
        uint256 totalSupply;
    }

    event SwapFailure(uint amountIn, uint amountOutMin, address[] path);
    event RmoveLiquidityFailure(ITBCCFinancePair pair, uint amount, uint amountAMin, uint amountBMin);
    event NewTBCCFinanceSwapRouter(address indexed sender, address indexed router);
    event NewOperatorAddress(address indexed sender, address indexed operator);
    event NewTBCCBurnAddress(address indexed sender, address indexed burnAddress);
    event NewTBCCVaultAddress(address indexed sender, address indexed vaultAddress);
    event NewTBCCBurnRate(address indexed sender, uint tbccBurnRate);

    address public tbcc;
    ITBCCFinanceRouter public tbccFinanceSwapRouter;
    ITBCCDEFIAPES public tbccDefiApes;
    bool public claimingPause;
    address public operatorAddress; // address of the operator
    address public tbccBurnAddress;
    address public tbccVaultAddress;
    uint public tbccBurnRate; // rate for burn (e.g. 718750 means 71.875%)
    uint constant public RATE_DENOMINATOR = 1000000;
    uint constant UNLIMITED_APPROVAL_AMOUNT = type(uint256).max;
    IWETH WETH;

    // Maximum amount of BNB to top-up operator
    uint public operatorTopUpLimit;

    // Copied from: @openzeppelin/contracts/security/ReentrancyGuard.sol
    uint256 private constant _NOT_ENTERED = 0;
    uint256 private constant _ENTERED = 1;

    uint256 private _status;

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        _status = _ENTERED;

        _;

        _status = _NOT_ENTERED;
    }

    modifier onlyOwnerOrOperator() {
        require(msg.sender == owner() || msg.sender == operatorAddress, "Not owner/operator");
        _;
    }

    // Modifier for NFT holder
    modifier onlyNFTHolder(address sender, uint256 tokenId) {
        require(msg.sender == address(tbccDefiApes), "Only TBCC DEFI APES");
        require(sender == tbccDefiApes.ownerOf(tokenId), 'Only TBCC DEFI APES NFT holder');
        _;
    }

    function initialize(
        address _WETH,
        address _tbcc,
        address _tbccFinanceSwapRouter,
        address _operatorAddress,
        address _tbccBurnAddress,
        address _tbccVaultAddress,
        uint _tbccBurnRate,
        address _GNOSIS
    )
    external
    initializer
    {
        __Ownable_init();
        __UUPSUpgradeable_init();
        tbcc = _tbcc;
        tbccFinanceSwapRouter = ITBCCFinanceRouter(_tbccFinanceSwapRouter);
        operatorAddress = _operatorAddress;
        tbccBurnAddress = _tbccBurnAddress;
        tbccVaultAddress = _tbccVaultAddress;
        tbccBurnRate = _tbccBurnRate;
        WETH = IWETH(_WETH);
        operatorTopUpLimit = 100 ether;
        claimingPause = true;

        transferOwnership(_GNOSIS);
    }

    /**
     * @notice Sell LP token, buy back $TBCC. The amount can be specified by the caller.
     * @dev Callable by owner/operator
     */
    function processFee(
        RemoveLiquidityInfo[] calldata liquidityList,
        SwapInfo[] calldata swapList,
        bool ignoreError
    )
    external
    onlyOwnerOrOperator
    {
        for (uint256 i = 0; i < liquidityList.length; ++i) {
            removeLiquidity(liquidityList[i], ignoreError);
        }
        for (uint256 i = 0; i < swapList.length; ++i) {
            swap(swapList[i].amountIn, swapList[i].amountOutMin, swapList[i].path, ignoreError);
        }
    }

    function removeLiquidity(
        RemoveLiquidityInfo calldata info,
        bool ignoreError
    )
    internal
    {
        uint allowance = info.pair.allowance(address(this), address(tbccFinanceSwapRouter));
        if (allowance < info.amount) {
            IERC20Upgradeable(address(info.pair)).safeApprove(address(tbccFinanceSwapRouter), UNLIMITED_APPROVAL_AMOUNT);
        }
        address token0 = info.pair.token0();
        address token1 = info.pair.token1();
        try tbccFinanceSwapRouter.removeLiquidity(
            token0,
            token1,
            info.amount,
            info.amountAMin,
            info.amountBMin,
            address(this),
            block.timestamp
        )
        {
            // do nothing here
        } catch {
            emit RmoveLiquidityFailure(info.pair, info.amount, info.amountAMin, info.amountBMin);
            require(ignoreError, "remove liquidity failed");
            // if one of the swap fails, we do NOT revert and carry on
        }
    }

    /**
     * @notice Swap tokens for $TBCC
     */
    function swap(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        bool ignoreError
    )
    internal
    {
        require(path.length > 1, "invalid path");
        address token = path[0];
        uint tokenBalance = IERC20Upgradeable(token).balanceOf(address(this));
        amountIn = (amountIn > tokenBalance) ? tokenBalance : amountIn;
        // TODO: need to adjust `token0AmountOutMin` ?
        uint allowance = IERC20Upgradeable(token).allowance(address(this), address(tbccFinanceSwapRouter));
        if (allowance < amountIn) {
            IERC20Upgradeable(token).safeApprove(address(tbccFinanceSwapRouter), UNLIMITED_APPROVAL_AMOUNT);
        }
        try tbccFinanceSwapRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp
        )
        {
            // do nothing here
        } catch {
            emit SwapFailure(amountIn, amountOutMin, path);
            require(ignoreError, "swap failed");
            // if one of the swap fails, we do NOT revert and carry on
        }
    }

    /**
     * @notice Send $TBCC tokens to specified wallets(burn and vault)
     * @dev Callable by owner/operator
     */
    function sendTBCC(uint amount)
    external
    onlyOwnerOrOperator
    {
        require (amount > 0, "invalid amount");
        uint burnAmount = amount * tbccBurnRate / RATE_DENOMINATOR;
        // The rest goes to the vault wallet.
        uint vaultAmount = amount - burnAmount;
        IERC20Upgradeable(tbcc).safeTransfer(tbccBurnAddress, burnAmount);
        IERC20Upgradeable(tbcc).safeTransfer(tbccVaultAddress, vaultAmount);
    }

    /**
     * @notice Deposit ETH for WETH
     * @dev Callable by owner/operator
     */
    function depositETH(uint amount)
    external
    onlyOwnerOrOperator
    {
        WETH.deposit{value: amount}();
    }

    /**
     * @notice Set TBCCFinanceSwapRouter
     * @dev Callable by owner
     */
    function setTBCCFinanceSwapRouter(address _tbccFinanceSwapRouter) external onlyOwner {
        tbccFinanceSwapRouter = ITBCCFinanceRouter(_tbccFinanceSwapRouter);
        emit NewTBCCFinanceSwapRouter(msg.sender, _tbccFinanceSwapRouter);
    }

    /**
     * @notice Set operator address
     * @dev Callable by owner
     */
    function setOperator(address _operatorAddress) external onlyOwner {
        operatorAddress = _operatorAddress;
        emit NewOperatorAddress(msg.sender, _operatorAddress);
    }

    /**
     * @notice Set address for `tbcc burn`
     * @dev Callable by owner
     */
    function setTBCCBurnAddress(address _tbccBurnAddress) external onlyOwner {
        tbccBurnAddress = _tbccBurnAddress;
        emit NewTBCCBurnAddress(msg.sender, _tbccBurnAddress);
    }

    /**
     * @notice Set vault address
     * @dev Callable by owner
     */
    function setTBCCVaultAddress(address _tbccVaultAddress) external onlyOwner {
        tbccVaultAddress = _tbccVaultAddress;
        emit NewTBCCVaultAddress(msg.sender, _tbccVaultAddress);
    }

    /**
     * @notice Set percentage of $TBCC being sent for burn
     * @dev Callable by owner
     */
    function setTBCCBurnRate(uint _tbccBurnRate) external onlyOwner {
        require(_tbccBurnRate < RATE_DENOMINATOR, "invalid rate");
        tbccBurnRate = _tbccBurnRate;
        emit NewTBCCBurnRate(msg.sender, _tbccBurnRate);
    }

    /**
     * @notice Withdraw tokens from this smart contract
     * @dev Callable by owner
     */
    function withdraw(
        address tokenAddr,
        address payable to,
        uint amount
    )
    external
    nonReentrant
    onlyOwner
    {
        require(to != address(0), "invalid recipient");
        if (tokenAddr == address(0)) {
            (bool success, ) = to.call{ value: amount }("");
            require(success, "transfer BNB failed");
        }
        else {
            IERC20Upgradeable(tokenAddr).safeTransfer(to, amount);
        }
    }

    /**
     * @notice transfer some BNB to the operator as gas fee
     * @dev Callable by owner
     */
    function topUpOperator(uint256 amount) external onlyOwner {
        require(amount <= operatorTopUpLimit, "too much");
        uint256 bnbBalance = address(this).balance;
        if (amount > bnbBalance) {
            // BNB not enough, get some BNB from WBNB
            // If WBNB balance is not enough, `withdraw` will `revert`.
            WETH.withdraw(amount - bnbBalance);
        }
        payable(operatorAddress).transfer(amount);
    }

    /**
     * @notice Set top-up limit
     * @dev Callable by owner
     */
    function setOperatorTopUpLimit(uint256 _operatorTopUpLimit) external onlyOwner {
        operatorTopUpLimit = _operatorTopUpLimit;
    }

    /**
     * @notice Getting all pair addresses
     *
     */
    function getAllPairAddress(
        address factory
    )
    external
    view
    returns (
        address[] memory pairs
    )
    {
        ITBCCFinanceFactory tbccFactory = ITBCCFinanceFactory(factory);
        uint256 length = tbccFactory.allPairsLength();

        address[] memory values = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            address tempAddr = address(tbccFactory.allPairs(i));
            values[i] = tempAddr;
        }

        return (values);
    }

    /**
     * @notice Getting pair addresses per page
     *
     */
    function getPairAddress(
        address factory,
        uint256 cursor,
        uint256 size
    )
    external
    view
    returns (
        address[] memory pairs,
        uint256 nextCursor
    )
    {
        ITBCCFinanceFactory tbccFactory = ITBCCFinanceFactory(factory);
        uint256 maxLength = tbccFactory.allPairsLength();
        uint256 length = size;
        if (cursor >= maxLength) {
            address[] memory emptyList;
            return (emptyList, maxLength);
        }
        if (length > maxLength - cursor) {
            length = maxLength - cursor;
        }

        address[] memory values = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            address tempAddr = address(tbccFactory.allPairs(cursor+i));
            values[i] = tempAddr;
        }

        return (values, cursor + length);
    }

    /**
     * @notice Getting pairs information for account
     *
     */
    function getPairTokens(
        address[] calldata lps,
        address account
    )
    external
    view
    returns (
        LPData[] memory
    )
    {
        LPData[] memory lpListData = new LPData[](lps.length);
        for (uint256 i = 0; i < lps.length; ++i) {
            ITBCCFinancePair pair = ITBCCFinancePair(lps[i]);
            address token0 = pair.token0();
            address token1 = pair.token1();
            uint256 balance0;
            uint256 balance1;
            (balance0, balance1, ) = pair.getReserves();
            uint256 userBalance = pair.balanceOf(account);
            uint256 totalSupply = pair.totalSupply();

            lpListData[i].lpAddress = lps[i];
            lpListData[i].token0 = token0;
            lpListData[i].token1 = token1;
            lpListData[i].token0Amt = (userBalance * balance0) / totalSupply;
            lpListData[i].token1Amt = (userBalance * balance1) / totalSupply;
            lpListData[i].userBalance = userBalance;
            lpListData[i].totalSupply = totalSupply;
        }
        return lpListData;
    }

    /**
     * @notice Getting all pairs information
     *
     */
    function getAllPairTokens(
        address factory
    )
    external
    view
    returns (
        LPData[] memory
    )
    {
        ITBCCFinanceFactory tbccFactory = ITBCCFinanceFactory(factory);
        uint256 length = tbccFactory.allPairsLength();

        address[] memory lps = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            address tempAddr = address(tbccFactory.allPairs(i));
            lps[i] = tempAddr;
        }

        LPData[] memory lpListData = new LPData[](lps.length);
        for (uint256 i = 0; i < lps.length; ++i) {
            ITBCCFinancePair pair = ITBCCFinancePair(lps[i]);
            address token0 = pair.token0();
            address token1 = pair.token1();
            uint256 balance0;
            uint256 balance1;
            (balance0, balance1, ) = pair.getReserves();
            uint256 userBalance = pair.balanceOf(address(this));
            uint256 totalSupply = pair.totalSupply();

            lpListData[i].lpAddress = lps[i];
            lpListData[i].token0 = token0;
            lpListData[i].token1 = token1;
            lpListData[i].token0Amt = (userBalance * balance0) / totalSupply;
            lpListData[i].token1Amt = (userBalance * balance1) / totalSupply;
            lpListData[i].userBalance = userBalance;
            lpListData[i].totalSupply = totalSupply;
        }
        return lpListData;
    }

    /**
     * @notice Getting all pairs information for user
     *
     */
    function getAllPairTokensForAccount(
        address factory,
        address account
    )
    external
    view
    returns (
        LPData[] memory
    )
    {
        ITBCCFinanceFactory tbccFactory = ITBCCFinanceFactory(factory);
        uint256 length = tbccFactory.allPairsLength();

        address[] memory lps = new address[](length);
        for (uint256 i = 0; i < length; ++i) {
            address tempAddr = address(tbccFactory.allPairs(i));
            lps[i] = tempAddr;
        }

        LPData[] memory lpListData = new LPData[](lps.length);
        for (uint256 i = 0; i < lps.length; ++i) {
            ITBCCFinancePair pair = ITBCCFinancePair(lps[i]);
            address token0 = pair.token0();
            address token1 = pair.token1();
            uint256 balance0;
            uint256 balance1;
            (balance0, balance1, ) = pair.getReserves();
            uint256 userBalance = pair.balanceOf(account);
            uint256 totalSupply = pair.totalSupply();

            lpListData[i].lpAddress = lps[i];
            lpListData[i].token0 = token0;
            lpListData[i].token1 = token1;
            lpListData[i].token0Amt = (userBalance * balance0) / totalSupply;
            lpListData[i].token1Amt = (userBalance * balance1) / totalSupply;
            lpListData[i].userBalance = userBalance;
            lpListData[i].totalSupply = totalSupply;
        }
        return lpListData;
    }

    /**
     * @notice Setting TBCC Defi Apes
     * @param _tbccDefiApes: TBCC Defi Apes address
     */
    function setTBCCDefiApes(
        address _tbccDefiApes
    ) external onlyOwner {
        tbccDefiApes = ITBCCDEFIAPES(_tbccDefiApes);
    }

    /**
     * @notice Get Claim Amount for Apes holders
     */
    function getApesClaimAmount() public view returns (uint256) {
        uint256 balance = IERC20Upgradeable(tbcc).balanceOf(address(this));

        return balance / tbccDefiApes.totalSupply();
    }

    /**
     * @notice Claiming for Apes holders
     * @param _holder: holder address
     * @param _tokenId: token id
     */
    function apesClaim(
        address _holder,
        uint256 _tokenId
    ) external onlyNFTHolder(_holder, _tokenId) {
        require(_holder != address(0), "invalid recipient");
        require(!claimingPause, "Claiming in Pause now");

        uint256 amount = getApesClaimAmount();
        IERC20Upgradeable(tbcc).safeTransfer(_holder, amount);
    }

    /**
     * @notice Updating claiming pause
     * @param _claimingPause: New claiming pause stage
     */
    function updateClaimingPause(
        bool _claimingPause
    ) external onlyOwner {
        claimingPause = _claimingPause;
    }

    receive() external payable {}
    fallback() external payable {}
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
