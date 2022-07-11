//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MerkleTreeWithHistory.sol";
import "./CommitHold.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IVerifier {
    function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[6] memory input
        ) external view returns (bool r);
}

abstract contract MyCryptoStash is MerkleTreeWithHistory, ReentrancyGuard, Holder{
    uint256 public immutable minimumDeposit;
    uint256 public immutable maximumDeposit;
    IVerifier public immutable verifier;

    mapping(uint256 => bool) public nullifierHashes;
    mapping(uint256 => bool) public commitments;

    event Deposit(uint256 indexed commitment, uint32 leafIndex, uint256 timestamp);
    event Withdraw(address to, uint256 nullifierHash, address indexed relayer, uint256 fee);
    event PartialWithdraw(address to, uint256 nullifierHash, address indexed relayer, uint256 fee, uint256 commitment);

    struct Proof {
        uint[2] a;
        uint[2][2] b;
        uint[2] c;
    }


    constructor(address _hasher, uint256 _minDeposit, uint256 _maxDeposit, uint32 _merkleTreeHeight, address _verifier) MerkleTreeWithHistory(_merkleTreeHeight, _hasher){
        require(_minDeposit > 0, "minimum deposit should be greater than 0.");
        verifier = IVerifier(_verifier);
        minimumDeposit = _minDeposit;
        maximumDeposit = _maxDeposit;
    }

    function _processDeposit(uint256 _amount) internal virtual;
    
    function deposit(uint256 _commitment, uint256 _amount) external payable nonReentrant {
        require(!commitments[_commitment], "The commitment has already been submitted.");
        require(_amount >= minimumDeposit && _amount <= maximumDeposit, "You cannot deposit this amount.");
        uint32 insertedIndex = _insert(_commitment);
        insertCommitment(_commitment);
        commitments[_commitment] = true;
        _processDeposit(_amount);

        // emit event later
        emit Deposit(_commitment, insertedIndex, block.timestamp);
       
    }

    function _processWithdraw(address payable _recipient, address payable _relayer, uint256 _fee, uint256 _amount) internal {
        require(msg.value == 0, "Message value is supposed to be zero for ETH instance");

        (bool success, ) = _recipient.call{ value: (_amount - _fee) }("");
        require(success, "payment to _recipient did not go thru");
        if (_fee > 0){
            (success, ) = _relayer.call{ value: _fee }("");
            require(success, "payment to the _relayer did not go thru.");
        }
    }

    function withdraw(
        Proof memory _proof,
        uint256 _root,
        uint256 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _amount
        ) external payable nonReentrant {
            require(_fee <= _amount, "Fee exceeds transfer value");
            require(!nullifierHashes[_nullifierHash], "The note has been already spent.");
            require(isKnownRoot(_root), "Cannot find your merkle root");
            uint[] memory pubSignals = new uint[](6);
            pubSignals[0] = uint256(_root);
            pubSignals[1] = uint256(_nullifierHash);
            pubSignals[2] = uint256(uint160(address(_recipient)));
            pubSignals[3] = uint256(uint160(address(_relayer)));
            pubSignals[4] = uint256(_fee);
            pubSignals[5] = uint256(_amount);

            require(verifier.verifyProof(
                _proof.a,
                _proof.b,
                _proof.c, 
                [
                    uint256(_root),
                    uint256(_nullifierHash),
                    uint256(uint160(address(_recipient))),
                    uint256(uint160(address(_relayer))),
                    uint256(_fee),
                    uint256(_amount)
                ]
            ), "Invalid proof");

            nullifierHashes[_nullifierHash] = true;
            _processWithdraw(_recipient, _relayer, _fee, _amount);
            // emits Withdraw
            emit Withdraw(_recipient, _nullifierHash, _relayer, _fee);
        }

        function partialWithdraw(
        Proof memory _proof,
        uint256 _root,
        uint256 _nullifierHash,
        address payable _recipient,
        address payable _relayer,
        uint256 _fee,
        uint256 _amount,
        uint256 _newCommitment
        ) external payable nonReentrant{
            require(_fee <= _amount, "Fee exceeds transfer value");
            require(!nullifierHashes[_nullifierHash], "The note has been already spent.");
            require(isKnownRoot(_root), "Cannot find your merkle root");

            require(
                verifier.verifyProof(
                    _proof.a,
                    _proof.b,
                    _proof.c,
                    [
                        uint256(_root),
                        uint256(_nullifierHash),
                        uint256(uint160(address(_recipient))),
                        uint256(uint160(address(_relayer))),
                        uint256(_fee),
                        uint256(_amount)
                    ]
                ), "Invalid proof"
            );

            nullifierHashes[_nullifierHash] = true;
            _processWithdraw(_recipient, _relayer, _fee, _amount);
            require(!commitments[_newCommitment], "The commitment has already been submitted.");
            uint32 insertedIndex = _insert(_newCommitment);
            commitments[_newCommitment] = true;

            emit PartialWithdraw(_recipient, _nullifierHash, _relayer, _fee, _newCommitment);

        }

}