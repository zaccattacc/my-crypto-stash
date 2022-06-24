pragma solidity >= 0.5.0 < 0.8.13;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract AssetHolder is Ownable {

    uint totalDeposit;

    constructor() internal {
        totalDeposit = 0;
    }

    function deposit(uint amount) payable public{
        require(amount == msg.value, "Not enough Ether sent");
        totalDeposit += amount;
    }

    function withdraw(address payable _recipient, uint _amount) payable public{
        require(isOwner(), "only the owner can initiate withdrawal");
        (bool success, ) = _recipient.call.value(_amount)("");
        require(success, "Transfer failed");
        totalDeposit -= _amount;
    }

}