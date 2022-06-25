// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MyCryptoStash.sol";

contract ETHMyCryptoStash is MyCryptoStash {
    constructor(address _hasher, uint256 _minDeposit, uint32 _height, IVerifier _verifier) MyCryptoStash(_hasher, _minDeposit, _height, _verifier){}
    
    function _processDeposit(uint256 _amount) internal override {
        require(msg.value == _amount, "Please send the correct amount");
    }

}