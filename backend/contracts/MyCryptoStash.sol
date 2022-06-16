//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof(
        bytes memory proof,
        uint[6] memory pubSignals
    ) external view returns (bool);
}

abstract contract MyCryptoStash is MerkleTreeWithHistory, ReentrancyGuard{
    uint256 public immutable denomination;
    IVerifier public immutable verifier;

    mapping(uint256 => bool) public nullifierHashes;
    mapping(uint256 => bool) public commitments;

    event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp);

    constructor(address _hasher, uint256 _denomination, uint32 _merkleTreeHeight, IVerifier _verifier) MerkleTreeWithHistory(_merkleTreeHeight, _hasher){
        require(_denomination > 0, "denomination should be greater than 0.");
        verifier = _verifier;
        denomination = _denomination;
    }

    function _processDeposit() internal virtual;
    
    function deposit(uint256 _commitment) external payable nonReentrant {
        require(!commitments[_commitment], "The commitment has already been submitted.");
        uint32 insertedIndex = _insert(_commitment);
        commitments[_commitment] = true;
        _processDeposit();

        // emit event later
        emit Deposit(_commitment, insertedIndex, block.timestamp);
       
    }

    function _processWithdraw(address payable _recipient, address payable _relayer, uint256 _fee, uint256 _refund) internal {
        require(msg.value == 0, "Message value is supposed to be zero for ETH instance");

        (bool success, ) = _recipient.call{ value: (denomination - _fee) }("");
        require(success, "payment to _recipient did not go thru");
        if (_fee > 0){
            (success, ) = _relayer.call{ value: _fee }("");
            require(success, "payment to the _relayer did not go thru.");
        }
    }

    function withdraw(
        bytes memory _proof,
        uint256 _root,
        uint256 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _refund
        ) external payable nonReentrant {
            require(_fee <= denomination, "Fee exceeds transfer value");
            require(!nullifierHashes[_nullifierHash], "The note has been already spent.");
            require(isKnownRoot(_root), "Cannot find your merkle root");
            require(verifier.verifyProof(_proof, [
                uint(_root),
                uint(_nullifierHash),
                uint(uint160(address(_recipient))),
                uint(uint160(address(_relayer))),
                uint(_fee),
                uint(block.timestamp)
            ]), "Invalid proof");

            nullifierHashes[_nullifierHash] = true;
            _processWithdraw(_recipient, _relayer, _fee, _refund);
            // emits Withdraw
        }
}