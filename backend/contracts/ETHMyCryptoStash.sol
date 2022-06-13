// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MyCryptoStash.sol";

contract ETHMyCryptoStash is MyCryptoStash {
    constructor(address _hasher, uint256 _denomination, uint32 _height) MyCryptoStash(_hasher, _denomination, _height){}
    
    function _processDeposit() internal override {
        require(msg.value == denomination, "Please send the correct denomination");
    }

}