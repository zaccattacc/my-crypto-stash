//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Holder {

    uint256[] private commitments;

    function insertCommitment(uint256 _commitment) internal{
        commitments.push(_commitment);
    }

    function getCommitments() external view returns(uint256[] memory){
        return commitments;
    }
}