const utils = require("@aztec/dev-utils");
const bn128 = require('@aztec/bn128');
const {
    proofs: {
      JOIN_SPLIT_PROOF,
      MINT_PROOF,
      BURN_PROOF
    },
    constants: { ERC20_SCALING_FACTOR },
  } = utils;
const chai = require("chai")
const { ethers, artifacts } = require("hardhat")
const ACE = artifacts.require("./ACE.sol")
const JoinSplitFluid = artifacts.require('./JoinSplitFluid.sol');
const JoinSplit = artifacts.require('./JoinSplit.sol');
const BaseFactory = artifacts.require('./noteRegistry/epochs/201907/base/FactoryBase201907.sol');
const AdjustableFactory = artifacts.require('./noteRegistry/epochs/201907/adjustable/FactoryAdjustable201907.sol');


const aztec = require("aztec.js");

const { JoinSplitProof, MintProof, BurnProof } = aztec

const secp256k1 = require("@aztec/secp256k1");

describe("Shielding test", () => {
    let ace;
    let zkETH;
    let sheild;
    let ACEContract


    beforeEach(async () => {
        const [signer] = await ethers.getSigners()
        const ace = await ACE.new();
        ACE.setAsDeployed(ace);
        // ace = await ACE.deployed()
        const mint = await JoinSplitFluid.new()
        JoinSplitFluid.setAsDeployed(mint);
        const joinSplit = await JoinSplit.new()
        JoinSplit.setAsDeployed(joinSplit)
        

        ACEContract = await ACE.deployed(bn128.CRS);
        const baseFactory = await BaseFactory.new(ACEContract.address)
        const adjFactory = await AdjustableFactory.new(ACEContract.address)
        BaseFactory.setAsDeployed(baseFactory)
        AdjustableFactory.setAsDeployed(adjFactory)

        const AdjustableFactoryContract = await AdjustableFactory.deployed()
        await ACEContract.setFactory(1 * 256 ** 2 + 1 * 256 ** 1 + 2 * 256 ** 0, AdjustableFactoryContract.address)

        const JoinSplitFluidContract = await JoinSplitFluid.deployed();
        const JoinSplitContract = await JoinSplit.deployed()
        await ACEContract.setCommonReferenceString(bn128.CRS);
        await ACEContract.setProof(MINT_PROOF, JoinSplitFluidContract.address);
        await ACEContract.setProof(BURN_PROOF, JoinSplitFluidContract.address);
        await ACEContract.setProof(JOIN_SPLIT_PROOF, JoinSplitContract.address);

        // console.log(MINT_PROOF, ACEContract.address, BaseFactoryContract.address)
        const ZKETH = await ethers.getContractFactory("ZkETH")
        zkETH = await ZKETH.deploy(ACEContract.address, "0x0000000000000000000000000000000000000000", 1)
    })

    it("should transact", async () => {
        const bob = secp256k1.generateAccount()
        const bobNote1 = await aztec.note.create(bob.publicKey, 100)

        const newMintCounterNote = await aztec.note.create(bob.publicKey, 100)
        const zeroMintCounterNote = await aztec.note.createZeroValueNote()
        const mintedNotes = [bobNote1]

        const [signer] = await ethers.getSigners()

        const mintProof = new MintProof(
            zeroMintCounterNote,
            newMintCounterNote,
            mintedNotes,
            signer.address
        )

        const mintData = mintProof.encodeABI()

        // const proofOutput = await sheild.callStatic.transact(MINT_PROOF, mintData)
        await zkETH.confidentialMint(MINT_PROOF, mintData)

        const sally = secp256k1.generateAccount()
        const sallyFee = await aztec.note.create(sally.publicKey, 25)

        const bobNote2 = await aztec.note.create(bob.publicKey, 75)
        const withdrawPublicValue = 0
        
        const sendProof = new JoinSplitProof(
            mintedNotes,
            [sallyFee, bobNote2],
            signer.address,
            withdrawPublicValue,
            signer.address
        )

        const sendProofData = sendProof.encodeABI(zkETH.address)
        const sendProofSignatures = sendProof.constructSignatures(
            zkETH.address,
            [bob]
        )

        await zkETH["confidentialTransfer(bytes,bytes)"](
            sendProofData,
            sendProofSignatures
        )

        const zeroBurnCounterNote = await aztec.note.createZeroValueNote()
        console.log()
        const newBurnCounterNote = await aztec.note.create(sally.publicKey, 75)


        const burnProof = new BurnProof(
            zeroBurnCounterNote,
            newBurnCounterNote,
            [bobNote2],
            signer.address
        )

        const burnData = burnProof.encodeABI()

        await zkETH.confidentialBurn(BURN_PROOF, burnData)
        
    })
})