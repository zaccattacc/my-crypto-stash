pragma solidity >= 0.5.0 < 0.8.13;

import "@aztec/protocol/contracts/interfaces/IAZTEC.sol";
import "@aztec/protocol/contracts/interfaces/IACE.sol";
import "@aztec/protocol/contracts/ACE/ACE.sol";
import "@aztec/protocol/contracts/ACE/validators/joinSplitFluid/JoinSplitFluid.sol";
import "@aztec/protocol/contracts/ACE/validators/joinSplit/JoinSplit.sol";
import "@aztec/protocol/contracts/ACE/noteRegistry/epochs/201907/base/FactoryBase201907.sol";
import "@aztec/protocol/contracts/ACE/noteRegistry/epochs/201907/adjustable/FactoryAdjustable201907.sol";
import "@aztec/protocol/contracts/ERC1724/ZkAsset.sol";
import "./interfaces/IZkETH.sol";
import "@aztec/protocol/contracts/libs/NoteUtils.sol";

contract Pool {

    using NoteUtils for bytes;

    IACE public ace;
    IZkETH public zkAsset;
    uint public lastBalance;
    uint public maximumDeposit;


    constructor(address _ace, address _zkAsset) public {
        ace = IACE(_ace);
        zkAsset = IZkETH(_zkAsset);
    }

    function transact(uint24 _proof, bytes memory _data) public{
        bytes memory proofOutput = ace.validateProof(_proof, msg.sender, _data);
        zkAsset.update(_proof, proofOutput, msg.sender);
        zkAsset.confidentialMint(_proof, _data);
    }



}