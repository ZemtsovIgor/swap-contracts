// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;
pragma abicoder v2;

import {TBCCFinanceFeeHandler} from "./TBCCFinanceFeeHandler.sol";

contract TBCCFinanceFeeHandlerV3 is TBCCFinanceFeeHandler {
    bool public flag;

    function setFlag() external onlyOwner {
        flag = true;
    }
}
