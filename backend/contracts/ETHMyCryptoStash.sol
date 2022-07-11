// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MyCryptoStash.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ETHMyCryptoStash is MyCryptoStash, Ownable{
    constructor(address _hasher, uint256 _minDeposit, uint256 _maxDeposit, uint32 _height, address _verifier) MyCryptoStash(_hasher, _minDeposit, _maxDeposit, _height, _verifier){}
    
    function _processDeposit(uint256 _amount) internal override {
        require(msg.value == _amount, "Please send the correct amount");
    }

}